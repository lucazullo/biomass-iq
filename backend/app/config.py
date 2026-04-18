import os


def _parse_cors(value: str | None) -> list[str]:
    if not value:
        return ["http://localhost:3000", "http://localhost:3002"]
    value = value.strip()
    if value == "*":
        return ["*"]
    return [o.strip() for o in value.split(",") if o.strip()]


class Settings:
    """Minimal settings object — Pydantic Settings' automatic env parsing
    interferes with list-type fields, so we do it manually."""

    def __init__(self) -> None:
        # DATABASE_URL is the standard env var used by Render/Railway/Heroku
        self.database_url: str = (
            os.getenv("DATABASE_URL")
            or os.getenv("BIOMASSIQ_DATABASE_URL")
            or "postgresql://localhost:5432/biomassiq"
        )
        self.cors_origins: list[str] = _parse_cors(os.getenv("BIOMASSIQ_CORS_ORIGINS"))


settings = Settings()
