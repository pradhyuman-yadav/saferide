# ADR 0002: Phone-First GPS Architecture

**Date:** 2026-03-22
**Status:** Accepted

## Context

AIS-140 hardware GPS devices are legally required on Indian school buses but have a high real-world failure rate (lapsed SIMs, unmaintained firmware, unactivated software dashboards). We cannot build a reliable product on hardware we do not control.

## Decision

The driver's phone is the primary GPS source. AIS-140 hardware is treated as an optional enrichment layer when available. All GPS sources are normalised to `CanonicalGPSEvent` before entering the pipeline — the stream-processor never has `if (source === 'hardware')` branches.

## Consequences

- **Good:** Reliability matches Uber/Ola/Rapido (all phone-first). Zero dependence on hardware we can't control. Eliminates ₹3,000–8,000/bus hardware cost.
- **Bad:** Requires background location permissions from drivers. Battery usage must be managed.
- **Mitigated by:** 5-second broadcast interval, `pausesUpdatesAutomatically: false`, foreground service notification keeps OS from killing the task.
