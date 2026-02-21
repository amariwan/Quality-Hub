import datetime as dt
import json
import logging
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

LOG_RECORD_BUILTIN_ATTRS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
}


class MyJSONFormatter(logging.Formatter):
    def __init__(self, *, fmt_keys: dict[str, str] | None = None):
        super().__init__()
        self.fmt_keys = fmt_keys if fmt_keys is not None else {}

    def format(self, record: logging.LogRecord) -> str:
        message = self._prepare_log_dict(record)
        return json.dumps(message, default=str)

    def _prepare_log_dict(self, record: logging.LogRecord):
        try:
            berlin_tz = ZoneInfo("Europe/Berlin")
        except ZoneInfoNotFoundError:
            # Fallback to UTC if system tzdata is not available (common on some minimal Windows installs)
            berlin_tz = dt.UTC

        # These fields will always be included in the JSON log output, regardless of the configuration in stdout_config.json.
        # The goal is to define a minimal, consistent log structure here.
        # For specialized logging needs, you can create and configure custom loggers and  extend them with additional keywords
        always_fields = {
            "level": record.levelname,
            "message": record.getMessage(),
            "timestamp": dt.datetime.fromtimestamp(
                record.created, tz=berlin_tz
            ).isoformat(),
            "log_type": getattr(record, "log_type", "SINGLE"),
        }
        if record.exc_info is not None:
            always_fields["exec_info"] = self.formatException(record.exc_info)

        if record.stack_info is not None:
            always_fields["stack_info"] = self.formatStack(record.stack_info)

        message = {
            key: (
                msg_val
                if (msg_val := always_fields.pop(val, None)) is not None
                else getattr(record, val)
            )
            for key, val in self.fmt_keys.items()
        }
        message.update(always_fields)

        for key, val in record.__dict__.items():
            if key not in LOG_RECORD_BUILTIN_ATTRS:
                message[key] = val

        return message
