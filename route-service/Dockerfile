# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/      ./packages/
COPY route-service/ ./route-service/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@saferide/*" run build
RUN pnpm --filter saferide-route-service run build
RUN pnpm --filter saferide-route-service deploy --prod /deploy

# ── Stage 2: Run ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /deploy .

EXPOSE 4003
CMD ["node", "dist/index.js"]
