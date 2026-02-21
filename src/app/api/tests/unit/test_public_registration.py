
from fastapi import APIRouter

from app.core.core_api import public_v1


def test_register_public_subrouter_adds_routes():
    # create a small subrouter and register it
    sub = APIRouter()

    @sub.get("/_test_register")
    def handler():
        return {"ok": True}

    # ensure we can register without error
    public_v1.register_public_subrouter(sub)

    # the public router should now include the test route
    paths = {r.path for r in public_v1.router.routes}
    assert "/_test_register" in paths
