# SafeRide — Technical Architecture Document
> Version 3.0 · March 2026  
> Phone-First GPS · Live Video · Integration Platform · Ground 0 → Production
> **Internal Engineering Reference**

---

## Table of Contents

1. [Engineering Philosophy](#1-engineering-philosophy)
2. [System Architecture](#2-system-architecture)
3. [GPS Reality — Phone-First Design](#3-gps-reality--phone-first-design)
4. [Core Data Flows](#4-core-data-flows)
5. [Real-Time GPS Pipeline](#5-real-time-gps-pipeline)
6. [Live Bus Video Architecture](#6-live-bus-video-architecture)
7. [Integration Platform Architecture](#7-integration-platform-architecture)
8. [Data Architecture](#8-data-architecture)
9. [Backend Services](#9-backend-services)
10. [Mobile App Architecture](#10-mobile-app-architecture)
11. [Notifications Engine](#11-notifications-engine)
12. [AIS-140 Compliance Layer](#12-ais-140-compliance-layer)
13. [Infrastructure & Deployment](#13-infrastructure--deployment)
14. [Security Architecture](#14-security-architecture)
15. [Observability & Monitoring](#15-observability--monitoring)
16. [Build Progression — Ground 0 to Production](#16-build-progression--ground-0-to-production)
17. [Performance & Capacity Planning](#17-performance--capacity-planning)
18. [Appendix](#18-appendix)

---

## 1. Engineering Philosophy

### 1.1 The Three Core Bets

**Bet 1: Phone-first, hardware-optional.**  
AIS-140 GPS devices are installed on Indian school buses to pass RTO inspection — not to actually work. SIM cards lapse. Firmware rots. Nobody maintains them. Uber, Ola, and Rapido have collectively run hundreds of millions of trips using nothing but the driver's phone. SafeRide does the same.

**Bet 2: Platform from Day 1.**  
SafeRide is not a closed app. It is an API platform that emits events, accepts webhooks, connects to school ERPs, and eventually dispatches ride-hailing vehicles when a bus breaks down. Every internal action produces a Kafka event. Every entity is accessible via a versioned API. Integrations are retention — a school connected to Fedena doesn't leave.

**Bet 3: Build to actual load.**  
The architecture in this document is the target state. Firebase and a single Node server come first. Kafka, EMQX, and Kubernetes come when the load demands them. Never add infrastructure ahead of the problem it solves.

### 1.2 The Non-Negotiables

```
1. Offline-first for India
   Assume connectivity drops. Always. Every client queues locally.
   Parents see last-known position. Drivers queue GPS.

2. Tenant isolation at the database layer
   PostgreSQL Row-Level Security enforces it.
   A bug in application code cannot leak one school's data to another.

3. Events over direct calls
   Services communicate via Kafka events, not synchronous HTTP calls.
   If service A needs to react to something in service B, it consumes a Kafka event.
   Direct HTTP between services is for queries, not for reactions.

4. Adapters know about externals, core knows nothing
   No SafeRide service imports from an integration adapter.
   Fedena, Ola, Rapido are invisible to route-service, trip-service, etc.
   If an adapter breaks, the rest of SafeRide keeps running.
```

---

## 2. System Architecture

### 2.1 Full System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                              │
│                                                                     │
│  Parent App          Driver App        Admin Portal   Partner Apps  │
│  (iOS + Android)     (iOS + Android)   (Web)          (OAuth 2.0)   │
└────────────┬─────────────────┬──────────────┬────────────┬─────────┘
             │                 │              │            │
             └────────────┬────┘              │            │
                          │ HTTPS / WSS       │ HTTPS      │ OAuth
                          ▼                   ▼            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         GATEWAY LAYER                               │
│  API Gateway (AWS + Kong)              Partner API (/partner/v1)    │
│  Rate limiting · Auth · Routing        OAuth 2.0 · Scopes · Quotas  │
└─────────────┬────────────────────────────────┬──────────────────────┘
              │                                │
              ▼                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION SERVICES                           │
│                                                                     │
│  auth  · tenant  · route  · trip  · video  · webhook  · partner     │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                         ┌────────┴────────┐
                         │                 │
                         ▼                 ▼
              ┌────────────────┐  ┌──────────────────────────────┐
              │   REAL-TIME    │  │     INTEGRATION LAYER        │
              │   ENGINE       │  │                              │
              │                │  │  adapters/                   │
              │  EMQX MQTT     │  │    fedena/                   │
              │  Apache Kafka  │  │    entab/                    │
              │  Redis Geo     │  │    ola/                      │
              │  Rules Engine  │  │    rapido/                   │
              │  LiveTrack WS  │  │    generic-csv/              │
              └───────┬────────┘  │                              │
                      │           │  gps-normalizer              │
                      │           │  sync-engine                 │
                      │           └──────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                │
│  PostgreSQL + TimescaleDB   Redis 7     AWS S3 + CloudFront         │
│  (primary DB, GPS history)  (live state)(video, reports, assets)    │
└─────────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                             │
│  Firebase FCM  · MSG91 SMS  · Google Maps  · AIS-140 State Room     │
│  mediasoup (video SFU)  · Agora (fallback)                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Why / Precedent |
|---|---|---|
| Mobile | React Native + Expo | Shopify, Discord, Myntra |
| Web Admin | React + Vite + TanStack Query | Standard SPA |
| API Framework | Node.js + Fastify | 2x Express throughput, Mercurial, NearForm |
| GPS ingest (hardware) | EMQX MQTT | BMW ConnectedDrive, 1M+ connections/node |
| Event streaming | Apache Kafka | Uber, Swiggy, LinkedIn |
| Live state | Redis 7 Geo | Twitter, Uber Eats |
| Primary DB | PostgreSQL 16 + TimescaleDB | GitHub, Notion + Grafana |
| Video (live) | mediasoup + WebRTC | Sub-3s latency, Google Meet architecture |
| Video (playback) | HLS on S3 + CloudFront | YouTube architecture |
| Infra | Kubernetes (EKS) on AWS ap-south-1 | Universal |
| CI/CD | GitHub Actions + ArgoCD | GitOps standard |
| Observability | Prometheus + Grafana + Sentry | Industry standard |

---

## 3. GPS Reality — Phone-First Design

### 3.1 The AIS-140 Ground Truth

AIS-140 hardware failure modes in the Indian school bus market:

```
Device installed (RTO passes)
       ↓
SIM subscription lapses (nobody notices)
       ↓
Device appears physically present → passes next inspection
       ↓
Actual GPS data stream → dead

Additional failures:
  • Cheap non-certified devices labeled as AIS-140
  • Firmware never updated post-install
  • No one owns the software dashboard — schools buy hardware, never activate software
  • State government control room systems rarely consume the data

Result: SafeRide cannot build a reliable product on hardware it does not control.
```

### 3.2 Phone GPS vs Hardware GPS

| Attribute | Driver's Android Phone | AIS-140 Device |
|---|---|---|
| GPS accuracy | ±3–5m (Snapdragon) | ±5–10m (budget chip) |
| Cellular quality | Excellent (phone modem) | Often poor (cheap GSM module) |
| Battery backup | 12+ hours (driver charges daily) | 4-hour internal battery |
| Offline buffering | App-managed SQLite queue | Internal flash (if functional) |
| Maintenance | Driver charges phone daily | Nobody maintains device |
| Cost | ₹0 (driver already has phone) | ₹3,000–8,000 per bus |
| Reliability | High | Low |

### 3.3 Hybrid GPS Architecture

```
GPS Source Priority:
──────────────────

Priority 1 (always):  Driver app phone GPS
  → Expo Location background task
  → 5-second broadcast interval
  → Offline SQLite queue

Priority 2 (when present):  AIS-140 hardware via EMQX
  → Enriches phone GPS with CAN bus speed data
  → SOS panic button hardware integration
  → Discrepancy detection alerts

Merge logic (stream-processor):
  if hardware.timestamp within 10s of phone:
    use hardware.speedKmh (from vehicle CAN — more accurate)
    use phone.lat + phone.lng (more reliable)
  else:
    use phone exclusively
    flag hardware as offline in bus:state:{busId}

Priority 3 (ride-hailing):  Normalised GPS from Ola/Rapido webhooks
  → Same pipeline as phone GPS
  → source field identifies provider
  → Virtual bus entity maps to real/contracted vehicle
```

### 3.4 Driver App GPS Implementation

```ts
// apps/mobile/src/tasks/gps-broadcast.task.ts

import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'

const TASK_NAME = 'GPS_BROADCAST'

TaskManager.defineTask(TASK_NAME, async ({ data }) => {
  const { locations } = data as { locations: Location.LocationObject[] }
  const loc = locations[0]
  if (!loc) return

  const payload = {
    lat:        loc.coords.latitude,
    lng:        loc.coords.longitude,
    speedKmh:   (loc.coords.speed ?? 0) * 3.6,
    headingDeg: loc.coords.heading ?? 0,
    accuracy:   loc.coords.accuracy ?? 0,
    timestamp:  loc.timestamp,
  }

  const sent = await api.gps.broadcast(payload).catch(() => false)
  if (!sent) await GPSQueue.push(payload)    // Queue if offline
})

export async function startGPSBroadcast() {
  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy:              Location.Accuracy.High,
    timeInterval:          5000,    // 5 seconds
    distanceInterval:      10,      // Or if moved 10m
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'SafeRide Active',
      notificationBody:  'Sharing your location with the school',
      notificationColor: '#404E3B',   // SafeRide Forest
    },
    showsBackgroundLocationIndicator: true,
  })
}
```

---

## 4. Core Data Flows

### 4.1 Morning Trip — Full End-to-End Flow

```
06:45 AM — Driver's phone fully charged
    │
    ▼
06:50 AM — Driver opens SafeRide app
    Fetches today's scheduled trip from server
    Route displayed (cached offline if no network)
    │
    ▼
06:55 AM — Driver taps "Start Trip"
    POST /api/v1/trips/:tripId/start
    Server:
      Sets trip status → 'active'
      Produces → saferide.trips.started (Kafka)
      Sets Redis: bus:trip:{busId} = tripId
    Parents on route receive push:
      "Bus 7 has departed. Expected at your stop: 07:42 AM"
    │
    ▼
07:00 AM — Background GPS task fires
    Every 5 seconds:
    Phone GPS → POST /api/v1/gps/broadcast
    Telemetry Ingestor → Kafka: saferide.gps.location-received
    │
    ▼
07:00 AM — Stream Processor (Kafka consumer)
    Validates + enriches event
    GEOADD bus:live:{tenantId} {lng} {lat} {busId}   (Redis)
    HSET bus:state:{busId} lat lng speed lastUpdate   (Redis)
    redis.publish route:{routeId}:location {payload}
    Batch write to TimescaleDB (async)
    Evaluate alert rules
    │
    ▼
07:00 AM — LiveTrack Gateway
    Subscribed to Redis channel: route:{routeId}:location
    Emits 'busLocation' to all WebSocket clients in room
    Parents' map marker animates
    │
    ▼
07:38 AM — ETA threshold crossed (10 min to Stop 4)
    Stream Processor → saferide.notifications.requested
    Notifications Service → FCM push to Stop 4 parents
    "Bus 7 is 10 minutes away — heading out now"
    │
    ▼
07:43 AM — Bus enters Stop 4 geofence (100m radius)
    Push: "Bus 7 has arrived at your stop"
    │
    ▼
08:15 AM — Bus enters school geofence (200m radius)
    Push to all route parents: "All children have arrived safely"
    Driver taps "End Trip"
    Redis live state cleared
    Trip written to TimescaleDB
    Video recording finalised → S3

Webhook events fired throughout:
    trip.started → school's ERP webhook
    trip.ended → school's ERP webhook
```

### 4.2 Bus Breakdown — Ride-Hailing Fallback Flow

```
Transport manager triggers "Bus Cancelled" for Bus 7
    │
    ▼
trip.cancelled event → Kafka → saferide.trips.cancelled
    │
    ▼
Dispatch Engine (if ola adapter enabled for tenant):
    Looks up: affected students + their stop GPS coordinates
    Groups students by geographic cluster (max 6 per vehicle)
    For each cluster:
    POST https://api.ola.com/v3/rides/create {
      pickup: stop.coords,
      dropoff: school.coords,
      vehicleType: "prime_suv",
      scheduledAt: originalDepartureTime,
      externalRef: saferide_trip_cluster_id
    }
    Receives: { rideId, driverName, vehicleReg, eta }
    │
    ▼
OlaAdapter maps rideId → SafeRide VirtualBus:
    busId: "vbus_ola_{rideId}"
    type: 'ride_hailing'
    externalRef: rideId
    gpsSource: 'ride_hailing_webhook'
    │
    ▼
Ola sends driver GPS via webhook:
    POST /integrations/ola/driver-location
    OlaGPSNormalizer.normalize() → CanonicalGPSEvent
    Produces → saferide.gps.location-received (same topic as phone GPS)
    │
    ▼
Stream Processor handles identically
Parent app shows virtual bus moving on map
Parent notification:
    "Bus 7 was cancelled. An Ola SUV (KA01AB1234) is
     picking up Arjun. ETA: 8 minutes."
    └─ Parent taps → sees Ola driver on live map
    └─ Same experience as school bus tracking
```

### 4.3 Fedena Integration Flow

```
Daily at 11 PM (scheduled sync):

FedenaAdapter.syncAllStudents(tenantId)
    │
    ▼
GET {fedenaUrl}/api/v2/students (paginated, all pages)
    │
    ▼
For each student:
    FedenaMapper.toSafeRideStudent(fedenaStudent)
    → normalises phone to E.164: "9876543210" → "+919876543210"
    → maps grade: "5" + "A" → "5A"
    → preserves externalId: { fedena: "12345" }
    │
    ▼
POST /api/v1/students
Idempotency-Key: fedena-sync-{tenantId}-{fedenaStudent.id}-{version}
    → SafeRide upserts student
    → Links to route/stop (if configured)
    │
    ▼
Write sync result to sync_logs table:
    { adapterId: 'fedena', status: 'success', recordsIn: 450, recordsOut: 447 }

If student.boarded webhook fires (Phase 2):
    POST {fedenaUrl}/api/attendance
    { student_id: fedena.student_id, date, status: 'present',
      note: 'Boarded school bus at 07:43', source: 'saferide_rfid' }
```

### 4.4 SOS Flow

```
Driver presses SOS button in app (or AIS-140 hardware panic button)
    │
    ▼ (within 2 seconds)
POST /api/v1/gps/sos  OR  MQTT SOS event from hardware
    │
    ▼
Telemetry Ingestor:
    Produces → saferide.gps.sos-triggered (PRIORITY queue)
    Priority queue: processed before all other GPS events
    │
    ├── Notifications Service (within 5s):
    │   FCM push to transport manager AND principal (both)
    │   SMS to principal (FCM may not wake phone)
    │   "EMERGENCY — Bus 7. SOS triggered at [location]."
    │
    ├── Video Service:
    │   Extracts last 60s of video buffer as SOS clip
    │   Uploads to S3 with is_sos_clip=true
    │   Never auto-deleted
    │
    ├── AIS-140 Forwarder:
    │   Sends SOS event to State Emergency IP (AIS-140 requirement)
    │   TCP socket, AIS-140 format
    │
    └── Trip Service:
        Creates incident record with GPS coordinates
        Locks trip status to 'sos_active' (cannot be ended until resolved)
```

---

## 5. Real-Time GPS Pipeline

### 5.1 Phone GPS Ingest

```
Driver App (background task)
    │
    │ Online path:
    ├── POST /api/v1/gps/broadcast
    │   JWT → extracts driverId, busId, tenantId
    │   Telemetry Ingestor produces to Kafka:
    │   {
    │     eventType: 'GpsLocationReceived',
    │     tenantId, busId, tripId,
    │     lat, lng, speedKmh, headingDeg,
    │     source: 'driver_app',
    │     timestamp
    │   }
    │
    └── Offline path:
        SQLite queue (max 500 points)
        NetworkInfo watches for reconnect
        POST /api/v1/gps/broadcast/batch (timestamp-sorted)
```

### 5.2 Stream Processor Pipeline

```
Kafka consumer: saferide.gps.location-received
Consumer group: stream-processor-group
                │
                ▼
For each GPS event:

1. VALIDATE
   lat/lng within India bounds
   speedKmh < 200 (plausibility check)
   timestamp within last 5 minutes
   busId exists and active in tenant
   → Invalid: log + DLQ

2. ENRICH
   Fetch route from Redis cache
   Find nearest route polyline point
   Calculate ETA to each upcoming stop
   Detect nearest geofence (stop, school)

3. UPDATE LIVE STATE
   GEOADD bus:live:{tenantId} {lng} {lat} {busId}
   HSET bus:state:{busId}
     lat {lat} lng {lng}
     speedKmh {speed}
     heading {heading}
     lastUpdate {timestamp}
     currentStop {stopIndex}
     etaNextStop {etaMs}

4. BROADCAST TO WEBSOCKET
   redis.publish(`route:{routeId}:location`, {
     busId, lat, lng, speedKmh, eta, stopIndex
   })

5. PERSIST TO TIMESCALEDB (batched)
   Batch: 100 events OR 2 seconds, whichever first
   INSERT INTO gps_telemetry ...

6. EVALUATE ALERT RULES
   speedKmh > threshold → saferide.alerts.speed-exceeded
   distance_from_route > 500m → saferide.trips.deviation-detected
   ETA crosses 10min → saferide.notifications.requested (approaching)
   No update >5min during active trip → saferide.devices.offline
```

### 5.3 ETA Calculation

```ts
async function calculateETA(
  busPosition: LatLng,
  targetStop: RouteStop,
  routePolyline: LatLng[],
  currentSpeedKmh: number,
  tenantId: string,
  routeId: string
): Promise<ETAResult> {

  // 1. Remaining polyline distance
  const nearestIdx = findNearestPolylinePoint(busPosition, routePolyline)
  const distanceM  = calculatePolylineLength(
    routePolyline.slice(nearestIdx), targetStop.coords
  )

  // 2. Rolling average speed (last 3 min)
  const rollingSpeedKmh = await getHistoricalAverageSpeed(
    tenantId, routeId, { windowMinutes: 3 }
  ) ?? currentSpeedKmh

  const effectiveSpeedKmh = Math.max(rollingSpeedKmh, 5)

  // 3. Dwell time at intermediate stops
  const stopsRemaining = countStopsBetween(nearestIdx, targetStop, routePolyline)
  const avgDwellMs     = await getHistoricalDwellTime(tenantId, routeId) ?? 45_000

  // 4. Raw ETA
  const travelMs  = (distanceM / 1000) / effectiveSpeedKmh * 3_600_000
  const rawEtaMs  = travelMs + (stopsRemaining * avgDwellMs)

  // 5. Confidence vs historical p50
  const historicalMs = await getHistoricalETA(tenantId, routeId, targetStop.id, new Date())
  const confidence   = historicalMs
    ? (Math.abs(rawEtaMs - historicalMs) < 120_000 ? 'high' : 'medium')
    : 'low'

  return { etaMs: rawEtaMs, etaMinutes: Math.round(rawEtaMs / 60_000), confidence }
}
```

---

## 6. Live Bus Video Architecture

### 6.1 Two Use Cases, Two Protocols

| Use Case | Protocol | Latency | Storage |
|---|---|---|---|
| Parent watches live | WebRTC via mediasoup SFU | <3 seconds | None |
| Admin watches live | WebRTC via mediasoup SFU | <3 seconds | None |
| Incident playback | HLS via CloudFront | N/A | 30-day rolling |
| SOS clip | HLS via CloudFront | N/A | Permanent |

### 6.2 Video Pipeline

```
VIDEO SOURCES
─────────────
Phase 1: Driver's rear-facing phone camera
  React Native camera → getUserMedia() → WebRTC offer
  720p @ 15fps — adequate quality, zero hardware cost

Phase 3: Dedicated dashcam (Hikvision/Viofo)
  RTSP stream → mediasoup RTSP consumer → SFU

                    ↓
MEDIA SERVER — mediasoup SFU Cluster
─────────────────────────────────────
Room: bus_{busId}_{tripId}
Producer: driver phone / dashcam
Consumers: parents, admin, recorder

Bitrate adaptation: 200kbps – 2mbps
Max concurrent viewers per bus: 50
                    ↓
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
Live stream to clients    Recording pipeline
WebRTC → parent app       mediasoup → GStreamer → FFmpeg
<3s latency               → HLS segments (.ts, 10s each)
                          → S3 upload every 10 seconds
                          → CloudFront serves playback
```

### 6.3 Live View Flow (Parent)

```
Parent taps "Watch Live"
    │
    ▼
GET /api/v1/buses/:busId/video/session
Server checks:
  ✓ Trip is active
  ✓ Parent's child is on this bus
  ✓ video feature enabled for tenant
  ✓ viewer count < 50
    │
    ▼
Server returns WebRTC session:
  { sessionToken, mediasoupRouterUrl, rtpCapabilities }
    │
    ▼
App → WebSocket to mediasoup
  wss://video1.saferide.in/transport
  { sessionToken, action: 'consume' }
    │
    ▼
ICE gathering → DTLS negotiation → RTP flowing
<RTCView /> renders stream
Latency: <3 seconds
    │
Parent navigates away:
  { action: 'close' } → clean up transport
  viewerCount decremented
  sessionToken invalidated
```

### 6.4 Recording & SOS Clip Flow

```
Trip starts
    │
    ▼
Video Service creates recording pipeline:
  mediasoup pipe → GStreamer → FFmpeg → HLS
  segments: trip_{tripId}/segment_{n}.ts (10s each)
  manifest: trip_{tripId}/playlist.m3u8
    │ (every 10 seconds)
    ▼
Upload to S3: s3://saferide-video/{tenantId}/{date}/{tripId}/
CloudFront serves segments for playback
S3 lifecycle: auto-delete after 30 days

SOS triggered (special case):
  Last 60s of buffer → sos_{incidentId}.mp4
  S3 with is_sos=true tag → lifecycle rule: NEVER delete
  Dual-auth required: principal + SafeRide ops
    │
Trip ends:
  Final segments uploaded
  playlist.m3u8 finalised (EXT-X-ENDLIST)
  Signed CloudFront URL for playback (1 hour expiry)
```

### 6.5 India Network Adaptation

```
Network detection → bitrate selection:

WiFi / 4G >10Mbps:    720p @ 1Mbps, live stream enabled
4G 2-10Mbps:          480p @ 600kbps, live stream enabled
3G <2Mbps:            Live stream DISABLED
                      Show: "Poor connection — live video unavailable"
Offline:              Show last frame + GPS data
                      Never blank screen
```

---

## 7. Integration Platform Architecture

### 7.1 The Integration Pyramid

```
         ┌─────────────────────┐
         │  ECOSYSTEM PARTNERS │  Uber/Ola/Rapido
         └──────────┬──────────┘
        ┌───────────┴───────────┐
        │    PARTNER API        │  OAuth 2.0, SDK
        │   /partner/v1/        │  Third-party parent apps
        └───────────┬───────────┘
       ┌────────────┴────────────┐
       │   SCHOOL ERP ADAPTERS   │  Fedena, Entab, Google
       └────────────┬────────────┘
      ┌─────────────┴─────────────┐
      │      WEBHOOK SYSTEM       │  Any HTTP endpoint
      └─────────────┬─────────────┘
 ┌────────────────────┴────────────────────┐
 │           KAFKA EVENT BUS               │  Foundation
 └─────────────────────────────────────────┘
```

### 7.2 Webhook Delivery Pipeline

```
Event in SafeRide core (e.g., trip.started)
    │
    ▼
Kafka: saferide.webhooks.outbound
    │
    ▼
Webhook Service (Kafka consumer)
    Looks up: subscriptions for (tenantId, event_type)
    Fans out: one event → N registered endpoints
    │
    ▼
Bull queue (Redis-backed) per destination
    Concurrency: 10 per destination
    Retry policy: 5 attempts
      1s → 5s → 30s → 5min → 30min
    After 5 failures: DLQ + email alert to school admin
    │
    ▼
HTTP Dispatcher
    POST to partner URL (5s timeout)
    Headers:
      Content-Type: application/json
      Saferide-Signature: t={timestamp},v1={hmac}
      Saferide-Event: trip.started
      Saferide-Delivery-Id: dlv_{uuid}
    Record: status code, latency, response body snippet
```

### 7.3 Webhook Payload Format

```json
{
  "id":        "evt_01HZXK2B8J3N4P5Q6R7S8T9UV",
  "type":      "trip.started",
  "version":   "1.0",
  "createdAt": "2026-03-21T07:00:00.000Z",
  "tenantId":  "tenant_dps_bangalore",
  "livemode":  true,
  "data": {
    "object": "trip",
    "id":         "trip_abc123",
    "busId":      "bus_xyz789",
    "routeId":    "route_morning_a",
    "status":     "active",
    "startedAt":  "2026-03-21T07:00:00.000Z",
    "bus": {
      "regNumber": "KA05AB1234",
      "routeName": "Route A — Indiranagar Loop"
    }
  }
}
```

### 7.4 OAuth 2.0 Flows

```
Authorization Code (web/mobile apps):
  Partner → redirect user to:
  https://auth.saferide.in/oauth/authorize
    ?client_id=partner_id
    &scope=buses:read trips:read students:read
    &response_type=code
    &state=random
  User approves → partner exchanges code for token
  Used by: third-party parent apps, school portals

Client Credentials (server-to-server):
  POST https://auth.saferide.in/oauth/token
    { client_id, client_secret, grant_type: 'client_credentials' }
  Used by: ERP nightly sync, Ola/Rapido fleet management

OAuth Scopes:
  buses:read                → Bus list and metadata
  buses.location:read       → Current GPS positions
  trips:read                → Trip history and status
  trips.live:subscribe      → Live WebSocket stream
  students:read             → Student list (sensitive — explicit approval)
  students.location:read    → Which bus/stop a student is at
  webhooks:write            → Register webhook endpoints
  dispatch:write            → Create trips (Ola/Rapido integration)
```

### 7.5 ERP Adapter Architecture

```
integrations/adapters/fedena/
├── fedena.client.ts          ← HTTP client for Fedena API
├── fedena.mapper.ts          ← Field mapping: Fedena ↔ SafeRide canonical
├── fedena.sync.ts            ← Scheduled nightly sync
├── fedena.webhook-handler.ts ← Handle Fedena → SafeRide events
└── fedena.attendance-writer.ts ← Write SafeRide attendance back to Fedena

Key rules:
  Adapters call SafeRide internal API (HTTP) — never DB directly
  Adapters use externalIds to correlate records
  Adapters have their own test suite with mocked external APIs
  Adapters store state in Redis: adapter:{id}:{tenantId}:*
  A broken adapter cannot affect core GPS tracking

Phone number normalisation is mandatory:
  Input:  "9876543210", "09876543210", "+91 9876 543210"
  Output: "+919876543210" (E.164)
```

### 7.6 Ride-Hailing Virtual Bus

```ts
// The "Virtual Bus" abstraction — key to ride-hailing integration

interface VirtualBus extends Bus {
  type:        'school_bus' | 'ride_hailing'
  provider?:   'ola' | 'uber' | 'rapido'
  externalRef?: string    // rideId from provider
  gpsSource:   'driver_app' | 'ride_hailing_webhook'
}

// After normalization, ALL GPS events look identical to stream-processor
// { busId: "vbus_ola_ride_abc123", lat, lng, speedKmh, source: 'ride_hailing_webhook' }
// → stream-processor processes identically
// → parent app shows moving dot identically
// → parent never knows it's Ola, not a school bus

class OlaGPSNormalizer implements GPSNormalizer<OlaDriverLocation> {
  normalize(rideId: string, payload: OlaDriverLocation): CanonicalGPSEvent {
    return {
      busId:      this.rideIdToBusId(rideId),
      lat:        payload.driverLocation.lat,
      lng:        payload.driverLocation.lng,
      speedKmh:   payload.driverLocation.speed * 3.6,     // Ola sends m/s
      headingDeg: payload.driverLocation.bearing ?? 0,
      source:     { type: 'ride_hailing_webhook', sourceId: rideId, providerId: 'ola' },
      rawPayload: payload,
      normalizedAt: new Date().toISOString(),
    }
  }
}
```

---

## 8. Data Architecture

### 8.1 Polyglot Persistence

| Data type | Store | Rationale |
|---|---|---|
| Users, buses, routes, trips | PostgreSQL 16 | ACID, RLS for multi-tenancy |
| GPS telemetry (time-series) | TimescaleDB extension on PG | 10-100x faster time-range queries, auto-partitioning |
| Live bus positions | Redis 7 Geo | Sub-ms GEOADD/GEORADIUS |
| Sessions, ETA cache, feature flags | Redis 7 | Fast TTL-based reads |
| Integration state | Redis (`adapter:{id}:{tenantId}:*`) | Per-adapter namespace isolation |
| Video recordings | AWS S3 | Lifecycle policies, unlimited scale |
| Video CDN delivery | CloudFront | Edge caching, signed URLs |

### 8.2 PostgreSQL Schema

```sql
-- Multi-tenancy
CREATE TABLE tenants (
  id          TEXT PRIMARY KEY DEFAULT gen_cuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  udise_code  TEXT,
  city        TEXT,
  plan        TEXT DEFAULT 'starter',
  features    JSONB DEFAULT '{}',     -- feature flags
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Integration support on all entities
CREATE TABLE buses (
  id            TEXT PRIMARY KEY DEFAULT gen_cuid(),
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reg_number    TEXT NOT NULL,
  device_imei   TEXT UNIQUE,
  external_ids  JSONB DEFAULT '{}',   -- { "fedena": "...", "ola_fleet": "..." }
  capacity      INT NOT NULL,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, reg_number)
);

-- TimescaleDB hypertable for GPS
CREATE TABLE gps_telemetry (
  time        TIMESTAMPTZ NOT NULL,
  tenant_id   TEXT NOT NULL,
  bus_id      TEXT NOT NULL,
  trip_id     TEXT,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  speed_kmh   REAL,
  heading_deg REAL,
  accuracy_m  REAL,
  source      TEXT,   -- 'driver_app' | 'ais140_device' | 'ride_hailing_webhook'
  provider    TEXT,   -- 'ola' | 'rapido' | null
  raw_nmea    TEXT    -- AIS-140 compliance: original sentence
);
SELECT create_hypertable('gps_telemetry', 'time');
SELECT add_compression_policy('gps_telemetry', INTERVAL '7 days');
SELECT add_retention_policy('gps_telemetry', INTERVAL '90 days');

-- Video sessions
CREATE TABLE video_sessions (
  id              TEXT PRIMARY KEY DEFAULT gen_cuid(),
  tenant_id       TEXT NOT NULL,
  trip_id         TEXT REFERENCES trips(id),
  bus_id          TEXT NOT NULL,
  recording_path  TEXT,          -- S3 key
  status          TEXT DEFAULT 'recording',
  started_at      TIMESTAMPTZ DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  is_sos_clip     BOOLEAN DEFAULT false,
  duration_s      INT,
  file_size_mb    REAL
);

-- Webhooks
CREATE TABLE webhook_subscriptions (
  id          TEXT PRIMARY KEY DEFAULT gen_cuid(),
  tenant_id   TEXT NOT NULL,
  url         TEXT NOT NULL,
  secret      TEXT NOT NULL,
  events      TEXT[] NOT NULL,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Integration sync logs
CREATE TABLE sync_logs (
  id            TEXT PRIMARY KEY DEFAULT gen_cuid(),
  tenant_id     TEXT NOT NULL,
  adapter_id    TEXT NOT NULL,
  status        TEXT,        -- 'success' | 'partial' | 'error'
  records_in    INT,
  records_out   INT,
  errors        JSONB,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

-- Row-Level Security on all tenant-scoped tables
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON buses
  USING (tenant_id = current_setting('app.current_tenant')::TEXT);
-- (same for routes, trips, students, webhook_subscriptions, etc.)
```

### 8.3 Redis Key Structure

```
# Live bus state
bus:live:{tenantId}              → GEOADD sorted set
bus:state:{busId}                → HASH lat lng speed heading lastUpdate
bus:trip:{busId}                 → STRING tripId

# ETA cache (TTL 30s)
trip:eta:{tripId}:{stopId}       → JSON { etaMs, etaMinutes, confidence }

# WebSocket subscriptions
route:subs:{routeId}             → SET of socket IDs
parent:socket:{userId}           → STRING socketId

# Video session state
video:session:{busId}            → HASH mediasoupRoomId viewerCount startedAt
video:viewers:{busId}            → INCR counter (max 50)

# Session management
session:{jti}                    → STRING userId (TTL 24h)
session:blacklist:{jti}          → STRING "1" (revoked)

# Feature flags per tenant (cache of DB)
tenant:features:{tenantId}       → HASH { video, rfid_tap, ola_dispatch }

# Integration adapter state
adapter:fedena:{tenantId}:last-sync     → TIMESTAMPTZ
adapter:fedena:{tenantId}:cursor        → STRING (pagination state)
adapter:ola:{tenantId}:active-rides     → SET of rideIds

# Rate limiting
ratelimit:{ip}:{endpoint}        → INCR (TTL 60s)
ratelimit:partner:{clientId}     → INCR (TTL 60s)

# Webhook idempotency
idempotency:{key}                → JSON response (TTL 24h)
```

---

## 9. Backend Services

### 9.1 Service Map

```
auth-service (:3001)
  OTP (Firebase Phone Auth) · JWT issuance · Session management
  Driver credential management · OAuth token issuance

tenant-service (:3002)
  School onboarding · User roles · Feature flags
  Plan management · Usage metrics

route-service (:3003)
  Bus CRUD · Route and stop management
  Student-to-stop assignments · CSV bulk import

telemetry-ingestor (:3004)
  Phone GPS endpoint: POST /gps/broadcast
  EMQX MQTT subscriber (hardware devices)
  Source merge + deduplication
  → Produces: saferide.gps.location-received

stream-processor (Kafka consumer)
  GPS validation + enrichment + Redis update
  TimescaleDB batch writes
  Alert rule evaluation
  ETA calculation + notification triggers
  AIS-140 state forwarder

livetrack-gateway (:3005) [WebSocket]
  Socket.io server · JWT auth on connect
  Route room subscriptions
  Redis pub/sub → WebSocket emit

notifications-service (:3006)
  FCM push (batch up to 500 tokens)
  MSG91 SMS (India-optimised)
  Delivery receipt tracking · Retry queue
  Multi-language template rendering (7 languages)

trip-service (:3007)
  Trip lifecycle · GPS track assembly
  Trip history queries · Report export (CSV/PDF)
  TimescaleDB time-range queries

video-service (:3008)
  mediasoup WebRTC orchestration
  Recording lifecycle (HLS → S3)
  SOS clip extraction + permanent storage
  Signed CloudFront URL generation
  Viewer count enforcement

webhook-service (:3009)
  Kafka consumer: saferide.webhooks.outbound
  HMAC signing · HTTP delivery
  Retry with exponential backoff
  Delivery log · DLQ management

partner-api (:3010)
  /partner/v1/ REST endpoints
  OAuth 2.0 Authorization Server
  Scope enforcement · Per-partner rate limiting
```

### 9.2 Video Service — mediasoup Config

```ts
// apps/video-service/src/config.ts

const MediasoupConfig = {
  worker: {
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
    logLevel:   'warn',
  },
  router: {
    mediaCodecs: [
      { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 },
      { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000 },
    ]
  },
  webRtcTransport: {
    listenIps: [
      { ip: '0.0.0.0', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP }
    ],
    enableTcp:       true,
    enableUdp:       true,
    preferUdp:       true,
    maxIncomingBitrate: 2_000_000,   // 2 Mbps max per producer
  },
  recording: {
    segmentDurationSeconds: 10,
    s3Bucket:   process.env.AWS_S3_VIDEO_BUCKET,
    s3Prefix:   (tenantId: string, tripId: string) =>
                  `${tenantId}/${new Date().toISOString().split('T')[0]}/${tripId}/`,
  }
}
```

---

## 10. Mobile App Architecture

### 10.1 State Machines

```
PARENT APP:

App launch
  ├── No JWT → LOGIN
  │     OTP → phone verify → school code → child linked → ACTIVE
  │
  └── JWT valid → CHECK TRIP STATE
        ├── Trip active → LIVE_TRACKING
        │     WebSocket connected
        │     'busLocation' events → update Zustand → animate map
        │     WS disconnect → banner + last-known position + reconnect
        │
        ├── Before scheduled departure → WAITING
        │     Poll every 60s for trip start
        │
        └── After school hours → IDLE
              Show last trip summary
              Option: Watch recorded video

DRIVER APP:

App launch → STANDBY
  Show next scheduled trip + route preview
  │
Driver taps "Start Trip" → ACTIVE
  GPS broadcast starts (background task)
  Video streaming starts (if enabled)
  Large SOS button visible at all times
  Route progress: current stop, next stop
  │
  ├── Stop reached → mark visited
  ├── SOS tapped → emergency flow → video clip saved
  └── End Trip → GPS stops → video stops → STANDBY
```

### 10.2 Zustand Store

```ts
interface LiveTrackStore {
  wsStatus:     'connecting' | 'connected' | 'reconnecting' | 'offline'
  busPosition:  { lat: number; lng: number } | null
  busSpeed:     number
  isStale:      boolean          // lastUpdated > 30s ago
  tripActive:   boolean
  etaMinutes:   number | null
  etaConfidence: 'high' | 'medium' | 'low'
  currentStopIndex: number

  connect:       (routeId: string) => void
  disconnect:    () => void
  updatePosition: (payload: BusLocationPayload) => void
}

interface VideoStore {
  sessionActive:  boolean
  quality:        'high' | 'medium' | 'low' | 'disabled' | 'offline'
  viewerCount:    number
  sessionToken:   string | null

  startSession:  (busId: string) => Promise<void>
  endSession:    () => void
  setQuality:    (quality: VideoQuality) => void
}
```

---

## 11. Notifications Engine

### 11.1 Multi-Language Templates

```ts
const templates = {
  BUS_APPROACHING_10MIN: {
    en: { title: 'Bus {busNumber} in {etaMinutes} minutes', body: 'Heading to {stopName}.' },
    hi: { title: 'बस {busNumber} {etaMinutes} मिनट में', body: '{stopName} की तरफ आ रही है।' },
    kn: { title: 'ಬಸ್ {busNumber} {etaMinutes} ನಿಮಿಷಗಳಲ್ಲಿ', body: '{stopName} ಗೆ ಬರುತ್ತಿದೆ.' },
    ta: { title: 'பஸ் {busNumber} {etaMinutes} நிமிடங்களில்', body: '...' },
    te: { title: 'బస్ {busNumber} {etaMinutes} నిమిషాల్లో', body: '...' },
    mr: { title: 'बस {busNumber} {etaMinutes} मिनिटांत', body: '...' },
    ml: { title: 'ബസ് {busNumber} {etaMinutes} മിനിറ്റിൽ', body: '...' },
  },
  SOS_TRIGGERED: {
    en: { title: 'EMERGENCY — Bus {busNumber}', body: 'SOS triggered at {location}.' },
    // All 7 languages
  },
}
```

### 11.2 FCM + SMS Delivery

```
Notification triggered
    │
    ▼
Resolve recipients (from DB: FCM tokens + phone numbers)
Build localised message (template + language)
    │
    ├── FCM batch (up to 500 tokens):
    │   firebase.messaging().sendMulticast(...)
    │   Track: delivery receipts per token
    │
    └── SMS fallback:
        For tokens marked UNREGISTERED
        OR after 30s without FCM receipt (critical events)
        → MSG91 API → SMS in 60 chars (single SMS in India)
```

---

## 12. AIS-140 Compliance Layer

### 12.1 Software Compliance

```
Government requires:
  1. GPS device in every bus (hardware — school's responsibility)
  2. PVT data forwarded to State Control Room IP (real-time)
  3. Emergency event to Emergency IP on SOS
  4. 90-day data retention

SafeRide satisfies 2, 3, and 4 from phone GPS:

Phone GPS coordinates (30s interval)
    │
    ▼
AIS-140 Forwarder (inside stream-processor):
  Format as NMEA-like PVT string:
  $GPRMC,083000,A,1258.2976,N,07733.7104,E,23.1,180.5,210326,...*2B

  Send via TCP to:
    Primary IP: State Control Room
    On SOS only: Emergency Response IP

School gets AIS-140 compliance checkbox.
Phone is the GPS source. Result is identical to hardware.

TimescaleDB 90-day retention policy satisfies data retention requirement.
```

---

## 13. Infrastructure & Deployment

### 13.1 AWS Architecture (ap-south-1 Mumbai)

```
VPC 10.0.0.0/16
│
├── Public Subnets (3 AZs)
│   ├── Application Load Balancer
│   ├── NAT Gateways
│   ├── EMQX MQTT Cluster (2x EC2 t3.xlarge)
│   └── mediasoup Media Servers (EC2, scales with video load)
│
└── Private Subnets (3 AZs)
    ├── EKS Node Groups (application services)
    ├── RDS PostgreSQL (Multi-AZ, db.t3.large → db.r5.large at scale)
    ├── ElastiCache Redis (cache.t3.medium → cluster mode at scale)
    ├── Amazon MSK Kafka (2 brokers, t3.small)
    └── Integration services (adapters run as K8s CronJobs)

Supporting Services:
  S3: video recordings, reports, app assets
  CloudFront: video CDN, admin portal static assets
  Route 53: DNS
  ACM: SSL/TLS certificates (auto-renewed)
  Secrets Manager: all credentials
  CloudWatch + X-Ray: metrics, logs, traces
```

### 13.2 Kubernetes Deployment

```yaml
# Key HPA configurations

telemetry-ingestor:
  replicas: 3 → 20 (HPA: CPU >65%)
  note: scales hard on 8 AM GPS burst

stream-processor:
  replicas: 3 → 20 (HPA: Kafka lag >10,000 messages)

livetrack-gateway:
  replicas: 3 → 15 (HPA: WebSocket connections >80,000/pod)

video-service:
  replicas: 2 → 10 (HPA: CPU >60%)
  note: isolated from GPS pipeline — video load can't affect tracking

webhook-service:
  replicas: 2 → 8 (HPA: queue depth >5,000)

# Integration adapters run as CronJobs, not Deployments
# fedena-sync: schedule "0 23 * * *" (11 PM daily)
# cleanup jobs: schedule "0 2 * * *" (2 AM daily)
```

### 13.3 CI/CD Pipeline

```
Push to feature branch → PR Checks (GitHub Actions):
  pnpm typecheck (all packages)
  pnpm lint (zero warnings)
  pnpm test:unit
  pnpm test:integration (Docker: real PG + Redis)
  Docker build (validates image builds)

Merge to main → Deploy Pipeline:
  Full test suite
  Build Docker images for changed services (Turborepo detects changes)
  Push to AWS ECR (tagged with git SHA)
  Update Helm values: image.tag = {git-sha}
  Commit to infra-repo
  ArgoCD syncs Kubernetes (rolling update, maxUnavailable: 0)
  Readiness probe gates traffic

Pipeline time: 6–10 minutes push to production

Integration adapter deploys:
  Same pipeline, but deploys as Kubernetes CronJob
  Separate Docker image per adapter
  Independent rollback: adapter rollback never affects core services
```

### 13.4 Infrastructure Cost

| Service | Config | ₹/month (launch) |
|---|---|---|
| EKS nodes (2x t3.xlarge) | Runs all app services | ~₹22,000 |
| RDS PostgreSQL (db.t3.large) | Multi-AZ | ~₹10,000 |
| ElastiCache Redis | cache.t3.medium | ~₹5,000 |
| Amazon MSK Kafka | 2 brokers | ~₹8,000 |
| EC2 EMQX (2x t3.large) | MQTT broker | ~₹10,000 |
| EC2 mediasoup | t3.xlarge (video) | ~₹12,000 |
| S3 + CloudFront | Video, assets | ~₹5,000 |
| API Gateway + WAF | Managed | ~₹3,000 |
| Misc (DNS, ACM, CloudWatch) | | ~₹3,000 |
| **Total infra** | | **~₹78,000/month** |
| MSG91 SMS | ~10K SMS/month | ~₹5,000 |
| Google Maps API | ~500K map loads | ~₹7,000 |
| **Total OPEX** | | **~₹90,000/month** |

At 20 schools paying avg ₹6,000/month = ₹1.2L MRR → infrastructure is 75% of revenue at launch, drops to ~15% at 200 schools.

---

## 14. Security Architecture

### 14.1 Authentication

```
Parents:      Mobile OTP (Firebase Phone Auth) → SafeRide JWT
Drivers:      School-issued 6-char code → SafeRide JWT (device-bound)
Admins:       Email + password + TOTP 2FA → SafeRide JWT
Partners:     OAuth 2.0 (client credentials or authorization code)
Devices:      IMEI + HMAC(imei + secret + epoch) rotating token

JWT payload:
{
  sub:      "user_uuid",
  tenantId: "tenant_uuid",     ← RLS uses this
  role:     "parent|driver|transport_manager|principal|partner",
  scopes:   ["buses:read"],    ← OAuth scopes for partners
  exp:      +24h,
  jti:      "unique_token_id"  ← For revocation
}
```

### 14.2 Tenant Isolation

```sql
-- Database enforces isolation — no application bug can leak data

-- Every query automatically filters by tenant:
SET LOCAL app.current_tenant = 'tenant_dps_bangalore';
SELECT * FROM buses;  -- Returns ONLY dps-bangalore buses

-- Even a coding error cannot access another tenant's data
-- The RLS policy blocks it at the database layer
```

### 14.3 Video Security

```
Live video:
  Single-use session token (2-hour TTL)
  New token required on reconnect
  IP-bound (cannot share URL)
  Viewer count capped (prevents abuse)
  All access logged

Recordings:
  CloudFront signed URLs (1-hour expiry)
  Single-IP-bound
  Accessible only to school's transport manager and principal
  All access logged to video_access_log table

SOS clips:
  Dual-authorisation: principal + SafeRide ops (separate JWTs)
  Access logged with reason and case ID
  Never auto-deleted

Partner video access:
  Not exposed via Partner API (internal only)
  No OAuth scope exists for video data
```

### 14.4 Integration Security

```
Webhook delivery:
  HMAC-SHA256 signature on every payload
  Partner verifies with timing-safe comparison
  Replay protection: reject if >5 minutes old

OAuth apps:
  client_secret: server-side only (never in mobile apps)
  Secret rotation with 24-hour grace period (zero-downtime)
  Scoped: credentials for School A cannot access School B

Integration audit log:
  Every adapter action logged: tenant, resource, outcome
  Retained 1 year (longer than standard data)
  Accessible to tenant admin (their data) and SafeRide ops (all)
```

---

## 15. Observability & Monitoring

### 15.1 Key Metrics

```
GPS Pipeline:
  gps_messages_per_second              (target: stable at 8 AM peak)
  gps_pipeline_latency_p95             (target: <5s)
  kafka_consumer_lag                   (target: near 0 during trips)
  active_trips                         (business metric)

Video:
  video_active_streams                 (live streams running)
  video_stream_start_latency_p95       (target: <3s)
  recording_s3_upload_lag              (target: <30s)
  video_session_errors_per_hour

Integration:
  adapter_sync_duration_{adapterId}    (how long each sync takes)
  adapter_sync_errors_{adapterId}      (failures per sync)
  webhook_delivery_success_rate        (target: >98%)
  webhook_retry_count                  (spikes = partner endpoint issues)
  ola_dispatch_success_rate            (ride-hailing dispatch)
```

### 15.2 Critical Alerts

```
P1 (page immediately):
  GPS pipeline latency p95 > 15s
  Kafka consumer lag > 100,000 messages
  >2 livetrack-gateway pods down simultaneously
  SOS event not forwarded to state server (AIS-140 breach)
  Video service down during business hours

P2 (notify on-call, no page):
  Webhook delivery rate < 94%
  Adapter sync failing 3+ consecutive times
  Video S3 upload lag > 2 minutes
  Database CPU > 80%

P3 (Slack alert only):
  Individual adapter sync error
  Single webhook destination failing (partner's server issue)
  Rate limit hits on Partner API
```

---

## 16. Build Progression — Ground 0 to Production

### 16.1 Why This Section Exists

The architecture in this document is the *target state*. Looking at the full system and trying to build all of it is the wrong approach and will paralyse you.

The actual progression is:

```
Week 1–2:   Firebase + Expo          → 1 bus, 1 parent, dot on map
Month 1:    Express + PostgreSQL     → 1 school, 50 parents, first paying customer
Month 2–4:  Redis + RDS              → 20 schools, 2,000 parents, stable ops
Month 5–8:  Kafka + K8s + Video      → 200 schools, 50K parents, full product
Month 8–12: Integration platform     → Fedena adapter, webhooks, partner API
Month 12+:  Scale + Ola/Rapido       → Architecture diagram is reality
```

### 16.2 Phase 0 — Proof of Concept (Week 1–2)

**Goal:** Driver opens app → taps Start → parent sees dot move.

```
Stack: Expo + Firebase Realtime Database
No backend code. Firebase is the backend.
Build time: 2 engineers, 2 weeks

Driver screen:
  Location.watchPositionAsync(...)
  → set(ref(db, `buses/${busId}/location`), { lat, lng, timestamp })

Parent screen:
  onValue(ref(db, `buses/${busId}/location`), snapshot => {
    setMarkerPosition({ lat: snapshot.val().lat, lng: snapshot.val().lng })
  })

Show to someone real. Watch their face.
This is everything. All architecture serves this moment.

What you DON'T build yet:
  Multi-tenancy, auth, notifications, video, integrations,
  multiple buses, Kafka, Redis, Kubernetes — NONE of it.
```

### 16.3 Phase 1 — First Real School (Month 1)

```
New:
  Express + PostgreSQL (Railway or Supabase — managed, zero ops)
  OTP login (Firebase Phone Auth)
  School code → parent linked to bus
  Push notification when bus approaches stop
  Driver app persistence (trip start/end to DB)

What STAYS on Firebase:
  Real-time GPS (Firebase Realtime DB handles <10K connections free)
  Firebase Phone Auth

Why not Kafka/Redis yet:
  Firebase handles real-time at this scale
  10-50 parents don't need Kafka
  You need to learn what parents actually want first

First integration seed:
  Store parent phone in E.164 format from Day 1
  Add udise_code column to schools
  Add external_ids JSONB to students
  These cost nothing now, painful to retrofit later
```

### 16.4 Phase 2 — 5–20 Schools (Month 2–4)

```
New:
  Redis replaces Firebase Realtime DB for GPS state
    (Firebase free tier limits hit at ~10 concurrent buses)
  Transport manager web dashboard (single React page)
  SMS fallback via MSG91
  Multi-language push notifications
  Generic CSV student import
  Basic webhook support (trip.started, trip.ended)

Infrastructure:
  2 EC2 t3.medium running Docker Compose
  RDS PostgreSQL db.t3.micro
  ElastiCache Redis cache.t3.micro
  Cost: ~₹15,000/month

Still not needed:
  Kafka (Redis pub/sub handles <100 buses fine)
  EMQX (phone GPS is the source)
  Kubernetes (Docker Compose is fine)
  Video (one thing at a time)
```

### 16.5 Phase 3 — 50–200 Schools (Month 5–12)

```
New:
  Kafka (you now have real event volume)
  Kubernetes / EKS (EC2 Docker Compose doesn't scale with team)
  EMQX for hardware GPS devices (schools start asking)
  Live video (mediasoup + S3 + HLS)
  RFID tap module (Phase 2 product feature)
  Fedena ERP adapter (your first enterprise school will have Fedena)

Engineering team: 4–6 engineers
Infrastructure: ~₹78,000/month → covered by 13+ schools
```

### 16.6 Phase 4 — 200+ Schools (Month 12+)

```
New:
  Partner API with OAuth 2.0 (public developer access)
  Ola/Rapido dispatch integration (partnership required)
  Liability dashboard (Phase 4 product)
  Multi-region (Hyderabad as secondary)
  ML-based ETA prediction
  App marketplace

Engineering team: 8–12 engineers
This is when the architecture diagram becomes reality.
```

---

## 17. Performance & Capacity Planning

### 17.1 Load Profile

| Metric | Month 3 | Month 12 | Month 24 |
|---|---|---|---|
| Schools | 20 | 200 | 600 |
| Active buses (peak) | 200 | 2,000 | 6,000 |
| GPS messages/min | 400 | 4,000 | 12,000 |
| Parent sessions (8 AM) | 4,000 | 40,000 | 120,000 |
| WebSocket connections | 4,000 | 40,000 | 120,000 |
| Push notifications/hour (peak) | 20,000 | 200,000 | 600,000 |
| Concurrent video streams | 50 | 500 | 1,500 |
| Telemetry storage/day | ~2 GB | ~20 GB | ~60 GB |
| Video storage/day | ~50 GB | ~500 GB | ~1.5 TB |

### 17.2 The 8 AM Storm

Every weekday 7:45–8:30 AM: entire parent base opens the app simultaneously.

```
At 200 schools (Month 12):
  40,000 parent WebSocket connections
  4,000 buses × 5s interval = 800 GPS events/minute
  ~200,000 push notifications in 15-minute window

Mitigations:
  ETAs pre-calculated + cached in Redis every 30s (not per-request)
  WebSocket load balanced: 5 pods × 8,000 connections each
  Push notifications via Bull queue: 500 concurrent workers (smooths burst)
  TimescaleDB writes batched: 100 points or 2s → reduces write load
```

### 17.3 Video Capacity

```
Per bus at 720p:
  10 concurrent viewers × 100KB/s = 8 Mbps per bus

At 200 buses streaming simultaneously:
  200 × 8 Mbps = 1.6 Gbps total outbound
  CloudFront handles this — it is the CDN's job

Cost at 200 buses, 2 hours/day peak:
  1.6 Gbps × 2h × $0.085/GB ≈ $2,760/day ← Not sustainable as free feature
  This is why video is a paid add-on

Recording storage (30-day):
  200 buses × 6h/day × 360 MB/h = 432 GB/day = 12.9 TB total
  S3 standard: ~$300/month (₹25,000) — covered by video plan pricing
```

---

## 18. Appendix

### 18.1 Complete Kafka Topic Catalogue

| Topic | Producer | Consumer | Retention | Notes |
|---|---|---|---|---|
| `saferide.gps.location-received` | telemetry-ingestor, adapters | stream-processor | 7 days | All GPS sources; source field identifies origin |
| `saferide.gps.sos-triggered` | telemetry-ingestor | notifications, trip-service, video-service | 90 days | Priority queue |
| `saferide.trips.started` | trip-service | notifications, video-service, webhook-service | 30 days | |
| `saferide.trips.ended` | trip-service | notifications, video-service, webhook-service | 30 days | |
| `saferide.trips.deviation-detected` | stream-processor | notifications, webhook-service | 30 days | |
| `saferide.alerts.speed-exceeded` | stream-processor | notifications, webhook-service | 30 days | |
| `saferide.notifications.requested` | multiple | notifications-service | 7 days | |
| `saferide.notifications.delivered` | notifications-service | analytics | 7 days | |
| `saferide.webhooks.outbound` | multiple services | webhook-service | 7 days | Fans out to registered URLs |
| `saferide.students.sync-requested` | adapters (fedena, entab) | route-service | 7 days | ERP push sync jobs |
| `saferide.video.sos-captured` | video-service | trip-service | 365 days | |
| `saferide.tap.v1.events` | tap-service (Phase 2) | stream-processor, notifications, webhook-service | 90 days | RFID events |
| `saferide.gate.v1.entries` | gate-service (Phase 3) | notifications, webhook-service | 90 days | Campus entry |
| `saferide.*.dlq` | consumer errors | ops alerts | 7 days | All DLQs |

### 18.2 Environment Variables Reference

```bash
# All services
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/saferide
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
JWT_SECRET=minimum-32-characters
LOG_LEVEL=info

# Video service
MEDIASOUP_ANNOUNCED_IP=
AWS_S3_VIDEO_BUCKET=saferide-video-dev
CLOUDFRONT_VIDEO_DOMAIN=https://video.saferide.in
CLOUDFRONT_KEY_PAIR_ID=
CLOUDFRONT_PRIVATE_KEY_PATH=

# Notifications
FCM_PROJECT_ID=saferide-prod
MSG91_API_KEY=
MSG91_SENDER_ID=SFRDE

# AIS-140
AIS140_STATE_SERVER_IP=
AIS140_STATE_SERVER_PORT=

# Adapters (set per integration)
FEDENA_API_URL=
FEDENA_API_KEY=
OLA_WEBHOOK_SECRET=
OLA_API_KEY=
RAPIDO_WEBHOOK_SECRET=
GOOGLE_WORKSPACE_CLIENT_ID=
GOOGLE_WORKSPACE_CLIENT_SECRET=

# OAuth (partner-api)
OAUTH_JWT_PRIVATE_KEY_PATH=
OAUTH_JWT_PUBLIC_KEY_PATH=
```

### 18.3 Third-Party Services Setup Order

```
Day 1:
  □ Firebase project (Phone Auth + Realtime Database)
  □ Expo account
  □ Google Cloud (Maps API keys — Android + iOS need separate keys)

Week 2:
  □ AWS account (Free Tier initially)
  □ MSG91 account — IMPORTANT: Sender ID registration takes 3–7 days
    Do this immediately. You cannot send SMS without approved sender ID.

Month 1:
  □ Sentry (error tracking — free tier sufficient)
  □ GitHub Actions (CI/CD — included with GitHub)

Month 2+:
  □ AWS RDS, ElastiCache, EKS, MSK (move off Railway/Supabase)
  □ CloudFront distribution for video CDN
  □ Datadog or Grafana Cloud

Month 5+:
  □ Ola for Business API access (requires business account + agreement)
  □ Rapido School partner API (requires direct partnership discussion)
  □ Fedena marketplace listing (integration discovery)
```

### 18.4 Standard Identifiers Used Throughout

| Data | Format | Example |
|---|---|---|
| Internal IDs | cuid | `cjld2cjxh0000qzrmn831i7rn` |
| Phone numbers | E.164 | `+919876543210` |
| School identifiers | UDISE code | `29040402302` |
| GPS coordinates | WGS-84 decimal | `12.9716, 77.5946` |
| Timestamps | ISO 8601 UTC | `2026-03-21T07:43:00.000Z` |
| Currency | Paise (integer) | `150000` = ₹1,500 |

---

*SafeRide Technical Architecture v3.0 — March 2026*  
*Internal Engineering Document — Questions: engineering@saferide.in*
