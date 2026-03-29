# trip-service

Records driver GPS trips and telemetry; serves live location to parent and manager clients.

## Responsibility

Owns the `trips` and `gpsTelemetry` Firestore collections. Does **not** own buses, routes, stops, students, or drivers — those belong to `route-service`.

## Local Development

```bash
cp .env.example .env   # fill in FIREBASE_SERVICE_ACCOUNT_JSON
pnpm install

pnpm dev               # starts on port 4004 with hot reload
pnpm test
pnpm test:coverage
```

## Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `NODE_ENV` | yes | Runtime environment | `development` |
| `PORT` | yes | HTTP port | `4004` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | yes | Firebase Admin SDK credentials (single-line JSON) | `{"type":"service_account",...}` |
| `CORS_ORIGINS` | no | Comma-separated allowed origins | `http://localhost:5173` |
| `LOG_LEVEL` | no | Pino log level | `info` |

## API Reference

All endpoints require a valid Firebase ID token in `Authorization: Bearer <token>`.

---

### POST /api/v1/trips
Start a new trip.

**Auth**: Bearer token · **Role**: `driver` · **Rate limit**: 300 req/min

**Request body:**
```json
{ "busId": "abc123", "routeId": "xyz789" }
```

**Success (201):**
```json
{ "success": true, "data": { "id": "t1", "status": "active", "startedAt": 1700000000000, ... } }
```

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| `TRIP_ALREADY_ACTIVE` | 409 | Driver already has an active trip |
| `VALIDATION_ERROR` | 400 | Missing busId or routeId |
| `UNAUTHORIZED` | 401 | No / expired token |
| `FORBIDDEN` | 403 | Not a driver |

---

### POST /api/v1/trips/:id/end
End an active trip.

**Auth**: Bearer token · **Role**: `driver`

**Success (200):** updated Trip object with `status: "ended"` and `endedAt`.

**Errors:** `TRIP_NOT_FOUND` (404), `TRIP_NOT_OWNED` (403), `TRIP_ALREADY_ENDED` (409)

---

### GET /api/v1/trips/active
Get the calling driver's active trip (or `null`).

**Auth**: Bearer token · **Role**: `driver`

**Success (200):** `{ "success": true, "data": Trip | null }`

---

### GET /api/v1/trips/bus/:busId/active
Get the active trip for a bus — polled by parent apps.

**Auth**: Bearer token · **Role**: `parent`, `manager`, `school_admin`

**Success (200):** `{ "success": true, "data": Trip | null }`

The Trip object includes denormalized `latestLat`, `latestLon`, `latestSpeed`, `latestHeading`, `latestRecordedAt` — fast reads without an extra telemetry query.

---

### POST /api/v1/trips/:id/location
Driver sends a GPS ping.

**Auth**: Bearer token · **Role**: `driver` · **Rate limit**: 60 req/min per device

**Request body:**
```json
{
  "lat": 12.9716,
  "lon": 77.5946,
  "speed": 32.5,
  "heading": 180,
  "accuracy": 5,
  "recordedAt": 1700000000000
}
```

**Success (201):** GpsTelemetry object

**Errors:** `TRIP_NOT_FOUND` (404), `TRIP_NOT_OWNED` (403), `TRIP_NOT_ACTIVE` (409), `RATE_LIMITED` (429)

---

### GET /api/v1/trips/:id/location/latest
Latest GPS ping for a trip (full telemetry object with speed, heading, accuracy).

**Auth**: Bearer token · **Role**: `parent`, `driver`, `manager`, `school_admin`

**Success (200):** `{ "success": true, "data": GpsTelemetry | null }`

---

## Firestore Collections

### `trips`
```
{
  id:                string   // Firestore auto-ID
  tenantId:          string   // multi-tenancy — on every query
  driverId:          string   // Firebase UID of the driver
  busId:             string
  routeId:           string
  status:            "active" | "ended"
  startedAt:         number   // Unix ms
  endedAt?:          number   // set when trip ends
  latestLat?:        number   // denormalized from last ping
  latestLon?:        number
  latestSpeed?:      number   // km/h
  latestHeading?:    number   // degrees
  latestRecordedAt?: number
  createdAt:         number
  updatedAt:         number
}
```

**Composite indexes:** `(tenantId, driverId, status)`, `(tenantId, busId, status)`

### `gpsTelemetry`
```
{
  id:         string   // Firestore auto-ID
  tenantId:   string
  tripId:     string
  driverId:   string
  busId:      string
  lat:        number
  lon:        number
  speed?:     number   // km/h
  heading?:   number   // 0–360 degrees
  accuracy?:  number   // metres
  recordedAt: number   // Unix ms — driver device clock
  createdAt:  number   // Unix ms — server receipt time
}
```

**Composite index:** `(tenantId, tripId, recordedAt DESC)`

No direct client reads — always accessed via trip-service API.

## Architecture Notes

- **Denormalized latest location**: each GPS ping updates `trips/{id}.latestLat/Lon/Speed/Heading/RecordedAt` atomically. Parents read the trip doc — one Firestore read, no join required.
- **One active trip per driver**: enforced at service layer (`TRIP_ALREADY_ACTIVE`). No Firestore transaction needed since the check+create is fast and drivers operate serially.
- **Rate limiting**: GPS endpoint limited to 60 req/min (one ping/second) per device via `gpsRateLimiter` from `@saferide/middleware`.
- **Background location** (mobile): `expo-location` background task writes to `expo-secure-store` for the active trip ID. The task fires every 10 seconds, well within the 60/min server limit.
