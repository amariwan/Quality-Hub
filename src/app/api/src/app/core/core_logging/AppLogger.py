import json
import logging.config
import pathlib
from logging import getLogger

from app.config import get_app_settings
from app.core.core_logging.LogTypeAdapter import LogTypeAdapter

fastapi_logger = logging.getLogger("app_logger")


system_logger = LogTypeAdapter(getLogger("system"), {"log_type": "SYSTEM"})
single_logger = LogTypeAdapter(getLogger("single"), {"log_type": "SINGLE"})
journey_logger = LogTypeAdapter(getLogger("journey"), {"log_type": "JOURNEY"})


def setup_logging():
    app_settings = get_app_settings()
    print(f"The setup loggin said: {app_settings.LOG_LEVEL.value}")
    config_file = pathlib.Path(__file__).parent / "logger_config_files/stdout_config.json"
    with config_file.open() as f_in:
        logger_config = json.load(f_in)

    # Update root level
    if "root" in logger_config.get("loggers", {}):
        logger_config["loggers"]["root"]["level"] = app_settings.LOG_LEVEL.value

    # Update any explicitly defined loggers
    for logger_name in ["app_logger", "system", "single", "journey"]:
        if logger_name in logger_config.get("loggers", {}):
            logger_config["loggers"][logger_name]["level"] = app_settings.LOG_LEVEL.value

    logging.config.dictConfig(logger_config)


setup_logging()
