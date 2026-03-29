# ADR 0001: Monorepo Structure with pnpm Workspaces + Turborepo

**Date:** 2026-03-22
**Status:** Accepted

## Context

SafeRide needs to share types, DB clients, and utilities across multiple backend services, a web admin, and a React Native mobile app. Code duplication across separate repos creates drift and breaks the type contract between producer and consumer.

## Decision

Use a pnpm workspaces monorepo with Turborepo for caching. All deployable apps live in `apps/`, all shared code in `packages/`, all integration adapters in `integrations/adapters/`.

## Consequences

- **Good:** Single source of truth for types (`packages/types`). Turborepo caches build artifacts — subsequent builds are fast. One PR touches API contract + consumers simultaneously.
- **Bad:** Initial setup complexity. All engineers must understand workspace dependency graph.
- **Mitigated by:** `pnpm --filter <service>` lets engineers work on a single service without building the entire monorepo.
