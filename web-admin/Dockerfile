# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

# Workspace manifests first (maximises layer cache)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Shared packages + web-admin
COPY packages/ ./packages/
COPY web-admin/ ./web-admin/

RUN pnpm install --frozen-lockfile

# VITE_ vars are baked into the static bundle at build time.
# CI passes these as --build-arg. They are written to .env at the monorepo
# root because vite.config.ts sets envDir: '..' (one level up from web-admin/).
ARG VITE_AUTH_SERVICE_URL
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID

RUN printf '%s\n' \
    "VITE_AUTH_SERVICE_URL=${VITE_AUTH_SERVICE_URL}" \
    "VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY}" \
    "VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN}" \
    "VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID}" \
    "VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET}" \
    "VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID}" \
    "VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID}" \
    > .env

RUN pnpm --filter web-admin build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default site config
RUN rm /etc/nginx/conf.d/default.conf

COPY web-admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/web-admin/dist /usr/share/nginx/html

EXPOSE 80

# Run as non-root; nginx master still needs port 80 binding
CMD ["nginx", "-g", "daemon off;"]
