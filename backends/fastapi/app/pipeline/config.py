"""Pipeline configuration and environment variables."""

import os
from pydantic_settings import BaseSettings


class PipelineSettings(BaseSettings):
    """Settings for the listserv ingestion pipeline."""

    # =========================
    # Gmail API
    # =========================
    gmail_credentials_json: str = ""
    gmail_token_path: str = os.path.join(
        os.path.dirname(__file__), "..", "..", "gmail_token.json"
    )

    # =========================
    # Database
    # =========================
    database_url: str = ""

    # =========================
    # Admin
    # =========================
    admin_api_key: str = ""

    # =========================
    # Dedup
    # =========================
    dedup_title_threshold: float = 0.75
    dedup_time_window_hours: int = 24

    # =========================
    # OpenRouter / Embeddings
    # =========================
    # OPENROUTER_API_KEY is in .env
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    embedding_model: str = "openai/text-embedding-3-small"

    # =========================
    # ML + Tagging
    # =========================
    ml_model_path: str = "models/event_classifier_model.joblib"
    tag_similarity_threshold: float = 0.35

    # =========================
    # Pydantic config
    # =========================
    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }


settings = PipelineSettings()
