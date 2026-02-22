from __future__ import annotations

# Route modules register their endpoints on the shared router via side effects.
from app.services.quality_hub.api.ops_center import routes_crud as _routes_crud  # noqa: F401
from app.services.quality_hub.api.ops_center import routes_insights as _routes_insights  # noqa: F401
from app.services.quality_hub.api.ops_center import routes_overview as _routes_overview  # noqa: F401
from app.services.quality_hub.api.ops_center.router import router

__all__ = ["router"]
