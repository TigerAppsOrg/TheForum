"""Pipeline orchestrator — ties together ingestion, extraction, dedup, and storage."""

import json
import logging
from pathlib import Path

from dateutil import parser as dateparser

from . import db
from .dedup import is_exact_duplicate, is_fuzzy_duplicate
from .extractor import extract_event
from .gmail import fetch_unread_emails
from .location import resolve_location
from .parser import preprocess_email

logger = logging.getLogger(__name__)


def _match_config(email_to: str, configs: list[dict]) -> dict | None:
    """Match an email's 'to' address against enabled listserv configs."""
    to_lower = email_to.lower()
    for cfg in configs:
        if cfg["address"].lower() in to_lower:
            return cfg
    return None


def _resolve_creator(email: object, config: dict | None) -> tuple[str, str | None]:
    """Determine creator_id and org_id for the event.

    Returns (creator_id, org_id).
    """
    org_id = config["org_id"] if config else None

    # Try matching HoagieMail sender to a real user
    if email.hoagiemail_sender:
        user_id = db.find_user_by_email(email.hoagiemail_sender.email)
        if user_id:
            return user_id, org_id

    # Fall back to pipeline bot
    return db.get_pipeline_user_id(), org_id


def _empty_stats() -> dict:
    return {
        "processed": 0,
        "created": 0,
        "needs_review": 0,
        "skipped": 0,
        "duplicates": 0,
        "errors": 0,
    }


def process_raw_emails(raw_emails: list[dict]) -> dict:
    """Process a list of raw email dicts through the extraction pipeline.

    Works for both Gmail API-fetched emails and Apps Script-pushed emails.
    Returns a summary dict with counts.
    """
    configs = db.get_enabled_configs()
    stats = _empty_stats()

    for raw in raw_emails:
        stats["processed"] += 1
        gmail_id = raw.get("gmail_id", "")

        try:
            email = preprocess_email(raw)

            # Exact dedup by message ID
            if is_exact_duplicate(email.message_id):
                logger.debug("Skipping exact duplicate: %s", email.message_id)
                stats["duplicates"] += 1
                config = _match_config(email.to, configs)
                db.insert_log(
                    message_id=email.message_id,
                    listserv_config_id=str(config["id"]) if config else None,
                    status="duplicate",
                )
                continue

            # Match to a listserv config
            config = _match_config(email.to, configs)

            # LLM extraction
            extracted = extract_event(email)
            if not extracted:
                logger.debug("Not an event: %s", email.subject)
                stats["skipped"] += 1
                db.insert_log(
                    message_id=email.message_id,
                    listserv_config_id=str(config["id"]) if config else None,
                    status="skipped_not_event",
                )
                continue

            # Parse datetime. Some extractors (e.g. the ML classifier/tagger
            # pipeline) don't produce a datetime_str at all — fall back to
            # the email's own timestamp rather than treating that as an
            # error. Fallback-timestamp events are flagged needs_review
            # since "when the email was sent" isn't necessarily "when the
            # event happens" — a human should confirm/correct the date.
            needs_review = False
            event_dt = None
            if extracted.datetime_str:
                try:
                    event_dt = dateparser.parse(extracted.datetime_str)
                except (ValueError, TypeError):
                    event_dt = None

            if event_dt is None:
                needs_review = True
                try:
                    event_dt = dateparser.parse(email.timestamp) if email.timestamp else None
                except (ValueError, TypeError):
                    event_dt = None

            if event_dt is None:
                # Neither the extracted datetime nor the email's own
                # timestamp could be parsed — genuinely nothing to anchor
                # this event to, so this is still an error.
                logger.warning(
                    "Could not parse datetime '%s' or fallback timestamp '%s' for '%s'",
                    extracted.datetime_str,
                    email.timestamp,
                    extracted.title,
                )
                stats["errors"] += 1
                db.insert_log(
                    message_id=email.message_id,
                    listserv_config_id=str(config["id"]) if config else None,
                    status="error",
                    error_text=(
                        f"Unparseable datetime: {extracted.datetime_str!r} "
                        f"(fallback timestamp {email.timestamp!r} also unparseable)"
                    ),
                )
                continue

            end_dt = None
            if extracted.end_datetime_str:
                try:
                    end_dt = dateparser.parse(extracted.end_datetime_str)
                except (ValueError, TypeError):
                    pass

            # Fuzzy dedup
            if is_fuzzy_duplicate(extracted.title, event_dt):
                logger.debug("Fuzzy duplicate: %s", extracted.title)
                stats["duplicates"] += 1
                db.insert_log(
                    message_id=email.message_id,
                    listserv_config_id=str(config["id"]) if config else None,
                    status="duplicate",
                )
                continue

            # Resolve location
            location_id = resolve_location(extracted.location_name)

            # Resolve creator and org
            creator_id, org_id = _resolve_creator(email, config)

            # Insert event. needs_review events (fallback timestamp — the real
            # event date is unknown) are kept private until a human confirms
            # the date, so they never hit the public feed with wrong data.
            event_id = db.insert_event(
                title=extracted.title,
                description=extracted.description,
                dt=event_dt,
                end_dt=end_dt,
                location_id=location_id,
                org_id=org_id,
                creator_id=creator_id,
                source_message_id=email.message_id,
                tags=extracted.tags,
                is_public=not needs_review,
            )

            if needs_review:
                stats["needs_review"] += 1
                db.insert_log(
                    message_id=email.message_id,
                    listserv_config_id=str(config["id"]) if config else None,
                    status="needs_review",
                    extracted_event_id=event_id,
                )
                logger.info(
                    "Flagged event '%s' (id=%s) for review — used fallback timestamp",
                    extracted.title,
                    event_id,
                )
            else:
                stats["created"] += 1
                db.insert_log(
                    message_id=email.message_id,
                    listserv_config_id=str(config["id"]) if config else None,
                    status="success",
                    extracted_event_id=event_id,
                )
                logger.info("Created event '%s' (id=%s)", extracted.title, event_id)

        except Exception:
            stats["errors"] += 1
            logger.exception("Error processing email %s", gmail_id)
            db.insert_log(
                message_id=raw.get("message_id", gmail_id),
                listserv_config_id=None,
                status="error",
                error_text="Unexpected error — see server logs",
            )

    return stats


