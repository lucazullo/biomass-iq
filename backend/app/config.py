import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # DATABASE_URL is the standard env var used by Railway/Heroku; also accept BIOMASSIQ_DATABASE_URL.
    # Use `or` so empty strings (e.g. from an unresolved variable reference) fall back.
    database_url: str = (
        os.getenv("DATABASE_URL")
        or os.getenv("BIOMASSIQ_DATABASE_URL")
        or "postgresql://localhost:5432/biomassiq"
    )
    # Comma-separated list of allowed origins via BIOMASSIQ_CORS_ORIGINS
    # Default includes localhost dev ports.
    cors_origins: list[str] = [
        o.strip()
        for o in os.getenv(
            "BIOMASSIQ_CORS_ORIGINS",
            "http://localhost:3000,http://localhost:3002",
        ).split(",")
        if o.strip()
    ]

    model_config = {"env_prefix": "BIOMASSIQ_"}


settings = Settings()
