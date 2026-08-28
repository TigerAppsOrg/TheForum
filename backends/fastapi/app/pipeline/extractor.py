"""
Embedding-based event extraction pipeline.
Replaces LLM extraction with:
- cleaned text
- embeddings
- logistic regression classifier
- cosine similarity tagging
"""

import logging
import re
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
from bs4 import BeautifulSoup
from openai import OpenAI

from . import db  # expected to load tag embeddings from DB
from .config import settings
from .parser import PreprocessedEmail

logger = logging.getLogger(__name__)


# =========================
# Data Models
# =========================

@dataclass
class ExtractedEvent:
    title: str
    description: str
    datetime_str: str
    end_datetime_str: str | None
    location_name: str
    tags: list[str]


# =========================
# Client + Model Loading
# =========================

# Module-level singleton — reused across calls instead of constructing a new
# OpenAI client per email.
_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
        )
    return _client


# Classifier is loaded lazily (on first use) rather than at import time, so a
# missing/bad model fails loudly the first time extract_event actually runs,
# instead of crashing on import (or on a completely unrelated code path
# importing this module).
_classifier = None


def _resolve_model_path() -> Path:
    """Resolve settings.ml_model_path anchored to the repo root, not the cwd.

    A relative path like "models/event_classifier_model.joblib" resolved
    against cwd would silently depend on how/where the process was started
    (Docker WORKDIR, systemd unit, pytest invoked from a different directory).
    __file__ is .../backends/fastapi/app/pipeline/extractor.py, so parents[4]
    is the repo root. Absolute paths are respected as-is.
    """
    model_path = Path(settings.ml_model_path)
    if model_path.is_absolute():
        return model_path
    repo_root = Path(__file__).resolve().parents[4]
    return repo_root / model_path

def _get_classifier():
    global _classifier
    if _classifier is None:
        model_path = _resolve_model_path()
        if not model_path.exists():
            raise FileNotFoundError(
                f"ML classifier not found at {model_path} "
                f"(settings.ml_model_path={settings.ml_model_path!r}). "
                "Check the path is correct and the model file has been deployed."
            )
        logger.info("Loading classifier from %s", model_path)
        _classifier = joblib.load(model_path)
    return _classifier


# =========================
# CLEANING
# =========================

def clean_body_text(html_content: str) -> str:
    if not html_content:
        return ""

    soup = BeautifulSoup(html_content, "html.parser")
    clean_text = soup.get_text(separator=" ", strip=True)

    boilerplate_marker = "This email was instantly sent"
    if boilerplate_marker in clean_text:
        clean_text = clean_text.split(boilerplate_marker)[0]

    # Strip markdown-style emphasis noise. Keep hyphens — removing them would
    # corrupt times ("3-5pm" → "35pm") and hyphenated words in the visible
    # description as well as the embedded text.
    clean_text = clean_text.replace("*", "")

    keywords_to_remove = [
        "forwarded message",
        "listservs",
        "subscribe",
        "unsubscribe",
        "hoagie@princeton.edu",
    ]

    parts = re.split(r'([.!?\n]+)', clean_text)
    cleaned_parts = []

    for i in range(0, len(parts), 2):
        sentence = parts[i]
        punctuation = parts[i + 1] if i + 1 < len(parts) else ""

        if not any(kw in sentence.lower() for kw in keywords_to_remove):
            cleaned_parts.append(sentence + punctuation)

    clean_text = "".join(cleaned_parts)
    clean_text = re.sub(r"\s+", " ", clean_text).strip()

    return clean_text


# =========================
# EMBEDDING
# =========================

def generate_embedding(client: OpenAI, text: str) -> list[float]:
    response = client.embeddings.create(
        input=text,
        model=settings.embedding_model
    )
    return response.data[0].embedding


# =========================
# CLASSIFICATION
# =========================

def classify_event(embedding: list[float]) -> bool:
    classifier = _get_classifier()
    vec = np.array(embedding).reshape(1, -1)
    prediction = classifier.predict(vec)[0]
    return bool(prediction)


# =========================
# COSINE SIMILARITY TAGGING
# =========================

# Tag embeddings are static per deployment (seeded into the DB), so fetch and
# normalize them once instead of a full table scan + numpy rebuild per email.
_tag_cache: tuple[list[str], np.ndarray] | None = None


def _get_tag_matrix() -> tuple[list[str], np.ndarray] | None:
    """Return (tag_names, L2-normalized embedding matrix), cached after first load."""
    global _tag_cache
    if _tag_cache is None:
        tag_records = db.get_tag_embeddings()
        # expected: [{ "tag": str, "embedding": list[float] }]
        if not tag_records:
            return None
        tag_names = [t["tag"] for t in tag_records]
        tag_vectors = np.array([t["embedding"] for t in tag_records])
        tag_norms = tag_vectors / np.linalg.norm(tag_vectors, axis=1, keepdims=True)
        _tag_cache = (tag_names, tag_norms)
    return _tag_cache


def assign_tags(embedding: list[float], threshold: float) -> list[str]:
    cached = _get_tag_matrix()
    if cached is None:
        return []
    tag_names, tag_norms = cached

    email_vec = np.array(embedding)
    email_norm = email_vec / np.linalg.norm(email_vec)

    # Cosine similarity
    scores = np.dot(tag_norms, email_norm)

    ranked = np.argsort(scores)[::-1]

    assigned = []

    # Always take the top tag so every event gets at least one, even when
    # nothing clears the threshold.
    top_idx = ranked[0]
    assigned.append(tag_names[top_idx])

    # Add more if above threshold
    for i in ranked[1:]:
        if scores[i] >= threshold:
            assigned.append(tag_names[i])
        else:
            break

    return assigned


# =========================
# MAIN PIPELINE
# =========================

def extract_event(email: PreprocessedEmail) -> ExtractedEvent | None:
    """
    Full pipeline:
    clean → embed → classify → tag (if event)
    """

    client = _get_client()

    try:
        # 1. CLEAN TEXT
        cleaned_body = clean_body_text(email.body_text)

        combined_text = f"Subject: {email.subject} Body: {cleaned_body}"

        # 2. EMBEDDING
        embedding = generate_embedding(client, combined_text)

        # 3. CLASSIFY
        is_event = classify_event(embedding)

        if not is_event:
            return None

        # 4. TAGGING
        tags = assign_tags(
            embedding,
            threshold=settings.tag_similarity_threshold,
        )

        # 5. RETURN STRUCTURE
        return ExtractedEvent(
            title=email.subject[:200],
            description=cleaned_body[:2000],
            datetime_str="",                # not extracted in ML version
            end_datetime_str=None,
            location_name="",
            tags=tags,
        )

    except FileNotFoundError:
        # Deployment/config problem (e.g. missing model file) — every email
        # would fail identically, so propagate instead of silently dropping
        # 100% of traffic one message at a time.
        raise
    except Exception:
        logger.exception("Error in extract_event for %s", email.message_id)
        return None
