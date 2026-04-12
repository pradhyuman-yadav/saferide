# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

# Workspace manifests first (maximises layer cache)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./

# Shared packages + this service
COPY packages/     ./packages/
COPY auth-service/ ./auth-service/

# Install everything (devDeps needed for tsc)
RUN pnpm install --frozen-lockfile

# Build shared packages, then the service
RUN pnpm --filter "@saferide/*" run build
RUN pnpm --filter saferide-auth-service run build

# Produce a self-contained production deployment (resolves workspace deps)
RUN pnpm --filter saferide-auth-service deploy --prod /deploy

# ── Stage 2: Run ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Copy the self-contained deployment from builder
COPY --from=builder /deploy .

EXPOSE 4001

# Env vars are injected by Docker Compose (env_file: .env) — no --env-file needed
CMD ["node", "dist/index.js"]
