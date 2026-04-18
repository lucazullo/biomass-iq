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

        # --- Source-refresh scheduler & email alerts (v1.1) ---
        # Address that receives the "source needs update" alert emails.
        self.admin_email: str = os.getenv(
            "BIOMASSIQ_ADMIN_EMAIL", "luca.zullo@verdenero.com"
        )
        # Hours between periodic upstream checks. Default: 24h (daily check ≈ monthly visibility
        # for a dataset that drifts slowly; cheap to run).
        try:
            self.source_check_interval_hours: float = float(
                os.getenv("BIOMASSIQ_SOURCE_CHECK_INTERVAL_HOURS", "24")
            )
        except ValueError:
            self.source_check_interval_hours = 24.0
        # Disable scheduled checks entirely (useful for local dev / tests).
        self.source_check_disabled: bool = (
            os.getenv("BIOMASSIQ_SOURCE_CHECK_DISABLED", "").lower() in ("1", "true", "yes")
        )

        # SMTP config — if any of these are missing, alerts are logged but not emailed.
        self.smtp_host: str | None = os.getenv("BIOMASSIQ_SMTP_HOST") or None
        try:
            self.smtp_port: int = int(os.getenv("BIOMASSIQ_SMTP_PORT", "587"))
        except ValueError:
            self.smtp_port = 587
        self.smtp_user: str | None = os.getenv("BIOMASSIQ_SMTP_USER") or None
        self.smtp_password: str | None = os.getenv("BIOMASSIQ_SMTP_PASSWORD") or None
        self.smtp_from: str = os.getenv(
            "BIOMASSIQ_SMTP_FROM", self.smtp_user or self.admin_email
        )
        self.smtp_use_tls: bool = (
            os.getenv("BIOMASSIQ_SMTP_USE_TLS", "1").lower() in ("1", "true", "yes")
        )


settings = Settings()
