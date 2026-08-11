# OrangTask, single-image build: builds the frontend, serves it from the Bun backend.
FROM oven/bun:1.3-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install
COPY frontend/ ./
RUN bun run build

FROM oven/bun:1.3-alpine AS backend
WORKDIR /app/backend
COPY backend/package.json backend/bun.lock* ./
RUN bun install --production
COPY backend/ ./
COPY android/app/src/main/res /app/android/app/src/main/res
RUN bun run i18n:build

# Final image
FROM oven/bun:1.3-alpine
WORKDIR /app
COPY --from=backend /app/backend ./backend
COPY --from=frontend /app/frontend/dist ./backend/public
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["bun", "run", "src/index.ts"]
