# SafeRide — Extended Technical Documentation
> Version 2.0 · March 2026  
> Phone-first GPS · Live Bus Video · Full System Architecture  
> **Ground 0 → Production Progression Guide**

---

## Table of Contents

1. [System Philosophy](#1-system-philosophy)
2. [Architecture Overview](#2-architecture-overview)
3. [The GPS Reality — Phone-First Design](#3-the-gps-reality--phone-first-design)
4. [Core Data Flows](#4-core-data-flows)
5. [Real-Time GPS Pipeline](#5-real-time-gps-pipeline)
6. [Live Bus Video Architecture](#6-live-bus-video-architecture)
7. [Data Architecture](#7-data-architecture)
8. [Backend Services](#8-backend-services)
9. [Mobile App Architecture](#9-mobile-app-architecture)
10. [Notifications Engine](#10-notifications-engine)
11. [AIS-140 Compliance Layer](#11-ais-140-compliance-layer)
12. [Infrastructure & Deployment](#12-infrastructure--deployment)
13. [Security Architecture](#13-security-architecture)
14. [Observability & Monitoring](#14-observability--monitoring)
15. [Build Progression — Ground 0 to Production](#15-build-progression--ground-0-to-production)
16. [Phase Roadmap Integration Points](#16-phase-roadmap-integration-points)
17. [Performance & Capacity Planning](#17-performance--capacity-planning)
18. [Appendix](#18-appendix)

---

## 1. System Philosophy

### 1.1 Core Principles

**Phone-first, hardware-optional.** The AIS-140 GPS device installed on most Indian school buses exists primarily to satisfy RTO inspection. In practice, SIM cards lapse, devices break, and nobody maintains them. SafeRide treats the driver's Android phone as the primary GPS source. Hardware devices are a signal enrichment layer, not a dependency.

**Offline-first for India.** Connectivity in semi-urban and suburban India is inconsistent. Every client — parent app, driver app — must function gracefully when the network drops. The driver app stores location locally and syncs. The parent app shows last-known position with a timestamp rather than a blank screen.

**Build to the actual load, not the imagined load.** The architecture documented here is the target state. The actual build follows a progression — see Section 15. Kafka, EMQX, and Kubernetes come in when the load demands them. Firebase and a single Node server come first.

**Modularity over monolith.** Every feature beyond GPS tracking is a module that plugs in. The GPS pipeline is the trunk. RFID tap, school gate tracking, video streaming, and liability dashboards are branches. Removing a branch never affects the trunk.

### 1.2 The Single Core Loop

Everything SafeRide does reduces to this loop:

```
Driver phone broadcasts GPS
         ↓
Server receives & stores location
         ↓
Parent app displays moving dot on map
         ↓
Notification fires when bus is near stop
```

Every other feature — video, tap system, dashboards, reports — is additive. If this loop breaks, nothing else matters.

---

## 2. Architecture Overview

### 2.1 System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │   Parent App     │  │   Driver App     │  │  Admin Portal │ │
│  │ (iOS + Android)  │  │ (iOS + Android)  │  │     (Web)     │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTPS / WSS
┌─────────────────────────────────────────────────────────────────┐
│                          GATEWAY LAYER                          │
│       API Gateway (REST)          WebSocket Gateway (WS)        │
│       Rate limiting, Auth          LiveTrack subscriptions       │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION SERVICES                       │
│   Auth  │  Tenant  │  Route  │  Trip  │  Notifications  │  Video│
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                       REAL-TIME ENGINE                          │
│  EMQX MQTT Broker  │  Apache Kafka  │  Redis Geo  │  Rules Eng  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                             │
│  PostgreSQL + TimescaleDB  │  Redis (Sessions)  │  S3 + CDN     │
│           (Primary DB)     │  (Live State)      │  (Video/Media)│
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                         │
│  Firebase FCM  │  MSG91 SMS  │  Google Maps API  │  State Room  │
│  Agora/WebRTC  │  Cloudfront │  DPDP Consent Store              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack Reference

| Layer | Technology | Precedent |
|---|---|---|
| Mobile | React Native + Expo | Shopify, Discord, Myntra |
| Web Admin | React + Vite + TanStack Query | Standard enterprise SPA |
| API Framework | Node.js + Fastify | Mercurial, NearForm — faster than Express |
| Real-time transport | EMQX MQTT (GPS) + Socket.io (parent app) | BMW ConnectedDrive, IoT fleets |
| Event streaming | Apache Kafka | Uber, Swiggy, LinkedIn |
| Live state | Redis 7 Geo | Twitter, Uber Eats |
| Primary DB | PostgreSQL 16 + TimescaleDB | GitHub, Notion + Grafana, Comcast |
| Video streaming | WebRTC (live) + HLS (playback) | Google Meet, YouTube |
| Video media server | mediasoup (self-hosted) or Agora (managed) | Industry standard |
| Object storage | AWS S3 + CloudFront | Universal |
| Infra orchestration | Kubernetes (EKS) | Universal |
| CI/CD | GitHub Actions + ArgoCD | GitOps standard |
| Observability | Prometheus + Grafana + Datadog | Industry standard |

---

## 3. The GPS Reality — Phone-First Design

### 3.1 Why Hardware GPS Fails in Practice

AIS-140 certified GPS devices are mandatory by law. In practice, the following failure modes are common across Indian school fleets:

```
Device installed → SIM card purchased → RTO passes inspection
         ↓
SIM subscription lapses (nobody notices)
         ↓
Device continues to appear installed (satisfies future inspection)
         ↓
Data stream to government control room: silent
         ↓
Data stream to parent app: nothing
```

Additional failure modes:
- Cheap non-certified devices labeled as AIS-140 certified
- Devices physically present but firmware never updated
- No one owns the software dashboard — schools buy hardware, never activate software
- Devices tamper-removed and re-installed at inspection time

**Conclusion: You cannot build a reliable product on a dependency you do not control.**

### 3.2 Phone GPS vs Hardware GPS

| Attribute | Driver's Android Phone | AIS-140 Device |
|---|---|---|
| GPS chip accuracy | ±3–5m (Qualcomm Snapdragon) | ±5–10m (budget chip) |
| Cellular antenna | Excellent (flagship phone modem) | Often poor (cheap GSM module) |
| Battery backup | 12+ hour phone battery | 4-hour internal battery |
| Offline buffering | App-managed SQLite queue | Device internal flash (if functional) |
| Maintenance | Driver charges phone daily | Nobody maintains device |
| Cost | ₹0 (driver already has phone) | ₹3,000–8,000 per bus |
| Reliability | High (driver depends on phone) | Low (nobody depends on device) |
| Update path | OTA app update | Firmware update (rare) |

Uber, Ola, and Rapido have collectively proven this model at hundreds of millions of trips. They never touched vehicle hardware.

### 3.3 Hybrid GPS Architecture

SafeRide uses a source-priority model:

```
┌─────────────────────────────────────────────────────┐
│              GPS Source Priority                    │
│                                                     │
│  Priority 1: Driver App (phone GPS)                 │
│    → Always active when trip is running             │
│    → Expo Location background task                  │
│    → Offline queue with SQLite                      │
│                                                     │
│  Priority 2: AIS-140 Hardware (if available)        │
│    → Richer data: speed from CAN bus, panic button  │
│    → Used to augment phone GPS when signal matches  │
│    → Discrepancy detection triggers alert           │
│                                                     │
│  Merge Logic (stream-processor):                    │
│    if (hardware.timestamp is within 10s of phone):  │
│      use hardware.speed (more accurate)             │
│      use phone.lat/lng (more reliable)              │
│    else:                                            │
│      use phone exclusively                          │
│      flag hardware as offline                       │
└─────────────────────────────────────────────────────┘
```

### 3.4 Driver App GPS Implementation

```ts
// apps/mobile/src/tasks/gps-broadcast.task.ts

import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { GPSQueue } from '@/store/gps-queue'
import { api } from '@/api/client'

const TASK_NAME = 'GPS_BROADCAST'
const BROADCAST_INTERVAL_MS = 5000          // Every 5 seconds
const LOW_BATTERY_INTERVAL_MS = 15000       // Every 15s below 20% battery
const OFFLINE_QUEUE_MAX = 500               // Store up to 500 points offline

// Register background task — survives screen lock
TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) return
  const { locations } = data as { locations: Location.LocationObject[] }
  const location = locations[0]
  if (!location) return

  const payload = {
    lat:       location.coords.latitude,
    lng:       location.coords.longitude,
    speedKmh:  (location.coords.speed ?? 0) * 3.6,  // m/s → km/h
    headingDeg: location.coords.heading ?? 0,
    accuracy:  location.coords.accuracy ?? 0,
    timestamp: location.timestamp,
  }

  // Try to send immediately
  const sent = await api.gps.broadcast(payload).catch(() => false)

  // If offline, queue locally
  if (!sent) {
    await GPSQueue.push(payload)
  }
})

// Call at trip start
export async function startGPSBroadcast(tripId: string) {
  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: BROADCAST_INTERVAL_MS,
    distanceInterval: 10,          // Also trigger if moved 10m
    foregroundService: {           // Shows persistent notification on Android
      notificationTitle: 'SafeRide Active',
      notificationBody:  'Sharing your location with the school',
      notificationColor: '#404E3B',
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,  // iOS blue bar
  })
}

// Flush queue when connectivity returns
export async function flushOfflineQueue() {
  const points = await GPSQueue.drainAll()
  if (points.length === 0) return
  await api.gps.broadcastBatch(points)
}
```

---

## 4. Core Data Flows

### 4.1 Morning Trip Flow (End-to-End)

This is the most critical flow. Every component must work for a parent to see their child's bus.

```
06:45 AM — Driver wakes up, phone fully charged
    │
    ▼
06:50 AM — Driver opens SafeRide app
    │  App checks for active scheduled trip
    │  Fetches route from server (cached offline if unavailable)
    ▼
06:55 AM — Driver taps "Start Trip"
    │  App calls POST /api/v1/trips/:tripId/start
    │  Server creates TripStarted event → Kafka
    │  Redis sets trip:active:{busId} = tripId
    │  All subscribed parents for this route get push notification:
    │    "Bus 7 has departed. Expected at your stop: 07:42 AM"
    ▼
07:00 AM — GPS broadcast begins (background task active)
    │  Phone GPS fires every 5 seconds
    │  Each point → POST /api/v1/gps/broadcast
    │  Telemetry Ingestor → Kafka topic: saferide.gps.location-received
    ▼
07:01 AM — Stream Processor consumes Kafka event
    │  Parses location, enriches with route data
    │  GEOADD bus:live:{tenantId} {lng} {lat} {busId}   ← Redis
    │  HSET bus:state:{busId} speed lat lng lastUpdate  ← Redis
    │  Publishes to Redis channel: route:{routeId}:location
    ▼
07:01 AM — LiveTrack Gateway receives Redis pub/sub
    │  All connected parent WebSocket clients on this route
    │  receive: { busId, lat, lng, speedKmh, eta }
    │  Parent app animates bus marker on map
    ▼
07:38 AM — Bus approaches Stop 4 (parent's stop)
    │  Stream Processor calculates ETA every 30s
    │  When ETA crosses 10 min threshold:
    │    → Notifications Service → FCM push to parents at Stop 4
    │    "Bus 7 is 10 minutes away"
    │  When ETA crosses 5 min threshold:
    │    → Second push: "Bus 7 is 5 minutes away — heading out now"
    ▼
07:43 AM — Bus arrives at Stop 4
    │  Bus coordinates within 100m of stop geofence
    │  → Push: "Bus 7 has arrived at your stop"
    │  Stream Processor updates stop as visited in Redis
    ▼
08:15 AM — Bus arrives at school
    │  Bus coordinates within 200m of school geofence
    │  → Push to all route parents: "All children have arrived at school"
    │  Driver taps "End Trip"
    │  Server writes completed trip to TimescaleDB
    │  Redis clears live state for this bus
    ▼
Trip complete. All events written to PostgreSQL for audit.
```

### 4.2 Parent App Connection Flow

```
Parent opens app
    │
    ▼
App checks JWT token validity
    │  Valid: proceed
    │  Expired: refresh via POST /auth/refresh
    │  Invalid: redirect to login
    ▼
App fetches child's route (React Query, cached 5 min)
    GET /api/v1/children/:childId/route
    ▼
App fetches current bus state (instant display)
    GET /api/v1/buses/:busId/live
    → Returns: { lat, lng, speed, eta, lastUpdate, tripActive }
    ▼
If trip is active:
    App connects WebSocket to LiveTrack Gateway
    ws://livetrack.saferide.in/connect
    Auth header: Bearer {jwt}
    ▼
    Server: validates JWT, extracts routeId
    Server: socket.join(`route:${routeId}`)
    ▼
    Redis pub/sub fires every 5s →
    Server emits 'busLocation' event to room →
    App receives { lat, lng, speedKmh, eta, stopIndex }
    App calls mapRef.animateTo(lat, lng)
    ▼
If trip is NOT active:
    App shows "Bus has not departed yet"
    App shows scheduled departure time
    App enters polling mode (check every 60s for trip start)
```

### 4.3 Alert Flow

```
GPS event received in stream-processor
    │
    ├─ Speed check:
    │   speedKmh > threshold (default: 60)
    │   → emit saferide.alerts.speed-exceeded
    │   → Notifications: push to transport manager
    │   → Write to alerts table
    │
    ├─ Route deviation check:
    │   haversineDistance(currentPos, nearestRoutePoint) > 500m
    │   → emit saferide.trips.deviation-detected
    │   → Notifications: push to transport manager + principal
    │   → Write to alerts table
    │
    ├─ Device offline check:
    │   lastUpdate > 5 minutes ago AND trip is active
    │   → emit saferide.devices.offline
    │   → In-app alert on transport manager dashboard
    │
    └─ SOS / Panic button:
        AIS-140 device OR driver taps SOS in app
        → emit saferide.gps.sos-triggered  (priority queue)
        → Push to transport manager + principal (immediate)
        → SMS to principal (FCM may not wake phone)
        → Forward to AIS-140 state control room IP
        → Write incident to DB with all context
```

---

## 5. Real-Time GPS Pipeline

### 5.1 MQTT Ingestion (Hardware Devices)

For schools that have functioning AIS-140 hardware, the device connects to EMQX.

```
AIS-140 Device                    EMQX Broker                    Kafka
─────────────                    ─────────────                    ─────
Power on
    │
    ├─ Connect to MQTT broker
    │   Host: mqtt.saferide.in:8883 (TLS)
    │   Auth: username=imei, password=hmac(imei+secret+epoch)
    │
    ├─ Subscribe to: saferide/devices/{imei}/commands
    │   (for OTA config, trip assignment)
    │
    └─ Publish every 30s:
        Topic: saferide/devices/{imei}/location
        Payload: {
          "lat": 12.9716,
          "lng": 77.5946,
          "speed": 42,
          "heading": 180,
          "timestamp": 1711958400000,
          "sos": false
        }
              │
              ▼
        EMQX receives message
        EMQX rule engine:
          WHERE topic =~ 'saferide/devices/+/location'
          ACTION: forward to Kafka
              │
              ▼
        Kafka topic: saferide.gps.raw
        Message key: imei (ensures ordering per device)
```

### 5.2 Phone GPS Ingestion (Primary)

```
Driver App                        API Server                      Kafka
──────────                        ──────────                      ─────
Background GPS task fires
    │
    │  Online path:
    ├─ POST /api/v1/gps/broadcast
    │  Headers: Authorization: Bearer {driverJwt}
    │  Body: { lat, lng, speedKmh, headingDeg, accuracy, timestamp }
    │              │
    │              ▼
    │        Auth middleware validates JWT
    │        Extracts: driverId, busId, tenantId
    │              │
    │              ▼
    │        Telemetry Ingestor Service
    │        Maps driver → bus → route → tenantId
    │              │
    │              ▼
    │        Produces to Kafka:
    │        Topic: saferide.gps.location-received
    │        Message: {
    │          eventType: 'GpsLocationReceived',
    │          tenantId, busId, tripId,
    │          lat, lng, speedKmh,
    │          source: 'driver_app',     ← Always labeled
    │          timestamp
    │        }
    │
    │  Offline path:
    └─ SQLite queue stores point locally
       NetworkInfo listener watches for connection
       On reconnect: POST /api/v1/gps/broadcast/batch
       Server processes batch in order (timestamp-sorted)
```

### 5.3 Stream Processor Pipeline

```
Kafka Consumer (stream-processor service)
reads from: saferide.gps.location-received
consumer group: stream-processor-group
                │
                ▼
┌───────────────────────────────────────────────────────┐
│  For each GPS event:                                  │
│                                                       │
│  1. VALIDATE                                          │
│     - lat/lng within India bounds                     │
│     - speed < 200 km/h (plausibility)                 │
│     - timestamp within last 5 minutes                 │
│     - busId exists and is active                      │
│     → If invalid: log + skip + DLQ                    │
│                                                       │
│  2. ENRICH                                            │
│     - Fetch route from Redis cache                    │
│     - Find nearest route stop                         │
│     - Calculate ETA to each upcoming stop             │
│     - Find nearest route polyline point               │
│                                                       │
│  3. UPDATE LIVE STATE (Redis)                         │
│     GEOADD bus:live:{tenantId} {lng} {lat} {busId}    │
│     HSET bus:state:{busId}                            │
│       lat {lat} lng {lng}                             │
│       speed {speedKmh}                                │
│       heading {headingDeg}                            │
│       lastUpdate {timestamp}                          │
│       currentStop {stopIndex}                         │
│       etaNextStop {etaMs}                             │
│                                                       │
│  4. PUBLISH TO WEBSOCKET CLIENTS                      │
│     redis.publish(`route:{routeId}:location`, {       │
│       busId, lat, lng, speedKmh, eta, stopIndex       │
│     })                                                │
│                                                       │
│  5. WRITE TO TIMESCALEDB (async, batched)             │
│     INSERT INTO gps_telemetry ...                     │
│     Batched: 100 points or 2s, whichever comes first  │
│                                                       │
│  6. EVALUATE ALERT RULES                              │
│     - Speed threshold check                           │
│     - Route deviation check                           │
│     - ETA notification thresholds                     │
│     - Device offline detection                        │
│     → Any triggered: produce to saferide.alerts       │
└───────────────────────────────────────────────────────┘
```

### 5.4 ETA Calculation

```ts
// services/eta.service.ts

interface ETAResult {
  etaMs: number           // Milliseconds from now
  etaMinutes: number      // Rounded for display
  confidence: 'high' | 'medium' | 'low'
  distanceM: number
}

async function calculateETA(
  busPosition: LatLng,
  targetStop: RouteStop,
  routePolyline: LatLng[],
  currentSpeedKmh: number,
  tenantId: string,
  routeId: string
): Promise<ETAResult> {

  // Step 1: Find current position on polyline
  const nearestPointIndex = findNearestPolylinePoint(busPosition, routePolyline)

  // Step 2: Calculate remaining polyline distance to target stop
  const remainingPolyline = routePolyline.slice(nearestPointIndex)
  const distanceM = calculatePolylineLength(remainingPolyline, targetStop.coords)

  // Step 3: Rolling average speed (last 3 minutes of data)
  const rollingSpeedKmh = await getHistoricalAverageSpeed(
    tenantId, routeId, windowMinutes=3
  ) ?? currentSpeedKmh

  // If stopped or very slow, use minimum speed for ETA
  const effectiveSpeedKmh = Math.max(rollingSpeedKmh, 5)

  // Step 4: Count intermediate stops and apply historical dwell time
  const stopsRemaining = countStopsBetween(nearestPointIndex, targetStop, routePolyline)
  const avgDwellMs = await getHistoricalDwellTime(tenantId, routeId) ?? 45000 // 45s default

  // Step 5: Calculate raw ETA
  const travelMs = (distanceM / 1000) / effectiveSpeedKmh * 3600 * 1000
  const rawEtaMs = travelMs + (stopsRemaining * avgDwellMs)

  // Step 6: Compare to historical p50 for this stop at this time of day
  const historicalEtaMs = await getHistoricalETA(tenantId, routeId, targetStop.id, new Date())
  const confidence = historicalEtaMs
    ? (Math.abs(rawEtaMs - historicalEtaMs) < 120000 ? 'high' : 'medium')
    : 'low'

  return {
    etaMs: rawEtaMs,
    etaMinutes: Math.round(rawEtaMs / 60000),
    confidence,
    distanceM
  }
}
```

---

## 6. Live Bus Video Architecture

### 6.1 Overview

Bus video serves two distinct use cases with different technical requirements:

| Use Case | Latency Need | Bandwidth | Storage | When |
|---|---|---|---|---|
| Live view (parent watching) | <3 seconds | 500kbps–2mbps | None | Trip is active |
| Incident playback | N/A | N/A | 30-day rolling | After an event |
| SOS clip | Near real-time | 500kbps | Permanent | SOS triggered |
| Admin monitoring | <5 seconds | 500kbps | None | Fleet oversight |

Two protocols handle these cases:
- **WebRTC** → Live view (sub-3s latency, peer-to-peer with SFU)
- **HLS** → Incident playback (HTTP, works everywhere, higher latency)

### 6.2 Video Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VIDEO SOURCE OPTIONS                        │
│                                                                 │
│  Option A: Driver Phone Camera    Option B: Dashcam Hardware    │
│  (Phase 1 — zero hardware cost)   (Phase 3 — premium offering)  │
│  ┌──────────────────────────┐     ┌──────────────────────────┐  │
│  │ React Native              │     │ Dedicated dashcam        │  │
│  │ expo-camera               │     │ Hikvision / Viofo        │  │
│  │ getUserMedia() via WebView│     │ RTSP stream output       │  │
│  │ 720p @ 15fps              │     │ 1080p @ 30fps            │  │
│  └──────────┬───────────────┘     └──────────┬───────────────┘  │
└─────────────┼───────────────────────────────┼───────────────────┘
              │  WebRTC offer/answer            │  RTSP
              ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MEDIA SERVER LAYER                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              mediasoup SFU Cluster                      │   │
│  │  (Selective Forwarding Unit — routes streams to viewers) │   │
│  │                                                         │   │
│  │  Room: bus_{busId}_{tripId}                            │   │
│  │  Producer: driver phone / dashcam                      │   │
│  │  Consumers: parents, admin dashboard, recorder          │   │
│  │                                                         │   │
│  │  Max concurrent viewers per bus: 50                    │   │
│  │  Bitrate adaptation: 200kbps – 2mbps                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────┬───────────────────────────┬───────────────────────────┘
          │                           │
          │ Live stream to clients     │ Recording stream
          ▼                           ▼
┌─────────────────┐         ┌─────────────────────────────────┐
│ WebRTC clients  │         │         Recording Pipeline      │
│ (parent app,    │         │                                 │
│  admin portal)  │         │  mediasoup → GStreamer/FFmpeg   │
│ <3s latency     │         │  → HLS segments (.ts files)     │
│                 │         │  → S3 bucket (saferide-video)   │
│                 │         │  → CloudFront CDN               │
└─────────────────┘         └─────────────────────────────────┘
```

### 6.3 Live Video Flow — Parent Watching

```
Parent taps "Watch Live" on bus detail screen
    │
    ▼
App: GET /api/v1/buses/:busId/video/session
    Server checks:
    - Trip is currently active
    - Parent has a child on this bus
    - Tenant has video feature enabled
    - Current viewer count < maxViewers limit
    │
    ▼
Server creates WebRTC session:
    {
      sessionToken: "jwt_scoped_to_this_session",
      mediasoupRouterUrl: "wss://video1.saferide.in",
      rtpCapabilities: { ... }
    }
    │
    ▼
App connects to mediasoup via WebSocket:
    wss://video1.saferide.in/transport
    Sends: { sessionToken, action: 'consume' }
    │
    ▼
Server-side SFU:
    Creates WebRTC transport for this consumer
    Returns transport parameters (ICE candidates, DTLS)
    │
    ▼
App: WebRTC handshake completes
    ICE gathering → DTLS negotiation → RTP media flowing
    │
    ▼
App: Renders <RTCView /> with remote stream
    Video appears — latency <3 seconds from camera
    │
    ▼
When parent navigates away:
    App: sends { action: 'close' } to mediasoup WS
    Server: cleans up transport, decrements viewer count
    Session token invalidated
```

### 6.4 Recording & Incident Playback Flow

```
Trip starts
    │
    ▼
Video Service: calls mediasoup
    createPipeTransport() → GStreamer sink
    Begin continuous recording:
    
    mediasoup RTP → GStreamer → FFmpeg → HLS segments
    Segment duration: 10 seconds
    Output: trip_{tripId}/segment_{n}.ts
    Manifest: trip_{tripId}/playlist.m3u8
    │
    ▼ (every 10 seconds)
    Segments uploaded to S3: s3://saferide-video/{tenantId}/{date}/{tripId}/
    S3 lifecycle policy: delete after 30 days (DPDP compliance)
    CloudFront distribution serves segments for playback
    │
    ▼
SOS triggered (special case):
    Last 60 seconds of buffer → immediate upload as sos_{incidentId}.mp4
    Never auto-deleted — permanent record
    Accessible only by principal + SafeRide ops (dual auth required)
    │
    ▼
Trip ends:
    Final segments uploaded
    GStreamer pipeline closed
    playlist.m3u8 finalized (EXT-X-ENDLIST added)
    
Incident Playback (transport manager or principal):
    GET /api/v1/trips/:tripId/video
    Server returns signed CloudFront URL (expires in 1 hour)
    Client loads HLS stream:
    
    <video src="https://cdn.saferide.in/{tripId}/playlist.m3u8" />
    
    Browser / React Native Video player handles:
    - Segment fetching
    - Buffering
    - Adaptive bitrate
    
    Manager can correlate GPS timeline with video:
    Clicking timestamp on map playback → seeks video to that moment
```

### 6.5 Bandwidth & India Network Considerations

India's mobile networks are variable. Video must degrade gracefully.

```
Network Detection → Bitrate Selection
──────────────────────────────────────

4G / WiFi (>10 Mbps):
  Live stream: 1080p → 720p → 480p (adaptive)
  Recording: Full quality, 2Mbps

4G (2–10 Mbps):
  Live stream: 720p @ 800kbps
  Recording: 480p @ 600kbps

3G / Edge (<2 Mbps):
  Live stream: DISABLED (show "Poor connection — live video unavailable")
  Recording playback: Low-quality HLS (360p @ 300kbps)

Offline:
  Live: Not possible (show cached last frame + GPS data)
  Playback: Not possible
```

```ts
// hooks/useVideoQuality.ts

import NetInfo from '@react-native-community/netinfo'

export function useVideoQuality() {
  const [quality, setQuality] = useState<VideoQuality>('auto')

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (!state.isConnected) {
        setQuality('offline')
      } else if (state.type === 'wifi') {
        setQuality('high')      // 720p+
      } else if (state.details?.cellularGeneration === '4g') {
        setQuality('medium')    // 480p
      } else {
        setQuality('disabled')  // 3G and below: no live video
      }
    })
    return unsubscribe
  }, [])

  return quality
}
```

### 6.6 Video Privacy & Legal Rules

Video of children in school buses is sensitive personal data under DPDP 2023.

```
Access Control:
  Live view:
    - Parents: own child's bus only
    - Transport manager: all buses in their tenant
    - Principal: all buses (read-only)
    - SafeRide ops: emergency/incident access only (logged)

  Recordings:
    - Parents: cannot access recordings (privacy — other children visible)
    - Transport manager: can access their fleet recordings (30-day window)
    - Principal: can access all recordings (30-day window)
    - Legal hold: SOS clips retained permanently, dual-auth required

Data Residency:
  All video stored in AWS ap-south-1 (Mumbai)
  Never leaves India

Retention Policy (DPDP compliant):
  Routine recordings: 30 days → auto-deleted
  SOS/incident clips: Permanent (legal evidence)
  Consent: Parent consents to recording at onboarding
  Notice: "Your child's bus is recorded for safety purposes"

CCTV equivalent disclaimer:
  Schools must notify students/parents per DPDP guidelines
  SafeRide provides standard consent language for school use
```

---

## 7. Data Architecture

### 7.1 Polyglot Persistence Strategy

```
                    ┌─────────────────────┐
                    │   What kind of data? │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    Time-series/GPS      Operational         Objects/Files
    (telemetry,          (users, schools,    (video, reports,
     alerts history)      routes, trips)      documents)
              │                │                │
              ▼                ▼                ▼
       TimescaleDB         PostgreSQL          AWS S3
    (extension of PG)    (primary RDBMS)   + CloudFront CDN
    Hypertable on time     Row-Level Sec     Signed URLs
    90-day retention       Multi-tenant       30-day lifecycle
              │                │
              └────────────────┘
                       │
                   Both fed by
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
         Redis 7             Redis 7
     (Geo live state)    (Sessions/Cache)
     GEOADD/GEORADIUS      SETEX, HSET
     Sub-ms reads          JWT blacklist
```

### 7.2 PostgreSQL Schema

```sql
-- ─── MULTI-TENANCY ──────────────────────────────────────────────
CREATE TABLE tenants (
  id          TEXT    PRIMARY KEY DEFAULT gen_cuid(),
  name        TEXT    NOT NULL,
  slug        TEXT    UNIQUE NOT NULL,   -- dps-bangalore
  udise_code  TEXT,
  city        TEXT,
  state       TEXT,
  plan        TEXT    DEFAULT 'starter', -- starter | growth | school | enterprise
  features    JSONB   DEFAULT '{}',       -- feature flags per tenant
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── CORE FLEET ─────────────────────────────────────────────────
CREATE TABLE buses (
  id            TEXT    PRIMARY KEY DEFAULT gen_cuid(),
  tenant_id     TEXT    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reg_number    TEXT    NOT NULL,
  device_imei   TEXT    UNIQUE,           -- nullable: phone-only buses
  capacity      INT     NOT NULL,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, reg_number)
);

-- ─── ROUTES & STOPS ──────────────────────────────────────────────
CREATE TABLE routes (
  id          TEXT    PRIMARY KEY DEFAULT gen_cuid(),
  tenant_id   TEXT    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  bus_id      TEXT    REFERENCES buses(id),
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE stops (
  id           TEXT    PRIMARY KEY DEFAULT gen_cuid(),
  route_id     TEXT    NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  tenant_id    TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  sequence     INT    NOT NULL,
  expected_arrival_morning   TIME,
  expected_arrival_afternoon TIME,
  UNIQUE(route_id, sequence)
);

-- ─── TRIPS ──────────────────────────────────────────────────────
CREATE TABLE trips (
  id          TEXT    PRIMARY KEY DEFAULT gen_cuid(),
  tenant_id   TEXT    NOT NULL,
  bus_id      TEXT    NOT NULL REFERENCES buses(id),
  route_id    TEXT    NOT NULL REFERENCES routes(id),
  driver_id   TEXT    NOT NULL,
  status      TEXT    DEFAULT 'idle',  -- idle | active | completed | cancelled
  started_at  TIMESTAMPTZ,
  ended_at    TIMESTAMPTZ,
  type        TEXT    DEFAULT 'morning', -- morning | afternoon | custom
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── GPS TELEMETRY (TimescaleDB hypertable) ───────────────────────
CREATE TABLE gps_telemetry (
  time          TIMESTAMPTZ   NOT NULL,
  tenant_id     TEXT          NOT NULL,
  bus_id        TEXT          NOT NULL,
  trip_id       TEXT,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  speed_kmh     REAL,
  heading_deg   REAL,
  accuracy_m    REAL,
  source        TEXT,          -- 'driver_app' | 'ais140_device'
  raw_nmea      TEXT           -- AIS-140 compliance: store original sentence
);

-- Convert to hypertable
SELECT create_hypertable('gps_telemetry', 'time');

-- Compress chunks older than 7 days (reduces storage by ~90%)
ALTER TABLE gps_telemetry SET (timescaledb.compress,
  timescaledb.compress_segmentby = 'bus_id, tenant_id');
SELECT add_compression_policy('gps_telemetry', INTERVAL '7 days');

-- Retain only 90 days (AIS-140 minimum requirement)
SELECT add_retention_policy('gps_telemetry', INTERVAL '90 days');

-- ─── VIDEO SESSIONS ──────────────────────────────────────────────
CREATE TABLE video_sessions (
  id              TEXT    PRIMARY KEY DEFAULT gen_cuid(),
  tenant_id       TEXT    NOT NULL,
  trip_id         TEXT    REFERENCES trips(id),
  bus_id          TEXT    NOT NULL,
  recording_path  TEXT,    -- S3 key for HLS manifest
  status          TEXT    DEFAULT 'recording', -- recording | completed | sos_clip
  started_at      TIMESTAMPTZ DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  file_size_mb    REAL,
  duration_s      INT,
  is_sos_clip     BOOLEAN DEFAULT false,
  sos_incident_id TEXT
);

-- ─── ROW-LEVEL SECURITY ──────────────────────────────────────────
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON buses
  USING (tenant_id = current_setting('app.current_tenant')::TEXT);
CREATE POLICY tenant_isolation ON routes
  USING (tenant_id = current_setting('app.current_tenant')::TEXT);
CREATE POLICY tenant_isolation ON trips
  USING (tenant_id = current_setting('app.current_tenant')::TEXT);
```

### 7.3 Redis Key Structure

```
# Live Bus State
bus:live:{tenantId}              → GEOADD sorted set (all buses for tenant)
bus:state:{busId}                → HASH { lat, lng, speed, heading, tripId, driverId, lastUpdate }
bus:trip:{busId}                 → STRING tripId (active trip for bus)

# ETA Cache (TTL: 30 seconds)
trip:eta:{tripId}:{stopId}       → STRING { etaMs, etaMinutes, confidence }

# WebSocket subscriptions
route:subs:{routeId}             → SET of socket IDs watching this route
parent:socket:{userId}           → STRING socketId (current WS connection)

# Session management
session:{jti}                    → STRING userId (TTL: 24 hours)
session:blacklist:{jti}          → STRING "1" (for revoked tokens)

# Rate limiting
ratelimit:{ip}:{endpoint}        → INCR counter (TTL: 60 seconds)

# Video session state
video:session:{busId}            → HASH { mediasoupRoomId, viewerCount, startedAt }
video:viewers:{busId}            → INCR counter

# Feature flags per tenant (low-TTL cache of DB state)
tenant:features:{tenantId}       → HASH { rfid_tap, video, liability_dashboard }
```

---

## 8. Backend Services

### 8.1 Service Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│  auth-service (:3001)                                        │
│  ─────────────────────────────────────────────────────────  │
│  OTP generation & verification (Firebase Phone Auth)        │
│  JWT issuance and refresh                                   │
│  Session management (Redis)                                 │
│  Driver credential management                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  tenant-service (:3002)                                      │
│  ─────────────────────────────────────────────────────────  │
│  School onboarding and profile management                   │
│  User roles and permissions                                 │
│  Feature flag management                                    │
│  Subscription and plan management                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  route-service (:3003)                                       │
│  ─────────────────────────────────────────────────────────  │
│  Bus CRUD                                                   │
│  Route and stop management                                  │
│  Student-to-stop assignments                                │
│  Driver assignments                                         │
│  CSV bulk import                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  telemetry-ingestor (:3004)                                  │
│  ─────────────────────────────────────────────────────────  │
│  Phone GPS HTTP endpoint (POST /gps/broadcast)              │
│  MQTT subscriber (EMQX bridge for hardware devices)         │
│  Source deduplication and merge                             │
│  Produces to: saferide.gps.location-received                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  stream-processor (Kafka consumer, no HTTP)                  │
│  ─────────────────────────────────────────────────────────  │
│  Consumes: saferide.gps.location-received                   │
│  Validates, enriches, updates Redis Geo                     │
│  Publishes to Redis pub/sub (→ WebSocket clients)           │
│  Writes to TimescaleDB (batched)                            │
│  Evaluates alert rules                                      │
│  Produces to: saferide.alerts.*                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  livetrack-gateway (:3005) [WebSocket]                       │
│  ─────────────────────────────────────────────────────────  │
│  WebSocket server (Socket.io)                               │
│  JWT auth on connection                                     │
│  Route room management                                      │
│  Subscribes to Redis pub/sub                                │
│  Emits 'busLocation' events to room                         │
│  Max 100,000 connections per pod (Socket.io cluster mode)   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  notifications-service (:3006)                               │
│  ─────────────────────────────────────────────────────────  │
│  Consumes: saferide.notifications.requested                 │
│  FCM push delivery (Firebase Admin SDK)                     │
│  SMS delivery (MSG91 India)                                 │
│  Delivery receipt tracking                                  │
│  Retry queue with exponential backoff                       │
│  Template management (multi-language)                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  trip-service (:3007)                                        │
│  ─────────────────────────────────────────────────────────  │
│  Trip lifecycle (start, pause, end, cancel)                 │
│  Trip history queries                                       │
│  Route playback data assembly                               │
│  CSV/PDF trip report export                                 │
│  TimescaleDB time-range queries                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  video-service (:3008)                                       │
│  ─────────────────────────────────────────────────────────  │
│  WebRTC session management (mediasoup orchestration)        │
│  Recording lifecycle (start, stop, finalize)                │
│  HLS segment upload to S3                                   │
│  Signed URL generation for playback                         │
│  SOS clip extraction and permanent storage                  │
│  Viewer count enforcement                                   │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Inter-Service Communication

```
Synchronous (HTTP):
  API Gateway → Any service via internal DNS
  Service → Service (rare, prefer events)
  example: route-service calls auth-service for token validation

Asynchronous (Kafka events):
  telemetry-ingestor → saferide.gps.location-received → stream-processor
  stream-processor   → saferide.alerts.*              → notifications-service
  trip-service       → saferide.trips.*               → notifications-service
  video-service      → saferide.video.sos-captured    → trip-service

No service calls another service's database directly.
If service A needs data owned by service B, it calls B's API.
```

---

## 9. Mobile App Architecture

### 9.1 Parent App State Machine

```
App launches
    │
    ├─ No JWT stored → LOGIN state
    │     OTP entry → phone verification
    │     School code entry → child linked
    │     → ACTIVE state
    │
    └─ JWT valid → CHECK TRIP STATE
          │
          ├─ Trip active (Redis: bus:trip:{busId} exists)
          │     → LIVE_TRACKING state
          │         - Connect WebSocket
          │         - Show live map
          │         - Schedule ETA notifications
          │
          ├─ Trip not started (before scheduled time)
          │     → WAITING state
          │         - Show scheduled departure time
          │         - Poll every 60s for trip start
          │
          └─ Trip completed (after school hours)
                → IDLE state
                    - Show last trip summary
                    - Option to view history


LIVE_TRACKING state:
    WebSocket connected
        │
        ├─ 'busLocation' event received
        │     → Update Zustand store
        │     → Animate map marker
        │     → Recalculate displayed ETA
        │
        ├─ WebSocket disconnected
        │     → Show "Reconnecting..." banner
        │     → Show last-known position with timestamp
        │     → Exponential backoff reconnect (1s, 2s, 4s ... 30s max)
        │
        └─ Trip ended event received
              → Disconnect WebSocket
              → Show "Arrived at school" screen
              → Log completed trip to local SQLite
```

### 9.2 Driver App State Machine

```
App launches
    │
    ├─ No credentials → LOGIN (school provides driver code)
    │
    └─ Credentials valid
          │
          ├─ No active trip scheduled → STANDBY
          │     Show next scheduled trip time
          │     Tap to view route
          │
          └─ Trip scheduled or tap "Start Trip"
                │
                ▼
            PRE-TRIP CHECKLIST (optional, configurable per school)
            □ Vehicle condition OK
            □ CCTV/camera functional
            □ All students accounted for at school
                │
                ▼
            ACTIVE TRIP
            - GPS background task started
            - Video streaming started (if feature enabled)
            - Large "SOS" button always visible
            - Route progress shown (current stop, next stop)
                │
                ├─ Stop reached → Mark stop as visited
                │
                ├─ SOS tapped →
                │     Immediate: saferide.gps.sos-triggered Kafka event
                │     App shows: "Emergency services notified"
                │     Video clip saved permanently
                │
                └─ End Trip tapped
                      - GPS task stopped
                      - Video streaming stopped
                      - POST /api/v1/trips/:tripId/end
                      - IDLE state
```

### 9.3 Zustand Store Structure

```ts
// store/livetrack.store.ts

interface LiveTrackStore {
  // Connection state
  wsStatus:   'connecting' | 'connected' | 'reconnecting' | 'offline'
  lastConnectedAt: number | null

  // Bus state
  busPosition:   { lat: number; lng: number } | null
  busSpeed:      number
  busHeading:    number
  lastUpdatedAt: number | null
  isStale:       boolean    // true if lastUpdatedAt > 30s ago

  // Trip state
  tripActive:    boolean
  currentStopIndex: number
  completedStops: string[]

  // ETA
  etaToMyStop:       number | null  // milliseconds
  etaDisplayString:  string         // "4 min" | "Arriving" | "Arrived"
  etaConfidence:     'high' | 'medium' | 'low'

  // Actions
  connect:          (routeId: string) => void
  disconnect:       () => void
  updatePosition:   (payload: BusLocationPayload) => void
  setTripStatus:    (active: boolean) => void
}
```

---

## 10. Notifications Engine

### 10.1 Notification Flow

```
Alert triggered (in stream-processor or rules-engine)
    │
    ▼
Produce to Kafka: saferide.notifications.requested
Message: {
  tenantId,
  type:     'BUS_APPROACHING' | 'TRIP_STARTED' | 'SOS' | 'DELAY' | ...,
  audience: 'stop_parents' | 'route_parents' | 'transport_manager' | 'principal',
  payload:  { busId, stopId, etaMinutes, ... },
  priority: 'normal' | 'high' | 'critical',
  channels: ['push', 'sms']  // which channels to use
}
    │
    ▼
notifications-service consumes message
    │
    ├─ Resolve recipients:
    │    audience = 'stop_parents'
    │    → SELECT parent_fcm_tokens WHERE stop_id = {stopId}
    │    Also fetch phone numbers for SMS fallback
    │
    ├─ Build message from template (language-aware):
    │    template: "BUS_APPROACHING"
    │    language: parent.preferredLanguage ?? tenant.defaultLanguage ?? 'en'
    │    variables: { etaMinutes: 4, busNumber: '7', stopName: 'Indiranagar 5th' }
    │    → "Bus 7 is 4 minutes from Indiranagar 5th Cross"
    │    → Hindi: "बस 7 अब 4 मिनट में इंदिरानगर 5वें क्रॉस पर होगी"
    │
    ├─ FCM push (batch up to 500 tokens):
    │    firebase.messaging().sendMulticast({
    │      tokens: [...fcmTokens],
    │      notification: { title, body },
    │      data: { busId, type, etaMinutes, deepLink }
    │    })
    │    Track delivery: store receipt in notifications table
    │
    └─ SMS fallback:
         For each token that returned 'UNREGISTERED' or after 30s no receipt
         → MSG91 API → SMS to parent's phone number
         SMS text: 60 chars max (single SMS in India)
```

### 10.2 Notification Templates

```ts
// packages/notifications/src/templates/index.ts

const templates: Record<string, Record<Language, NotificationTemplate>> = {

  BUS_APPROACHING_10MIN: {
    en: {
      title: 'Bus {busNumber} in {etaMinutes} minutes',
      body:  'Heading to {stopName}. Get ready.',
    },
    hi: {
      title: 'बस {busNumber} {etaMinutes} मिनट में',
      body:  '{stopName} की तरफ आ रही है। तैयार हो जाएं।',
    },
    kn: {
      title: 'ಬಸ್ {busNumber} {etaMinutes} ನಿಮಿಷಗಳಲ್ಲಿ',
      body:  '{stopName} ಗೆ ಬರುತ್ತಿದೆ. ಸಿದ್ಧರಾಗಿ.',
    },
    ta: {
      title: 'பஸ் {busNumber} {etaMinutes} நிமிடங்களில்',
      body:  '{stopName} நோக்கி வருகிறது.',
    },
    te: { title: 'బస్ {busNumber} {etaMinutes} నిమిషాల్లో', body: '...' },
    mr: { title: 'बस {busNumber} {etaMinutes} मिनिटांत', body: '...' },
    ml: { title: 'ബസ് {busNumber} {etaMinutes} മിനിറ്റിൽ', body: '...' },
  },

  SOS_TRIGGERED: {
    en: {
      title: 'EMERGENCY — Bus {busNumber}',
      body:  'SOS triggered. Location: {locationDescription}. Call driver immediately.',
    },
    // ... all languages
  },

}
```

---

## 11. AIS-140 Compliance Layer

### 11.1 Compliance Flow

```
The government requires:
  1. GPS device in every school bus (hardware — school's responsibility)
  2. PVT data forwarded to state control room IP in real-time
  3. Emergency event forwarded to emergency IP on SOS
  4. 90-day data retention

SafeRide satisfies requirement 2 & 3 from phone GPS:

Phone GPS data (30s updates)
    │
    ▼
Telemetry Ingestor formats as AIS-140 PVT:
{
  imei:     bus.deviceImei ?? phoneIdentifier,
  lat:      location.lat,
  lng:      location.lng,
  speed:    location.speedKmh,
  heading:  location.headingDeg,
  timestamp: location.timestamp,
  vin:      bus.regNumber,
  sos:      false
}
    │
    ▼
AIS-140 Forwarder Service:
    ├─ Send to Primary IP (government control room)
    │    Protocol: TCP socket (AIS-140 spec)
    │    Format: NMEA-like string
    │    Example: $GPRMC,083000,A,1258.2976,N,07733.7104,E,23.1,180.5,...*2B
    │
    └─ Send to Secondary IP (emergency response)
         Only on SOS events
         Immediate priority queue bypass
```

### 11.2 Data Retention

```
TimescaleDB retention policy handles the 90-day requirement automatically.

Manual audit query (for compliance reporting):
SELECT
  date_trunc('day', time)   AS trip_date,
  bus_id,
  COUNT(*)                   AS location_points,
  MIN(time)                  AS first_point,
  MAX(time)                  AS last_point,
  MAX(speed_kmh)             AS max_speed
FROM gps_telemetry
WHERE tenant_id = $1
  AND time > NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC;
```

---

## 12. Infrastructure & Deployment

### 12.1 AWS Architecture

```
Region: ap-south-1 (Mumbai) — all data stays in India

┌─────────────────────────────────────────────────────────┐
│  VPC: 10.0.0.0/16                                       │
│                                                         │
│  Public Subnets (3 AZs):                               │
│    - Application Load Balancer                          │
│    - NAT Gateways                                       │
│    - EMQX MQTT Broker (EC2, 2 nodes)                   │
│    - mediasoup Media Servers (EC2, variable)            │
│                                                         │
│  Private Subnets (3 AZs):                              │
│    - EKS Node Groups (application services)             │
│    - RDS PostgreSQL (Multi-AZ)                          │
│    - ElastiCache Redis                                  │
│    - Amazon MSK (Kafka)                                 │
│                                                         │
│  Services:                                              │
│    - S3 (video, reports, app assets)                   │
│    - CloudFront (video CDN, admin portal)               │
│    - Route 53 (DNS)                                     │
│    - ACM (SSL certificates)                             │
│    - CloudWatch (logs, metrics)                         │
│    - Secrets Manager (credentials)                      │
└─────────────────────────────────────────────────────────┘
```

### 12.2 Kubernetes Deployment

```yaml
# infra/k8s/helm/saferide/values.yaml

services:
  auth-service:
    replicas: 2
    resources:
      requests: { cpu: "250m", memory: "256Mi" }
      limits:   { cpu: "500m", memory: "512Mi" }
    hpa:
      minReplicas: 2
      maxReplicas: 8
      targetCPUUtilizationPercentage: 70

  telemetry-ingestor:
    replicas: 3
    resources:
      requests: { cpu: "500m", memory: "512Mi" }
      limits:   { cpu: "2",    memory: "1Gi"   }
    hpa:
      minReplicas: 3
      maxReplicas: 20          # Scales hard on morning peak
      targetCPUUtilizationPercentage: 65

  stream-processor:
    replicas: 3
    resources:
      requests: { cpu: "1",    memory: "1Gi"   }
      limits:   { cpu: "2",    memory: "2Gi"   }
    hpa:
      minReplicas: 3
      maxReplicas: 20
      # Also scales on Kafka consumer lag:
      external_metric: kafka_consumer_lag > 10000

  livetrack-gateway:
    replicas: 3
    resources:
      requests: { cpu: "500m", memory: "1Gi"   }
      limits:   { cpu: "1",    memory: "2Gi"   }
    hpa:
      minReplicas: 3
      maxReplicas: 15          # 100K WebSocket connections per pod
      # Scale on active connections:
      external_metric: websocket_connections_per_pod > 80000

  video-service:
    replicas: 2
    resources:
      requests: { cpu: "1",    memory: "2Gi"   }
      limits:   { cpu: "4",    memory: "4Gi"   }
    hpa:
      minReplicas: 2
      maxReplicas: 10
      targetCPUUtilizationPercentage: 60
```

### 12.3 CI/CD Pipeline

```
Developer pushes to feature branch
    │
    ▼
GitHub Actions: PR checks
    ├─ pnpm run typecheck (all packages)
    ├─ pnpm run lint (zero warnings allowed)
    ├─ pnpm run test (unit tests)
    └─ Build Docker image (validate it builds)

PR approved + merged to main
    │
    ▼
GitHub Actions: Deploy pipeline
    ├─ Run full test suite (unit + integration)
    │    Integration tests use real PostgreSQL + Redis (Docker)
    ├─ Build Docker images for changed services (Turborepo detects)
    ├─ Push to AWS ECR with git SHA tag
    ├─ Update Helm values: image.tag = {git-sha}
    └─ Commit to infra-repo (triggers ArgoCD)

ArgoCD detects infra-repo change
    │
    ▼
ArgoCD syncs Kubernetes cluster
    Rolling update strategy:
    - maxUnavailable: 0   (never take a pod down before new one is ready)
    - maxSurge: 1         (bring up one extra pod during deploy)
    Readiness probe gates traffic:
    - /health returns 200 before pod receives traffic
    Automated rollback:
    - If new pods fail readiness within 5 min → ArgoCD reverts

Total pipeline time: 6–10 minutes push to production
```

---

## 13. Security Architecture

### 13.1 Authentication Flows

```
PARENT LOGIN:
    Enter mobile number
    → POST /auth/otp/send  { phone: "+91XXXXXXXXXX" }
    → Firebase sends OTP via SMS
    → Enter OTP
    → POST /auth/otp/verify { phone, otp }
    → Server verifies with Firebase Admin SDK
    → Issues JWT: { sub: userId, tenantId, role: 'parent', exp: +24h }
    → Stores session in Redis: session:{jti} = userId (TTL 24h)
    → Returns { accessToken, refreshToken }

DRIVER LOGIN:
    Enter school-issued driver code (6 chars)
    → POST /auth/driver/login { driverCode, deviceId }
    → Server validates code against drivers table
    → Issues JWT: { sub: driverId, busId, tenantId, role: 'driver' }
    → Binds device: stores deviceId for this driver

ADMIN / TRANSPORT MANAGER:
    Enter email + password
    → POST /auth/admin/login
    → bcrypt password comparison
    → Issues short-lived JWT (8h) + refresh token
    → TOTP 2FA required for principal and super-admin roles
```

### 13.2 Request Authentication Flow

```
Every API request:
    │
    ▼
API Gateway validates:
    - JWT signature (RS256 public key)
    - Token expiry
    - Token not in Redis blacklist (session:{jti} exists)
    │
    ▼
Injects headers:
    x-tenant-id: {tenantId}
    x-user-id: {userId}
    x-user-role: {role}
    │
    ▼
Service receives request
    Middleware sets:
    SET LOCAL app.current_tenant = '{tenantId}'
    → PostgreSQL RLS automatically applies
    → Queries cannot access other tenant data
```

### 13.3 Video Security

```
Live video access:
    Parent requests live view
    → Server verifies child is on this bus
    → Server issues single-use session token (TTL: 2 hours)
    → Session token used only for this WebRTC connection
    → If parent disconnects and reconnects: new token required
    → Viewer count tracked: parent cannot watch multiple buses

Recording access:
    Transport manager requests recording URL
    → Server verifies manager belongs to tenant that owns the bus
    → Generates CloudFront signed URL (expires in 1 hour)
    → URL is single-IP bound (cannot be shared)
    → All access logged to video_access_log table

SOS clips:
    Require dual authorization:
    1. Principal of the school
    2. SafeRide operations (on-call person)
    Both must authenticate via separate JWT tokens
    Access logged with reason and case ID
```

---

## 14. Observability & Monitoring

### 14.1 Key Metrics to Track

```
GPS Pipeline Health:
  saferide_gps_messages_per_second         ← ingest rate
  saferide_gps_pipeline_latency_p95        ← device → parent (target: <5s)
  saferide_kafka_consumer_lag              ← should stay near 0 during trips
  saferide_active_trips                    ← buses currently broadcasting

Parent App Health:
  saferide_websocket_connections           ← active parent connections
  saferide_map_update_latency_p95          ← time between position updates on map
  saferide_push_delivery_rate              ← FCM success % (target: >97%)

Video Health:
  saferide_video_active_streams            ← live streams running
  saferide_video_bitrate_avg               ← average stream quality
  saferide_recording_upload_lag            ← delay in S3 upload (target: <30s)
  saferide_video_session_errors            ← WebRTC connection failures

Business Metrics:
  saferide_active_schools                  ← tenants with active trips today
  saferide_parent_app_dau                  ← daily active parents
  saferide_notification_open_rate          ← push notification engagement
```

### 14.2 Alert Runbook (Critical)

```
Alert: GPS pipeline latency > 10s
  Check: Kafka consumer lag → if high, add stream-processor pods
  Check: Redis Geo write latency → if high, check Redis memory
  Check: Telemetry ingestor throughput → if dropping, check EMQX

Alert: Kafka consumer lag > 50,000 messages
  Action: Immediately scale stream-processor via HPA override
  kubectl scale deployment stream-processor --replicas=10

Alert: WebSocket gateway pod crash
  Action: ArgoCD will auto-restart
  Check: Connection refused errors in app → switch to polling fallback
  SMS to on-call if >2 pods down simultaneously

Alert: S3 video upload failing
  Check: IAM role permissions (most common cause)
  Check: S3 bucket policy
  Check: GStreamer/FFmpeg process on video-service pod
  Note: Trips continue normally — video is non-blocking

Alert: Database CPU > 85%
  Action: Check slow query log
  Short-term: Add read replica, route dashboard queries there
  Long-term: Add missing indexes
```

---

## 15. Build Progression — Ground 0 to Production

This section answers: **"Where do I start?"**

### 15.1 Phase 0 — Proof of Concept (Week 1–2)

**Goal:** One driver → Firebase → one parent sees a dot move.  
**Stack:** Expo + Firebase Realtime Database. No backend code.

```
What you build:
  apps/mobile/
    screens/
      DriverScreen.tsx   → Start Trip button → writes GPS to Firebase
      ParentScreen.tsx   → Reads Firebase → shows dot on Google Map

Firebase structure:
  /buses/{busId}/location: { lat, lng, timestamp }

Code — Driver side:
  const startTrip = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000 },
      (location) => {
        set(ref(db, `buses/${busId}/location`), {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          timestamp: Date.now()
        })
      }
    )
  }

Code — Parent side:
  useEffect(() => {
    const busRef = ref(db, `buses/${busId}/location`)
    onValue(busRef, (snapshot) => {
      const data = snapshot.val()
      setMarkerPosition({ lat: data.lat, lng: data.lng })
    })
  }, [])

Done. Show it to someone. This is your MVP.
```

**What you explicitly do NOT build yet:**
- Multi-tenant anything
- Authentication
- Push notifications
- Multiple buses
- Trip management

### 15.2 Phase 1 — First Real School (Week 3–6)

**Goal:** One school, one transport manager, 50 parents, everything works reliably.

```
New additions:
  - Simple Node.js + Express backend (no Fastify yet)
  - PostgreSQL on Railway or Supabase (managed, zero ops)
  - OTP login (Firebase Phone Auth)
  - School code to link parent to bus
  - Basic push notification when bus approaches stop
  - Driver app persistence (trip start/end)

What moves from Firebase → Postgres:
  - User accounts
  - Bus and route configuration
  - Trip history

What STAYS on Firebase:
  - Real-time location (Firebase Realtime Database is fine for 1 school)
  - Firebase still handles <10K concurrent connections for free

Why not build Kafka/Redis yet:
  - Firebase handles real-time at this scale
  - Adding Kafka for 50 parents is over-engineering
  - You need to learn what parents actually need before building infrastructure
```

### 15.3 Phase 2 — 5–20 Schools (Month 2–4)

**Goal:** Paying customers, reliable operations, team of 2–3 engineers.

```
Upgrades:
  - Move real-time GPS from Firebase → Redis Pub/Sub
    (Firebase free tier hits limits at ~10 concurrent buses)
  - Add proper auth service (replace Firebase Auth with own JWT)
  - Add transport manager web dashboard (React, single page)
  - Add SMS fallback (MSG91)
  - Add multi-language notifications
  - Move to PostgreSQL on RDS (own the database)

Still not needed:
  - Kafka (Redis pub/sub handles <100 buses fine)
  - EMQX (phone GPS is the source, no device MQTT yet)
  - Kubernetes (2–3 services on EC2 or Railway)
  - mediasoup video (not yet)

Infrastructure at this stage:
  - 2 EC2 instances (t3.medium) running Docker Compose
  - RDS PostgreSQL (db.t3.micro)
  - ElastiCache Redis (cache.t3.micro)
  - Very cheap: ~₹15,000/month total
```

### 15.4 Phase 3 — 50–200 Schools (Month 5–12)

**Goal:** Operational reliability, video feature, RFID module beginning.

```
Upgrades:
  - Introduce Kafka (you now have real event volume worth buffering)
  - Move to Kubernetes / EKS (manual EC2 management doesn't scale)
  - Add EMQX for hardware GPS devices (schools ask for it)
  - Launch video feature (mediasoup + S3 + HLS)
  - Add RFID tap module (Phase 2 product)
  - Add liability dashboard
  - Add trip report exports

Engineering team: 4–6 engineers
Infrastructure: ~₹60,000–80,000/month
```

### 15.5 Phase 4 — 200+ Schools (Month 12+)

```
Upgrades:
  - Multi-region (add Hyderabad as secondary region)
  - Service mesh (Istio for inter-service observability)
  - Database sharding by tenant cluster
  - AI route optimization
  - ML-based ETA prediction (replace heuristic model)
  - Native iOS/Android apps (if React Native performance is insufficient)
```

### 15.6 The Build Progression at a Glance

```
Week 1–2:   Firebase + Expo     → 1 bus, 1 parent, proof it works
Month 1:    Express + Postgres  → 1 school, 50 parents, first paying customer
Month 2–4:  Redis + RDS         → 20 schools, 2,000 parents, stable ops
Month 5–12: Kafka + K8s + Video → 200 schools, 50K parents, full product
Month 12+:  Scale infra         → 600+ schools, the architecture diagram is reality
```

---

## 16. Phase Roadmap Integration Points

### 16.1 How Modules Plug In

The GPS pipeline is the trunk that never changes. Each module publishes or consumes events.

```
Phase 1 (NOW):
  Driver phone → Telemetry Ingestor → Kafka → Stream Processor → Redis → Parent App

Phase 2 — RFID Tap:
  RFID reader tap → NEW: Tap Service → Kafka topic: saferide.tap.events
  Stream Processor ALSO subscribes to saferide.tap.events
  New notification type: StudentBoarded → same Notifications Service
  No changes to GPS pipeline

Phase 3 — School Gate:
  Gate NFC reader → Tap Service (same service, new event type: SchoolGateEntry)
  Chain of custody: phone.boarded → bus.arrived_school → gate.entered_school
  No changes to GPS pipeline or RFID module

Phase 4 — Liability Dashboard:
  New service: Liability Service
  Consumes: saferide.tap.events + saferide.trips.* + saferide.gps.sos-triggered
  Builds: per-student daily timeline
  Writes to: liability_events table
  Exposes: REST API for dashboard + PDF export
  No changes to any existing service
```

### 16.2 Feature Flag Control

```ts
// Every non-core feature is behind a flag

// middleware/feature-gate.middleware.ts
export function requireFeature(feature: FeatureFlag) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const flags = await getTenantFeatures(req.tenantId)
    if (!flags[feature]) {
      return reply.status(402).send({
        success: false,
        error: {
          code: 'FEATURE_NOT_ENABLED',
          message: `${feature} requires an upgraded plan`,
          upgradeUrl: 'https://saferide.in/upgrade'
        }
      })
    }
  }
}

// Usage:
router.get('/buses/:busId/video/session',
  { preHandler: [authenticate, requireFeature('video')] },
  videoController.getSession
)
```

---

## 17. Performance & Capacity Planning

### 17.1 The 8 AM Peak

Every weekday at 7:45–8:30 AM, the entire parent user base opens the app simultaneously.

```
At 200 schools (Month 12 target):
  - 200 schools × 10 buses avg = 2,000 active buses
  - 2,000 buses × 5s interval = 400 GPS events/minute = 6.7 msg/sec
  - 200 schools × 400 parents avg = 80,000 parent sessions
  - 80,000 WebSocket connections (3 livetrack-gateway pods = 27K each)
  - Push notifications: ~40,000 in 15-minute window
  
  All comfortably within designed capacity.

At 600 schools (Month 24):
  - 600 schools × 10 buses avg = 6,000 active buses
  - 6,000 × 2 = 12,000 GPS events/minute = 200 msg/sec
  - 240,000 parent sessions
  - Need: 5 livetrack-gateway pods (48K connections each)
  - Push: ~120,000 in 15 minutes → batch FCM handles this
```

### 17.2 Video Capacity

```
Live video bandwidth per bus:
  720p @ 800kbps = 100 KB/s per viewer
  
At 10 viewers per bus (high estimate):
  1,000 KB/s = 8 Mbps per bus
  
At 200 buses streaming:
  200 × 8 Mbps = 1.6 Gbps total outbound bandwidth
  AWS CloudFront handles this — it is the CDN's job
  Cost: ~$0.085/GB = ~$136/day at peak (₹11,000/day)
  
  This is why video is a premium feature billed separately.
  School pays for video access. Cost absorbed in video plan pricing.

HLS recording storage:
  720p @ 800kbps = 360 MB/hour per bus
  6-hour school day × 200 buses = 432 GB/day
  30-day retention = 12,960 GB = 12.7 TB
  S3 standard: $0.023/GB = ~$295/month (₹24,700/month)
  At 200 schools paying ₹5,000+/month for video: easily covered
```

---

## 18. Appendix

### 18.1 Environment Variables Reference

```bash
# apps/route-service/.env.example

# Server
PORT=3003
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/saferide
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_CLUSTER_MODE=false          # true in production

# Kafka
KAFKA_BROKERS=localhost:9092      # comma-separated in production
KAFKA_CLIENT_ID=route-service
KAFKA_GROUP_ID=route-service-group

# Auth
JWT_SECRET=minimum-32-chars-long-secret-here
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=30d

# Video (video-service only)
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=         # public IP of media server
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=49999
AWS_S3_VIDEO_BUCKET=saferide-video-prod
CLOUDFRONT_VIDEO_DOMAIN=https://video.saferide.in
CLOUDFRONT_KEY_PAIR_ID=         # for signed URLs
CLOUDFRONT_PRIVATE_KEY_PATH=    # path to PEM file

# Notifications
FCM_PROJECT_ID=saferide-prod
MSG91_API_KEY=
MSG91_SENDER_ID=SFRDE

# AIS-140 Compliance
AIS140_STATE_SERVER_IP=
AIS140_STATE_SERVER_PORT=
AIS140_EMERGENCY_IP=
AIS140_EMERGENCY_PORT=

# Monitoring
DATADOG_API_KEY=
SENTRY_DSN=
LOG_LEVEL=info
```

### 18.2 Kafka Topics Summary

| Topic | Producer | Consumer | Retention |
|---|---|---|---|
| `saferide.gps.location-received` | telemetry-ingestor | stream-processor | 7 days |
| `saferide.gps.sos-triggered` | telemetry-ingestor | notifications-service, trip-service | 90 days |
| `saferide.trips.started` | trip-service | notifications-service | 30 days |
| `saferide.trips.ended` | trip-service | notifications-service, video-service | 30 days |
| `saferide.trips.deviation-detected` | stream-processor | notifications-service | 30 days |
| `saferide.alerts.speed-exceeded` | stream-processor | notifications-service | 30 days |
| `saferide.notifications.requested` | multiple producers | notifications-service | 7 days |
| `saferide.notifications.delivered` | notifications-service | — (analytics only) | 7 days |
| `saferide.tap.events` | tap-service (Phase 2) | stream-processor, notifications | 90 days |
| `saferide.video.sos-captured` | video-service | trip-service | 365 days |
| `saferide.*.dlq` | consumer errors | alert on-call | 7 days |

### 18.3 API Endpoint Summary

```
Authentication:
  POST /auth/otp/send          → Send OTP to phone
  POST /auth/otp/verify        → Verify OTP, issue JWT
  POST /auth/driver/login      → Driver code login
  POST /auth/admin/login       → Email+password login
  POST /auth/refresh           → Refresh access token
  DELETE /auth/logout          → Invalidate session

Buses & Routes:
  GET    /api/v1/buses                 → List tenant's buses
  POST   /api/v1/buses                 → Create bus
  GET    /api/v1/buses/:id             → Get bus detail
  PATCH  /api/v1/buses/:id             → Update bus
  GET    /api/v1/buses/:id/live        → Current GPS state (Redis)
  GET    /api/v1/routes                → List routes
  POST   /api/v1/routes                → Create route
  POST   /api/v1/routes/:id/stops      → Add stop
  PATCH  /api/v1/routes/:id/stops/:sid → Update stop

Trips:
  POST   /api/v1/trips                 → Create trip (admin)
  GET    /api/v1/trips/:id             → Get trip detail
  POST   /api/v1/trips/:id/start       → Driver starts trip
  POST   /api/v1/trips/:id/end         → Driver ends trip
  GET    /api/v1/trips/:id/playback    → GPS timeline for playback
  GET    /api/v1/trips/:id/export      → Download CSV/PDF report

GPS:
  POST   /api/v1/gps/broadcast         → Driver phone location update
  POST   /api/v1/gps/broadcast/batch   → Offline queue flush

Video (feature-flagged):
  GET    /api/v1/buses/:id/video/session  → Get WebRTC session token
  GET    /api/v1/trips/:id/video          → Get signed HLS URL for playback
  GET    /api/v1/incidents/:id/video      → Get SOS clip (dual auth)

Children & Parents:
  POST   /api/v1/children              → Link child to parent account
  GET    /api/v1/children/:id/route    → Get child's bus and route
  PATCH  /api/v1/users/me/prefs        → Update notification preferences
```

### 18.4 Third-Party Service Accounts to Set Up

When starting from ground 0, set these up in order:

```
Day 1:
  □ Firebase project (Authentication + Realtime Database)
    → Needed for Phase 0 prototype
  □ Expo account
    → App builds and OTA updates
  □ Google Cloud account
    → Maps API key (Android + iOS both need their own)

Week 2:
  □ AWS account (use Free Tier to start)
    → S3 bucket for assets
    → Later: RDS, ElastiCache, EKS, MSK
  □ MSG91 account (Indian SMS provider)
    → Faster delivery than Twilio in India
    → Sender ID registration takes 3-7 days — start early

Month 1:
  □ Sentry (error tracking — free tier is enough to start)
  □ GitHub Actions (CI/CD — included with GitHub)
  □ Datadog or Grafana Cloud (monitoring)

Month 2+:
  □ Agora or mediasoup deployment (video)
  □ CloudFront distribution for video CDN
```

---

*SafeRide Technical Documentation v2.0 — March 2026*  
*Questions: engineering@saferide.in · Internal only*
