"""Database helpers for the pipeline — uses raw psycopg2 to talk to the same Postgres."""

from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

import psycopg2
import psycopg2.extras

from .config import settings

psycopg2.extras.register_uuid()


@contextmanager
def get_conn():
    """Yield a psycopg2 connection, auto-commit on success."""
    conn = psycopg2.connect(settings.database_url)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Listserv configs ──────────────────────────────────────


def get_enabled_configs() -> list[dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, address, label, org_id, gmail_label, enabled "
                "FROM listserv_configs WHERE enabled = true"
            )
            return [dict(r) for r in cur.fetchall()]


def get_all_configs() -> list[dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, address, label, org_id, gmail_label, enabled, created_at "
                "FROM listserv_configs ORDER BY created_at"
            )
            return [dict(r) for r in cur.fetchall()]


def create_config(address: str, label: str, gmail_label: str | None, org_id: str | None) -> dict:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO listserv_configs (address, label, gmail_label, org_id) "
                "VALUES (%s, %s, %s, %s) RETURNING *",
                (address, label, gmail_label, org_id),
            )
            return dict(cur.fetchone())


def update_config(config_id: str, **fields) -> dict | None:
    if not fields:
        return None
    set_parts = []
    vals = []
    for k, v in fields.items():
        set_parts.append(f"{k} = %s")
        vals.append(v)
    vals.append(config_id)
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"UPDATE listserv_configs SET {', '.join(set_parts)} WHERE id = %s RETURNING *",
                vals,
            )
            row = cur.fetchone()
            return dict(row) if row else None


def delete_config(config_id: str) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM listserv_configs WHERE id = %s", (config_id,))
            return cur.rowcount > 0


# ── Events ────────────────────────────────────────────────


def message_id_exists(message_id: str) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM events WHERE source_message_id = %s LIMIT 1",
                (message_id,),
            )
            return cur.fetchone() is not None


def find_similar_events(title: str, dt: datetime, window_hours: int = 24) -> list[dict]:
    """Find events within ±window_hours of the given datetime."""
    start = dt - timedelta(hours=window_hours)
    end = dt + timedelta(hours=window_hours)
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, title, datetime FROM events "
                "WHERE datetime BETWEEN %s AND %s",
                (start, end),
            )
            return [dict(r) for r in cur.fetchall()]


def get_campus_locations() -> list[dict]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, name FROM campus_locations")
            return [dict(r) for r in cur.fetchall()]


def get_pipeline_user_id() -> str:
    """Get or create the system pipeline user used for unmatched event attribution."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE net_id = '_pipeline'")
            row = cur.fetchone()
            if row:
                return str(row[0])
            # Auto-seed the pipeline bot user
            cur.execute(
                "INSERT INTO users (net_id, email, display_name) "
                "VALUES ('_pipeline', 'pipeline@theforum.internal', 'The Forum Bot') "
                "RETURNING id"
            )
            return str(cur.fetchone()[0])


def find_user_by_email(email: str) -> str | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            row = cur.fetchone()
            return str(row[0]) if row else None


def insert_event(
    *,
    title: str,
    description: str,
    dt: datetime,
    end_dt: datetime | None,
    location_id: str,
    org_id: str | None,
    creator_id: str,
    source_message_id: str,
    tags: list[str],
) -> str:
    """Insert an event and its tags. Returns the new event id."""
    event_id = uuid4()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO events "
                "(id, title, description, datetime, end_datetime, location_id, "
                "org_id, creator_id, source, source_message_id, is_public) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'listserv', %s, true)",
                (
                    event_id,
                    title,
                    description,
                    dt,
                    end_dt,
                    location_id,
                    org_id,
                    creator_id,
                    source_message_id,
                ),
            )
            for tag in tags:
                cur.execute(
                    "INSERT INTO event_tags (event_id, tag) VALUES (%s, %s) "
                    "ON CONFLICT DO NOTHING",
                    (event_id, tag),
                )
    return str(event_id)


# ── Pipeline logs ─────────────────────────────────────────


def insert_log(
    *,
    message_id: str,
    listserv_config_id: str | None,
    status: str,
    error_text: str | None = None,
    extracted_event_id: str | None = None,
) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO pipeline_logs "
                "(message_id, listserv_config_id, status, error_text, extracted_event_id) "
                "VALUES (%s, %s, %s, %s, %s)",
                (message_id, listserv_config_id, status, error_text, extracted_event_id),
            )


def get_pipeline_events(
    limit: int = 50, offset: int = 0, source_config_id: str | None = None
) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            query = (
                "SELECT e.id, e.title, e.description, e.datetime, e.end_datetime, "
                "e.source_message_id, e.org_id, e.created_at, "
                "cl.name as location_name, cl.id as location_id "
                "FROM events e "
                "LEFT JOIN campus_locations cl ON e.location_id = cl.id "
                "WHERE e.source = 'listserv' "
            )
            params: list = []
            if source_config_id:
                query += (
                    "AND e.source_message_id IN "
                    "(SELECT message_id FROM pipeline_logs WHERE listserv_config_id = %s) "
                )
                params.append(source_config_id)
            query += "ORDER BY e.created_at DESC LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            cur.execute(query, params)
            return [dict(r) for r in cur.fetchall()]


def update_event(event_id: str, **fields) -> dict | None:
    if not fields:
        return None
    set_parts = []
    vals = []
    for k, v in fields.items():
        set_parts.append(f"{k} = %s")
        vals.append(v)
    vals.append(event_id)
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"UPDATE events SET {', '.join(set_parts)} "
                f"WHERE id = %s AND source = 'listserv' RETURNING *",
                vals,
            )
            row = cur.fetchone()
            return dict(row) if row else None


def delete_event(event_id: str) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM events WHERE id = %s AND source = 'listserv'",
                (event_id,),
            )
            return cur.rowcount > 0


def get_duplicate_logs(limit: int = 50, offset: int = 0) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT pl.id, pl.message_id, pl.status, pl.error_text, pl.created_at, "
                "lc.label as listserv_label "
                "FROM pipeline_logs pl "
                "LEFT JOIN listserv_configs lc ON pl.listserv_config_id = lc.id "
                "WHERE pl.status = 'duplicate' "
                "ORDER BY pl.created_at DESC LIMIT %s OFFSET %s",
                (limit, offset),
            )
            return [dict(r) for r in cur.fetchall()]


def get_pipeline_status() -> dict:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT "
                "  COUNT(*) as total, "
                "  COUNT(*) FILTER (WHERE status = 'success') as success, "
                "  COUNT(*) FILTER (WHERE status = 'duplicate') as duplicates, "
                "  COUNT(*) FILTER (WHERE status = 'skipped_not_event') as skipped, "
                "  COUNT(*) FILTER (WHERE status = 'error') as errors, "
                "  MAX(created_at) as last_poll "
                "FROM pipeline_logs"
            )
            return dict(cur.fetchone())

# YUBI ADD FUNCTION TO GET EMBEDDINGS OF CATEGORY TAGS FROM DATABASE
def get_tag_embeddings() -> list[dict]:
    """
    Returns:
    [
        {"tag": "music", "embedding": [...]},
        {"tag": "career", "embedding": [...]}
    ]
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Cast to float[] so psycopg2 parses the pgvector type into a Python list automatically
            cur.execute(
                "SELECT tag_name AS tag, embedding::real[] AS embedding "
                "FROM event_tag_embeddings;"
            )
            return [dict(r) for r in cur.fetchall()]