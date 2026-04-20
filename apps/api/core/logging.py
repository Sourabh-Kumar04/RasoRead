"""
Structured JSON logging for RasoRead API.
Outputs machine-parseable logs in production, human-readable in dev.
"""
import logging
import sys
import json
from datetime import datetime, timezone
from typing import Any

from core.config import settings


class JSONFormatter(logging.Formatter):
    """Emit log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_obj["exc"] = self.formatException(record.exc_info)
        if hasattr(record, "extra"):
            log_obj.update(record.extra)  # type: ignore
        return json.dumps(log_obj, default=str)


def setup_logging() -> None:
    """Call once at app startup."""
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if settings.ENVIRONMENT == "development" else logging.INFO)

    handler = logging.StreamHandler(sys.stdout)

    if settings.ENVIRONMENT == "production":
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)-8s %(name)s — %(message)s",
                datefmt="%H:%M:%S",
            )
        )

    root.handlers.clear()
    root.addHandler(handler)

    # Quieten noisy third-party loggers
    for noisy in ("httpx", "httpcore", "openai", "boto3", "botocore", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
