"""Production ASGI entrypoint: one origin for Cardio Atlas UI and FastAPI.

Run: uvicorn deploy_app:app --host 0.0.0.0 --port 10000
The regular developer workflow (python run.py) remains unchanged.
"""
from pathlib import Path
import os

from fastapi.staticfiles import StaticFiles
from backend.main import app

ROOT = Path(__file__).resolve().parent
DIST = Path(os.getenv("CARDIO_FRONTEND_DIST", ROOT / "frontend" / "dist")).resolve()
if not (DIST / "index.html").is_file():
    raise RuntimeError(
        "Frontend production build is missing. Run `npm ci && npm run build` "
        "from frontend/ first, or deploy using the supplied Dockerfile. "
        f"Expected: {DIST / 'index.html'}"
    )

# The development backend exposes an informational JSON response at GET /.
# Replace only that route in production so the actual React site opens at /.
app.router.routes[:] = [
    route for route in app.router.routes
    if not (getattr(route, "path", None) == "/" and "GET" in (getattr(route, "methods", set()) or set()))
]

# This mount is intentionally registered AFTER the existing /api/* and /docs routes,
# which preserves model prediction, explanation, what-if, and dataset endpoints.
app.mount("/", StaticFiles(directory=str(DIST), html=True), name="cardio-atlas-frontend")
