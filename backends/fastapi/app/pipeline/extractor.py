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


# Classifier is loaded lazily (on first use) rather than at import time, and
# resolved relative to this source file rather than the process's current
# working directory. A relative path like "models/logreg.pkl" resolved
# against cwd is fragile — it silently depends on how/where the process was
# started (Docker WORKDIR, systemd unit, pytest invoked from a different
# directory, etc.), and could load a *different* file of the same name
# without any error at all. Loading lazily also means a missing/bad model
# fails loudly the first time extract_event actually runs, instead of
# crashing on import (or on a completely unrelated code path importing this
# module).
_classifier = None


def _resolve_model_path() -> Path:
    model_path = Path(settings.ml_model_path)
    if not model_path.is_absolute():
        # Anchor relative paths to this package's directory rather than cwd.
        model_path = Path(__file__).resolve().parent / model_path
    return model_path

def _resolve_model_path() -> Path:
    """
    Dynamically resolves the absolute path to the ML model from the repo root.
    __file__ points to: .../backends/fastapi/app/pipeline/extractor.py
    .parents[4] points to: .../ (the repo root)
    """
    repo_root = Path(__file__).resolve().parents[4]
    return repo_root / settings.ml_model_path

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

    clean_text = clean_text.replace("*", "").replace("-", "")

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

def assign_tags(embedding: list[float], threshold: float) -> list[str]:
    # Load tag embeddings from DB
    tag_records = db.get_tag_embeddings()
    # expected: [{ "tag": str, "embedding": list[float] }]

    if not tag_records:
        return []

    tag_names = [t["tag"] for t in tag_records]
    tag_vectors = np.array([t["embedding"] for t in tag_records])

    email_vec = np.array(embedding)

    # Normalize
    email_norm = email_vec / np.linalg.norm(email_vec)
    tag_norms = tag_vectors / np.linalg.norm(tag_vectors, axis=1, keepdims=True)

    # Cosine similarity
    scores = np.dot(tag_norms, email_norm)

    ranked = np.argsort(scores)[::-1]

    assigned = []

    # Always take top
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

    except Exception:
        logger.exception("Error in extract_event for %s", email.message_id)
        return None