def run_pipeline() -> dict:
    """Run the full ingestion pipeline via Gmail API.

    Returns a summary dict with counts.
    """
    configs = db.get_enabled_configs()
    if not configs:
        logger.info("No enabled listserv configs found.")
        return _empty_stats()

    # Build Gmail query from config labels
    label_queries = []
    for cfg in configs:
        if cfg.get("gmail_label"):
            label_queries.append(f"label:{cfg['gmail_label']}")
    query = f"is:unread ({' OR '.join(label_queries)})" if label_queries else "is:unread"

    raw_emails = fetch_unread_emails(query)
    logger.info("Fetched %d unread emails", len(raw_emails))

    return process_raw_emails(raw_emails)


# ---------------------------------------------------------------------------
# Local JSON testing entry point (e.g. apps/listserv-scraper/data/email_sample_200.json)
# ---------------------------------------------------------------------------

def _json_message_to_raw(message: dict, listserv_name: str) -> dict:
    """Adapt one scraped-archive message into the raw dict shape that
    preprocess_email expects.

    preprocess_email reads these keys directly via raw.get(...):
    message_id, subject, sender, to, body_html, body_text, date, gmail_id.
    Everything else in the JSON (is_hoagiemail, hoagiemail_sender_email/name,
    author_name, author_email, links, images, attachments, etc.) is extra
    and simply ignored — preprocess_email derives hoagiemail_sender itself
    from the body text via detect_hoagiemail(), it does not read the JSON's
    is_hoagiemail/hoagiemail_sender_* fields at all.

    Two mappings needed:
    - sender: preprocess_email wants a "sender" key; the JSON has
      author_name/author_email instead, so we build one.
    - to: preprocess_email wants a "to" key for listserv-config matching
      (_match_config), but the scraper JSON has no per-message recipient
      address — only a top-level `listserv` name like "WHITMANWIRE". We
      synthesize a placeholder "to" so matching still runs, on the
      assumption that a config's `address` field contains the listserv
      name. If your config addresses don't contain the listserv name,
      adjust this — it only affects org_id attribution, not extraction,
      dedup, or event creation.
    """
    raw = dict(message)  # keep all original fields intact (harmless extras)
    raw["gmail_id"] = message.get("message_id", "")
    raw["sender"] = f"{message.get('author_name', '')} <{message.get('author_email', '')}>".strip()
    raw.setdefault("to", f"{listserv_name.lower()}@princeton.edu")
    return raw


def load_json_emails(json_path: str | Path) -> tuple[str, list[dict]]:
    """Load a scraped listserv archive file (email_sample_200.json format).

    Returns (listserv_name, raw_email_dicts) ready for process_raw_emails.
    """
    path = Path(json_path)
    data = json.loads(path.read_text())
    listserv_name = data.get("listserv", "")
    messages = data.get("messages", [])
    logger.info(
        "Loaded %d messages from %s (listserv=%s)", len(messages), path, listserv_name
    )
    raw_emails = [_json_message_to_raw(m, listserv_name) for m in messages]
    return listserv_name, raw_emails


def run_pipeline_from_json(json_path: str | Path, limit: int | None = None) -> dict:
    """Run the extraction pipeline against a local scraped JSON file instead
    of live Gmail. Useful for testing orchestrator.py end-to-end against
    email_sample_200.json without needing Gmail API access.

    Args:
        json_path: path to a scraper JSON file (email_sample_200.json format).
        limit: optionally cap how many messages are processed. Recommended
            while iterating, since extraction calls an LLM per message and
            success/failure inserts still hit your real database.
    """
    _listserv_name, raw_emails = load_json_emails(json_path)
    if limit is not None:
        raw_emails = raw_emails[:limit]
    logger.info("Processing %d messages from JSON file", len(raw_emails))
    return process_raw_emails(raw_emails)


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)

    json_file = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "apps/listserv-scraper/data/email_sample_200.json"
    )
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10  # small default while testing

    result = run_pipeline_from_json(json_file, limit=limit)
    print(result)
