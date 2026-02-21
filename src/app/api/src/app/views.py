import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_app_settings, get_db_settings
from app.core.core_api.public_v1 import router as public_v1_router
from app.core.core_db.async_db_session_maker import sessionmanager
from app.core.core_middleware.profiler_middleware import register_profiling_middleware

# -----------------------------
# Application Factory
# -----------------------------
# Provides a fresh FastAPI instance each time it's called.


# -----------------------------
# Lifespan (startup/shutdown) logic
# -----------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles startup and shutdown events for the FastAPI app.
    - Reads application and database settings
    - Prints startup info
    - Provides a hook for shutdown cleanup (e.g., closing DB connections)
    """
    app_settings = get_app_settings()
    db_settings = get_db_settings()

    print(f"Starting app with LOG_LEVEL {app_settings.LOG_LEVEL}")
    if db_settings.DB_ENABLED:
        print(f"Connecting to DB= {db_settings.DB_DATABASE} on Port {db_settings.DB_PORT}")
    else:
        print("Database disabled - not connecting to DB")


    yield
    if sessionmanager._engine is not None:
        # Close the DB connection
        await sessionmanager.close()


    print("Shutting down Server.Cleaning up resources")


def create_app() -> FastAPI:
    app_settings = get_app_settings()

    new_app_instance = FastAPI(title="Template Project", lifespan=lifespan)

    # Optional: enable CORS for local demo servers when DEMO_CORS_ORIGINS env var is set
    # Example: DEMO_CORS_ORIGINS="http://127.0.0.1:5500" or "*"
    cors_env = os.environ.get("DEMO_CORS_ORIGINS")
    if cors_env:
        if cors_env.strip() == "*":
            cors_list = ["*"]
        else:
            cors_list = [o.strip() for o in cors_env.split(",") if o.strip()]
        new_app_instance.add_middleware(
            CORSMiddleware,
            allow_origins=cors_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # import all needed routes /api -endpoints)
    # Health endpoints removed by request: do not include healthcheck_router

    # Only include the minimal public API routers requested: templates + buildDoc

    new_app_instance.include_router(public_v1_router)

    # Templates listing and management
    from app.core.core_api.templates_v1 import router as templates_v1_router

    new_app_instance.include_router(templates_v1_router)

    # Configuration API
    from app.core.core_api.config_v1 import router as config_v1_router

    new_app_instance.include_router(config_v1_router)

    # Advanced Features API (Analytics, Batch, Versioning, Webhooks)
    from app.core.core_api.advanced_v1 import router as advanced_v1_router

    new_app_instance.include_router(advanced_v1_router)

    # Static demo frontend mounted at /demo
    from pathlib import Path

    from fastapi.staticfiles import StaticFiles
    demo_dir = Path(__file__).parents[3] / "static" / "demo"
    if demo_dir.exists():
        new_app_instance.mount("/demo", StaticFiles(directory=str(demo_dir)), name="demo")


    # Here, register all the middlewares that are needed
    # register  profiler (toggles via config/env)
    register_profiling_middleware(
        new_app_instance, profiling_enabled=app_settings.PROFILING_ENABLED
    )

    return new_app_instance


app = create_app()
