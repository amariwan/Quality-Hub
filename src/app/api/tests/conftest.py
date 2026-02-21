"""
Test configuration for pytest.

This file ensures the application runs with DB disabled during tests so DB drivers
(like `psycopg`) are not required for unit tests that don't need a database.
"""
import os

# Ensure DB is disabled for the test session (read by AppSettings/DbSettings)
os.environ.setdefault("DB_ENABLED", "false")
