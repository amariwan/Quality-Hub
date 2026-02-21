import datetime as dt

from app.core.core_logging.AppLogger import journey_logger


class JourneyTracker:
    def __init__(self, request_id):
        self.request_id = request_id
        self.steps = []
        self.success = True

    def add_step(self, description: str = None, data: dict = None, **kwargs):
        # Backward compatibility: support legacy 'descrption' keyword
        if description is None and "descrption" in kwargs:
            description = kwargs.pop("descrption")

        self.steps.append(
            {
                "step": description,
                "data": data or {},
                "timestamp": dt.datetime.utcnow().isoformat(),
            }
        )

    def set_failure(self):
        self.success = False

    def log_journey(self):
        journey_logger.info(
            "Journey log",
            extra={
                "log_type": "JOURNEY",
                "request_id": self.request_id,
                "success": self.success,
                "steps": self.steps,
            },
        )
