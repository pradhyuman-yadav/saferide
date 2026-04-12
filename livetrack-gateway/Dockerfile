# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/          ./packages/
COPY livetrack-gateway/ ./livetrack-gateway/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@saferide/*" run build
RUN pnpm --filter saferide-livetrack-gateway run build
RUN pnpm --filter saferide-livetrack-gateway deploy --prod --legacy /deploy

# ── Stage 2: Run ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /deploy .

EXPOSE 4005
CMD ["node", "dist/index.js"]
