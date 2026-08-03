# syntax=docker/dockerfile:1

# Multi-stage build for the Sitbaby Next.js app.
FROM node:20-alpine AS base
WORKDIR /app
# Prisma needs openssl at build and run time on Alpine.
RUN apk add --no-cache openssl

# --- Dependencies (all deps, including dev deps needed for build + migrate/seed) ---
FROM base AS deps
COPY package.json package-lock.json ./
# Schema is needed here because `postinstall` runs `prisma generate`.
COPY prisma ./prisma
RUN npm ci

# --- Build ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# --- Runtime ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Full node_modules is retained so the Prisma CLI (migrate deploy) and tsx
# (seed) are available at container start — convenient for a dev environment.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
# tsconfig.json is needed so tsx can resolve the `@/` path aliases when seeding.
COPY package.json package-lock.json next.config.mjs tsconfig.json ./
COPY prisma ./prisma
# `prisma db seed` runs prisma/seed.ts which imports from src/lib.
COPY src ./src
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
