# Stage 1: build the React/Vite frontend with the correct Linux native dependencies.
FROM node:24-bookworm-slim AS web-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Same-domain /api routes are served by FastAPI in the final image.
ENV VITE_API_BASE_URL=""
RUN npm run build

# Stage 2: small Python runtime containing both the backend and the built frontend.
FROM python:3.13-slim-bookworm
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    OPENBLAS_NUM_THREADS=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMBA_NUM_THREADS=1 \
    PORT=10000
WORKDIR /app
COPY backend/requirements-deploy.txt ./requirements-deploy.txt
RUN pip install --no-cache-dir --prefer-binary -r requirements-deploy.txt
COPY backend/ ./backend/
COPY deploy_app.py ./deploy_app.py
COPY --from=web-build /build/frontend/dist ./frontend/dist
EXPOSE 10000
CMD ["sh", "-c", "exec uvicorn deploy_app:app --host 0.0.0.0 --port ${PORT:-10000}"]
