from __future__ import annotations

import os
from dataclasses import dataclass


class ConfigurationError(RuntimeError):
    """Raised when a required service setting is absent or invalid."""


@dataclass(frozen=True)
class BackendSettings:
    base_url: str
    username: str
    password: str
    timeout_seconds: float = 10.0

    @classmethod
    def from_env(cls) -> "BackendSettings":
        return cls(
            base_url=os.getenv("BACKEND_URL", "http://localhost:5003/api").rstrip("/"),
            username="ml",
            password=_required_env("ML_PASSWORD"),
            timeout_seconds=_positive_float_env("ML_REQUEST_TIMEOUT_SECONDS", 10.0),
        )


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or not value.strip():
        raise ConfigurationError(f"Required environment variable {name} is not set")
    return value.strip()


def _positive_float_env(name: str, default: float) -> float:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        value = float(raw_value)
    except ValueError as exc:
        raise ConfigurationError(f"Environment variable {name} must be numeric") from exc
    if value <= 0:
        raise ConfigurationError(f"Environment variable {name} must be positive")
    return value
