from pathlib import Path

from fastapi import FastAPI, Request
from pyinstrument import Profiler
from pyinstrument.renderers.html import HTMLRenderer
from pyinstrument.renderers.speedscope import SpeedscopeRenderer

current_dir = Path(__file__).parent


def register_profiling_middleware(app: FastAPI, profiling_enabled: bool = False):
    """
    Registers a PyInstrument-based profiling middleware.

    When PROFILING_ENABLED is True, you can trigger profiling by adding:
      ?profile=1&profile_format=html
    or
      ?profile=1&profile_format=speedscope
    to your request URL.

    Example:
      GET /api/v1/contracts?profile=1&profile_format=html
    """
    if not profiling_enabled:
        return

    @app.middleware("http")
    async def profile_request(request: Request, call_next):
        if not request.query_params.get("profile"):
            # Normal request, no profiling
            return await call_next(request)

        profile_type = request.query_params.get("profile_format", "speedscope")
        renderers = {
            "html": (HTMLRenderer, "html"),
            "speedscope": (SpeedscopeRenderer, "speedscope.json"),
        }

        renderer_class, ext = renderers.get(
            profile_type, (SpeedscopeRenderer, "speedscope.json")
        )

        with Profiler(interval=0.001, async_mode="enabled") as profiler:
            response = await call_next(request)

        # Save the profiling output , but needs refactoring later
        out_path = current_dir / f"../../profile.{ext}"
        with out_path.open("w") as out:
            out.write(profiler.output(renderer=renderer_class()))

        return response
