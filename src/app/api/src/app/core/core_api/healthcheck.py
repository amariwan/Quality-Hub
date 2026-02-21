from fastapi import APIRouter

healthcheck_router = APIRouter()

# Health endpoints removed by request. Kept the router object in case health endpoints are re-introduced
# in future but the readiness/liveness routes were intentionally removed to minimize public surface.
