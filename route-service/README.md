# route-service

Manages the core operational data for SafeRide — buses, routes, stops, students, and drivers. Called by the web admin, mobile app (parent + driver), and the real-time pipeline once built.

## Responsibility

**Owns:** `buses`, `routes`, `stops`, `students`, `drivers` Firestore collections.

**Does NOT own:** authentication (auth-service), tenant onboarding (tenant-service), GPS telemetry (trip-service, planned), live tracking (livetrack-gateway, planned).

## Local Development

```bash
# Prerequisites
cp .env.example .env   # fill in FIREBASE_SERVICE_ACCOUNT_JSON
pnpm install

# Start with hot reload
pnpm dev               # starts on port 4003

# Run tests
pnpm test
pnpm test:coverage
```

## Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| NODE_ENV | yes | Runtime environment | `development` |
| PORT | yes | HTTP port | `4003` |
| FIREBASE_SERVICE_ACCOUNT_JSON | yes | Firebase Admin SDK credentials as single-line JSON | `{"type":"service_account",...}` |
| CORS_ORIGINS | no | Comma-separated allowed origins | `http://localhost:5173` |
| LOG_LEVEL | no | Pino log level | `info` |

## API Reference

Base URL: `/api/v1`

All responses use the standard envelope:
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "...", "message": "..." } }
```

---

### Buses

#### GET /api/v1/buses
Lists all buses for the authenticated user's school.

**Auth**: Bearer token · **Role**: `school_admin`, `manager`, `driver` · **Rate limit**: 120 req/min

**Success (200):**
```json
{ "success": true, "data": [{ "id": "abc123", "registrationNumber": "KA01AB1234", ... }] }
```

---

#### GET /api/v1/buses/:id
Get a single bus by ID.

**Auth**: Bearer token · **Role**: `school_admin`, `manager`, `driver`

**Success (200):** `{ "success": true, "data": { "id": "...", ... } }`

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| UNAUTHORIZED | 401 | Missing or expired token |
| FORBIDDEN | 403 | Insufficient role |
| BUS_NOT_FOUND | 404 | Bus does not exist or belongs to another tenant |

---

#### POST /api/v1/buses
Create a new bus for the school.

**Auth**: Bearer token · **Role**: `school_admin`, `manager`

**Request body:**
```json
{
  "registrationNumber": "KA01AB1234",
  "make": "Tata",
  "model": "Starbus",
  "year": 2020,
  "capacity": 40,
  "driverFirebaseUid": null
}
```

**Success (201):** `{ "success": true, "data": { "id": "...", "status": "active", ... } }`

**Side effects:** Audit log entry `BUS_CREATED`.

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| VALIDATION_ERROR | 400 | Missing or invalid fields |
| UNAUTHORIZED | 401 | Missing or expired token |
| FORBIDDEN | 403 | Insufficient role |

---

#### PATCH /api/v1/buses/:id
Update one or more fields on a bus. Only provided fields are changed.

**Auth**: Bearer token · **Role**: `school_admin`, `manager`

**Request body** (all fields optional, at least one required):
```json
{
  "capacity": 45,
  "status": "maintenance"
}
```

**Success (200):** `{ "success": true, "data": { "id": "...", ... } }`

**Side effects:** Audit log entry `BUS_UPDATED`.

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| VALIDATION_ERROR | 400 | Invalid fields |
| BUS_NOT_FOUND | 404 | Bus not found or wrong tenant |

---

#### DELETE /api/v1/buses/:id
Soft-delete a bus — sets `status` to `inactive`. The record is preserved for historical trips.

**Auth**: Bearer token · **Role**: `school_admin`

**Success (204):** No body.

**Side effects:** Audit log entry `BUS_DELETED`.

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| BUS_NOT_FOUND | 404 | Bus not found or wrong tenant |

---

## Firestore Collections

| Collection | Reads | Writes | tenantId isolation |
|---|---|---|---|
| `buses` | ✅ listByTenantId, findById | ✅ create, update | `.where('tenantId', '==', tenantId)` on every list query; tenantId verified on findById |

## Production Deployment

See root `docs/deployment.md` for full production setup.

Service-specific notes:
- Runs as a stateless container; min 1 replica, max 3 replicas
- No persistent disk needed — all state in Firestore
- Memory: 256 MB is sufficient for this service at Phase 1 load

## Architecture Notes

- **Soft deletes**: buses are never hard-deleted. Setting `status: inactive` preserves historical trip data. If a bus is being decommissioned but has active trips, the trip-service (Phase 2) will handle that transition.
- **tenantId isolation**: enforced at two layers — (1) Firestore query `.where('tenantId', '==', tenantId)` and (2) service-layer check `bus.tenantId !== tenantId` after findById. Both layers must pass.
- **driverFirebaseUid**: stores the Firebase UID of the currently assigned driver. Linked to `users/{uid}` in Firestore. When the driver is reassigned, this field is updated via PATCH.
