import logging


class LogTypeAdapter(logging.LoggerAdapter):
    def process(self, msg, kwargs):
        # Inject log_type into the extra dict
        extra = kwargs.get("extra", {})
        extra["log_type"] = self.extra["log_type"]
        kwargs["extra"] = extra
        return msg, kwargs
