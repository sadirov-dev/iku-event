# IKU Events — one container: Bun API that also serves the built React app.

# ---- 1. Build the frontend into static files ----
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. Run the API (and the static frontend) on Bun ----
FROM oven/bun:1.3-alpine
ENV NODE_ENV=production \
    STATIC_DIR=/app/frontend/dist \
    UPLOAD_DIR=/app/backend/uploads
WORKDIR /app/backend
COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# The platform provides PORT; 4000 is the local default.
EXPOSE 4000
# Apply the (idempotent) schema, optionally load demo data, then start.
CMD ["sh", "-c", "bun src/db/migrate.ts && if [ \"$SEED_DEMO_DATA\" = \"true\" ]; then bun src/db/seed.ts; fi && exec bun src/index.ts"]
