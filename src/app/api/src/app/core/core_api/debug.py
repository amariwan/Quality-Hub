import asyncio
from concurrent.futures import ThreadPoolExecutor
from time import sleep

from fastapi import APIRouter

debug_router = APIRouter()
executor = ThreadPoolExecutor()


# -----------------------------
# CPU-heavy and IO-heavy helpers
# -----------------------------
def _cpu_heavy_task(n: int) -> int:
    # simulate CPU-intensive work
    s = 0
    for i in range(n):
        s += i**2
    return s


async def async_cpu_task(n: int) -> int:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, _cpu_heavy_task, n)


def _io_heavy_task():
    # simulate blocking I/O
    sleep(5)
    return "IO done"


async def async_io_task() -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, _io_heavy_task)


# -----------------------------
# Endpoints
# -----------------------------
@debug_router.get("/debug/test-heavy-tasks")
async def test_heavy_tasks():
    """
    Test CPU-heavy and IO-heavy functions without blocking FastAPI.
    Returns results and execution time.
    """
    import time

    start = time.time()

    # run both tasks concurrently
    cpu_future = async_cpu_task(1_000_000)
    io_future = async_io_task()
    cpu_result, io_result = await asyncio.gather(cpu_future, io_future)

    duration = time.time() - start
    return {"cpu_result": cpu_result, "io_result": io_result, "duration_seconds": duration}
