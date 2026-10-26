from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from credit_scoring.config import BackendSettings, ConfigurationError  # noqa: E402


class BackendSettingsTests(unittest.TestCase):
    def test_settings_are_loaded_from_environment(self) -> None:
        environment = {
            "BACKEND_URL": "http://localhost:5003/api/",
            "ML_PASSWORD": "12345678",
            "ML_REQUEST_TIMEOUT_SECONDS": "7.5",
        }
        with patch.dict(os.environ, environment, clear=True):
            settings = BackendSettings.from_env()

        self.assertEqual(settings.base_url, "http://localhost:5003/api")
        self.assertEqual(settings.username, "ml")
        self.assertEqual(settings.password, "12345678")
        self.assertEqual(settings.timeout_seconds, 7.5)

    def test_missing_password_is_rejected(self) -> None:
        environment = {}
        with patch.dict(os.environ, environment, clear=True):
            with self.assertRaises(ConfigurationError):
                BackendSettings.from_env()

    def test_current_project_env_needs_only_ml_password(self) -> None:
        with patch.dict(os.environ, {"ML_PASSWORD": "12345678"}, clear=True):
            settings = BackendSettings.from_env()

        self.assertEqual(settings.base_url, "http://localhost:5003/api")
        self.assertEqual(settings.username, "ml")
        self.assertEqual(settings.password, "12345678")
        self.assertEqual(settings.timeout_seconds, 10.0)


if __name__ == "__main__":
    unittest.main()
