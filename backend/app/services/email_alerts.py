"""Lightweight email notifications for admin alerts.

Uses stdlib `smtplib`. If SMTP isn't configured via env vars, the alert is
logged to stdout but never sent — so the scheduler still works in dev without
needing SMTP credentials.
"""

import smtplib
import ssl
from email.message import EmailMessage

from app.config import settings


def send_admin_alert(subject: str, body: str) -> tuple[bool, str]:
    """Attempt to send `body` to `settings.admin_email` with `subject`.

    Returns (sent, message). `sent=False` does not mean an error — it also
    covers the common case where SMTP isn't configured (we log instead).
    """
    to_addr = settings.admin_email
    from_addr = settings.smtp_from
    host = settings.smtp_host

    # Always log so you can see what would have been sent.
    print(
        f"[email] admin alert → {to_addr}\n"
        f"[email]   subject: {subject}\n"
        f"[email]   body: {body[:500]}"
        + ("..." if len(body) > 500 else ""),
        flush=True,
    )

    if not host:
        return False, "SMTP not configured (BIOMASSIQ_SMTP_HOST missing) — alert logged only"

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to_addr
        msg.set_content(body)

        if settings.smtp_use_tls:
            ctx = ssl.create_default_context()
            with smtplib.SMTP(host, settings.smtp_port, timeout=20) as s:
                s.starttls(context=ctx)
                if settings.smtp_user and settings.smtp_password:
                    s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, settings.smtp_port, timeout=20) as s:
                if settings.smtp_user and settings.smtp_password:
                    s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        return True, f"sent to {to_addr} via {host}"
    except Exception as exc:  # noqa: BLE001
        return False, f"SMTP error: {type(exc).__name__}: {exc}"
