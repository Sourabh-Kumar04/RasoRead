import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from core.config import settings
import logging

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
    """Send an email using SMTP configuration."""
    if not settings.SMTP_HOST:
        logger.warning(f"SMTP_HOST not configured. Would send email to {to_email}: {subject}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        part1 = MIMEText(text_body or "", "plain")
        part2 = MIMEText(html_body, "html")
        msg.attach(part1)
        msg.attach(part2)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())

        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def send_verification_email(to_email: str, token: str, base_url: str = "http://localhost:3000") -> bool:
    """Send email verification link."""
    verify_url = f"{base_url}/verify?token={token}"
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to RasoRead!</h2>
        <p>Please verify your email address by clicking the button below:</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{verify_url}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Verify Email</a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6366f1;">{verify_url}</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">This link expires in 24 hours.</p>
    </body>
    </html>
    """
    text = f"Welcome to RasoRead! Please verify your email: {verify_url}"
    return send_email(to_email, "Verify your RasoRead email", html, text)


def send_password_reset_email(to_email: str, token: str, base_url: str = "http://localhost:3000") -> bool:
    """Send password reset link."""
    reset_url = f"{base_url}/reset-password?token={token}"
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset your RasoRead password</h2>
        <p>You requested a password reset. Click the button below to create a new password:</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{reset_url}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6366f1;">{reset_url}</p>
        <p style="color: #666; font-size: 12px;">This link expires in 1 hour.</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">If you didn't request this, please ignore this email.</p>
    </body>
    </html>
    """
    text = f"Reset your RasoRead password: {reset_url}"
    return send_email(to_email, "Reset your RasoRead password", html, text)