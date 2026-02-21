"""Deprecated shim: Render endpoints moved to the service presentation layer.

This module re-exports the core public router for backwards compatibility so that
other modules importing `core.core_api.render` continue to work without importing
service implementation modules from `core`.
"""

from app.core.core_api.public_v1 import router

__all__ = ["router"]
