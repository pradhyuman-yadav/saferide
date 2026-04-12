# SafeRide — Build Checklist
> Ground 0 → Polished Product  
> One checkbox at a time. Do not read ahead. Focus only on the phase you are in.

---

## How to use this

**Read only the phase you are currently in.** Everything else is noise until you get there. Check boxes as you go. If a box blocks you for more than 2 days, skip it and come back — don't let one thing stop everything else.

**The phases are:**
- 🟤 **Phase 0** — Prove it works (2 weeks)
- 🟢 **Phase 1** — First real school (Month 1)
- 🔵 **Phase 2** — First 20 schools (Month 2–4)
- 🟣 **Phase 3** — Scale to 200 schools (Month 5–12)
- ⭐ **Phase 4** — Full polished product (Month 12+)

**One rule:** You cannot start Phase 2 until Phase 1 is done. That's it.

---

## 🟤 PHASE 0 — Prove It Works
### Goal: Driver taps Start → Parent sees a dot move on a map
### Stack: Expo + Firebase only. No backend. No database.
### Time: 2 weeks. Solo or 2 people.

---

### Week 1 — Setup & Driver Screen

#### Day 1 — Project Setup
- [ ] Install Node.js (LTS version) on your machine
- [ ] Install `pnpm` globally: `npm install -g pnpm`
- [ ] Install Expo CLI: `npm install -g expo-cli`
- [ ] Create Expo project: `npx create-expo-app saferide --template blank-typescript`
- [ ] Open in VS Code, confirm it runs: `npx expo start`
- [ ] Install Git and push initial project to GitHub (private repo)
- [ ] Create a `.env` file, add to `.gitignore` immediately

#### Day 2 — Firebase Setup
- [ ] Create a Firebase project at console.firebase.google.com
- [ ] Enable **Realtime Database** (not Firestore — RTDB is simpler for Phase 0)
- [ ] Set RTDB rules to `read: true, write: true` (only for dev — will be secured later)
- [ ] Enable **Authentication** → Phone Auth (you'll use this in Phase 1, set up now)
- [ ] Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
- [ ] Install Firebase SDK: `npx expo install firebase`
- [ ] Create `lib/firebase.ts` — initialise Firebase with your config
- [ ] Test: write a value to RTDB from your code, confirm it appears in the console

#### Day 3–4 — Driver Screen
- [ ] Create `screens/DriverScreen.tsx`
- [ ] Add a big green "Start Trip" button in the centre
- [ ] Add a "Stop Trip" button (initially hidden, shows after Start)
- [ ] Install location library: `npx expo install expo-location`
- [ ] Request location permissions when Start is tapped
- [ ] When permission granted: start watching GPS position
  ```ts
  Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000 },
    (location) => {
      // Write to Firebase here
    }
  )
  ```
- [ ] Write GPS to Firebase on every update:
  ```ts
  set(ref(db, 'buses/bus_001/location'), {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    timestamp: Date.now()
  })
  ```
- [ ] On "Stop Trip": stop location watching, clear Firebase value
- [ ] Test on a real Android phone (not simulator — GPS needs real device)

#### Day 5 — Fix Driver Screen Issues
- [ ] Walk around with your phone. Confirm GPS is updating in Firebase console.
- [ ] Handle the case where user denies permission (show a message)
- [ ] Handle the case where location is null (do not crash)
- [ ] Add a small status text: "Broadcasting GPS" / "Trip stopped"
- [ ] Test: close app and reopen — confirm location stops updating (add stop logic)

---

### Week 2 — Parent Screen & First Demo

#### Day 6–7 — Parent Screen
- [ ] Create `screens/ParentScreen.tsx`
- [ ] Install Google Maps: `npx expo install react-native-maps`
- [ ] Get a Google Maps API key (console.cloud.google.com → Maps SDK for Android/iOS)
- [ ] Add API key to `app.json` (Android and iOS sections)
- [ ] Render a full-screen `MapView` with a default region (use Bangalore or your city)
- [ ] Subscribe to Firebase RTDB for the bus location:
  ```ts
  onValue(ref(db, 'buses/bus_001/location'), (snapshot) => {
    const data = snapshot.val()
    if (data) setMarkerPosition({ lat: data.lat, lng: data.lng })
  })
  ```
- [ ] Add a `Marker` at `markerPosition`
- [ ] Test: open driver screen on one phone, parent screen on another. Confirm dot moves.

#### Day 8 — Navigation Between Screens
- [ ] Install navigation: `npx expo install @react-navigation/native @react-navigation/stack`
- [ ] Create a simple home screen with two buttons: "I am a Driver" and "I am a Parent"
- [ ] Tapping each routes to the correct screen
- [ ] Back button works on both screens

#### Day 9 — Show It To Someone
- [ ] Build and install on 2 phones (driver + parent)
- [ ] Give driver phone to a friend or family member
- [ ] Walk them through starting a trip while you watch on parent phone
- [ ] **Watch their face. Do not explain anything. See what confuses them.**
- [ ] Write down every question they asked and every thing that confused them

#### Day 10 — Fix The Obvious Problems
- [ ] Fix the top 3 things that confused people in your Day 9 test
- [ ] Make sure the app does not crash when internet is slow
- [ ] Make sure the map zooms to the bus marker automatically on load
- [ ] Add "Last updated X seconds ago" text below the map (so parent knows data is live)

---

### ✅ Phase 0 Complete When:
- [ ] A driver can start a trip on their phone
- [ ] A parent sees the dot moving on a map in real-time
- [ ] You have shown this to at least 3 real people (not developers)
- [ ] The app does not crash during a normal 10-minute demo

**Stop here. Do not add more features. Move to Phase 1.**

---

## 🟢 PHASE 1 — First Real School
### Goal: One school, one transport manager, ~50 parents, everything works reliably
### Stack: Add Node.js backend + PostgreSQL. Firebase stays for real-time.
### Time: 3–4 weeks.

---

### Week 1 — Backend Foundation

#### Account Setup (Do This First — Some Take Days)
- [ ] Create AWS account (free tier — you won't use it heavily yet)
- [ ] **Create MSG91 account immediately** — sender ID approval takes 3–7 days
  - Register at msg91.com
  - Apply for sender ID "SFRDE" (or your brand name)
  - Do not wait until you need SMS to do this
- [ ] Create Sentry account (sentry.io — free tier for error tracking)
- [ ] Create a Railway account (railway.app — for hosted PostgreSQL, cheapest start)

#### Project Structure
- [ ] Create `apps/backend/` folder in your repo
- [ ] Initialise: `pnpm init` → `pnpm add express typescript @types/node prisma @prisma/client`
- [ ] Create `tsconfig.json` (strict mode — copy from code structure doc)
- [ ] Create folder structure: `src/routes/`, `src/services/`, `src/repositories/`, `src/middleware/`
- [ ] Create `src/index.ts` — basic Express server that responds to `GET /health`
- [ ] Confirm server starts and `/health` returns `{ status: "ok" }`

#### Database Setup
- [ ] Provision PostgreSQL on Railway (takes 5 minutes, free tier)
- [ ] Copy the `DATABASE_URL` into your `.env`
- [ ] Initialise Prisma: `npx prisma init`
- [ ] Write initial schema (copy from tech doc, simplified):
  ```prisma
  model School {
    id        String @id @default(cuid())
    name      String
    code      String @unique  // 6-digit school code parents use
    createdAt DateTime @default(now())
    buses     Bus[]
  }

  model Bus {
    id         String @id @default(cuid())
    schoolId   String
    school     School @relation(fields: [schoolId], references: [id])
    regNumber  String
    active     Boolean @default(true)
  }

  model User {
    id      String @id @default(cuid())
    phone   String @unique   // E.164 format: +91XXXXXXXXXX
    role    String           // 'parent' | 'driver' | 'admin'
    schoolId String?
    childBusId String?       // Which bus parent's child is on
  }
  ```
- [ ] Run `npx prisma migrate dev --name initial`
- [ ] Confirm tables exist in Railway DB console

#### Authentication
- [ ] Install Firebase Admin SDK in backend: `pnpm add firebase-admin`
- [ ] Download Firebase service account JSON from Firebase console → Project Settings
- [ ] Store path in `.env` — never commit the JSON file
- [ ] Create `src/routes/auth.routes.ts`:
  - `POST /auth/otp/send` — calls Firebase to send OTP to phone number
  - `POST /auth/otp/verify` — verifies OTP with Firebase, returns JWT
- [ ] Create `src/middleware/auth.middleware.ts` — validates JWT on protected routes
- [ ] Test: send OTP to your own phone number, verify it, get a token

---

### Week 2 — Core App Features

#### School & Bus APIs
- [ ] `POST /schools` — create a school (admin only), generate 6-digit code
- [ ] `GET /schools/:code` — look up school by code (parent uses this to link)
- [ ] `POST /buses` — add a bus to a school
- [ ] `GET /schools/:id/buses` — list all buses for a school
- [ ] Create one test school in your database manually (use Prisma Studio: `npx prisma studio`)

#### Parent Onboarding in App
- [ ] Parent app: add OTP login screen
  - Phone number input (with +91 country prefix)
  - "Send OTP" button
  - 6-digit OTP input
  - On verify: store JWT in SecureStore
- [ ] Parent app: add school code screen
  - 6-digit code input
  - On submit: call `GET /schools/:code`, show school name for confirmation
  - On confirm: save schoolId to user profile, link to bus
- [ ] Parent app: show live map only after authentication
- [ ] Test: new parent goes through full onboarding in <3 minutes

#### Driver Login
- [ ] Admin creates driver accounts via a simple Prisma Studio insert (no UI yet)
- [ ] Driver logs in with phone OTP (same flow as parent, different role)
- [ ] After login, driver sees the trip screen with their assigned bus
- [ ] Driver's phone JWT passed with every GPS broadcast call

#### GPS via Backend (Replacing Firebase Direct Write)
- [ ] Create `POST /gps/broadcast` endpoint:
  - Validates JWT (driver role)
  - Writes to Firebase RTDB (keep using Firebase for real-time, just route through backend)
  - Returns `200 OK`
- [ ] Update driver app to call this endpoint instead of writing to Firebase directly
- [ ] This gives you: auth, logging, and a single point to add logic later

---

### Week 3 — Notifications & Admin

#### Push Notifications
- [ ] Install Firebase Admin messaging in backend
- [ ] Create `POST /notifications/push` (internal endpoint)
  - Takes: FCM token, title, body, data
  - Sends via Firebase Admin SDK
- [ ] In parent app: request notification permission on login
  - Get FCM token: `getToken(messaging, { vapidKey: '...' })`
  - Save FCM token to user record: `PATCH /users/me/fcm-token`
- [ ] Trigger a notification when a trip starts:
  - Driver taps Start Trip
  - Backend receives GPS broadcast
  - On first broadcast of a new trip: send push to all parents on that bus
  - Message: "Bus {regNumber} has departed"
- [ ] Test: driver starts trip → parent phone gets a notification

#### SMS via MSG91 (Once Sender ID Approved)
- [ ] Install MSG91 SDK or use their HTTP API directly
- [ ] Create an SMS helper function: `sendSMS(phone, message)`
- [ ] For the trip started notification: send SMS as backup if push fails (add a 30s delay, then check if notification was opened — if not, send SMS)
- [ ] Test: disable push notifications, confirm SMS arrives

#### Basic Transport Manager View (Web)
- [ ] Create `apps/web-admin/` — simplest possible React app
  - `npx create-vite web-admin --template react-ts`
- [ ] Login page: email + password for transport manager (add password auth to backend)
- [ ] Dashboard: list of buses with their last-known GPS position (from Firebase)
- [ ] Click bus → show it on a Google Map
- [ ] That's it for Phase 1. No alerts, no reports yet.

---

### Week 4 — Polish, Test, First School

#### Fix Everything Broken
- [ ] Go through every screen in the parent app and driver app
- [ ] Fix all crashes (Sentry will be catching these)
- [ ] Fix all slow screens (any screen that takes >2s to load needs investigation)
- [ ] Handle no-internet state gracefully everywhere

#### First School Onboarding
- [ ] Identify your pilot school (reach out to 5, one will say yes)
- [ ] Create the school record in your database
- [ ] Create driver accounts for their drivers (manually via Prisma Studio)
- [ ] Go on-site and help the transport manager set up the admin portal
- [ ] Help drivers install the app and log in
- [ ] Send the school code to parents manually (via WhatsApp, email, whatever works)
- [ ] Watch the first real trip run. **Be present. Watch what breaks.**

#### After First Trip
- [ ] List everything that broke or confused anyone
- [ ] Fix the critical ones (things that would make them stop using the app)
- [ ] Schedule a follow-up call for 1 week later

---

### ✅ Phase 1 Complete When:
- [ ] One school has run at least 5 trips using the app
- [ ] Transport manager can see all buses live
- [ ] Parents receive notifications when bus departs
- [ ] No crashes in 3 consecutive days of real use
- [ ] The school would pay for this (even if you don't charge them yet)

**Stop here. Get feedback. Move to Phase 2 only after the first school calls it useful.**

---

## 🔵 PHASE 2 — First 20 Schools
### Goal: Stable operations, paying customers, scalable infrastructure
### Stack: Add Redis for real-time, move DB to RDS, add ETA, multi-language
### Time: 8–10 weeks (Month 2–4)

---

### Infrastructure Upgrades

#### Move to AWS
- [ ] Provision RDS PostgreSQL on AWS (db.t3.micro to start)
- [ ] Migrate schema from Railway to RDS: `pg_dump` + `pg_restore`
- [ ] Provision ElastiCache Redis (cache.t3.micro)
- [ ] Deploy backend to EC2 (t3.medium) using Docker Compose
- [ ] Set up HTTPS with Let's Encrypt / AWS ACM
- [ ] Configure domain: `api.saferide.in` points to your EC2
- [ ] Set up GitHub Actions CI: runs tests on every push
- [ ] Confirm everything works at: curl `https://api.saferide.in/health`

#### Replace Firebase RTDB with Redis
- [ ] Install ioredis in backend: `pnpm add ioredis`
- [ ] Create `packages/redis/` — Redis client wrapper
- [ ] When driver broadcasts GPS:
  - Instead of writing to Firebase: write to Redis `GEOADD` + `HSET bus:state:{busId}`
  - Publish to Redis pub/sub channel: `PUBLISH route:{routeId}:location {payload}`
- [ ] Create WebSocket server (Socket.io) for parent app real-time updates:
  - Parent connects → joins room `route:{routeId}`
  - Server subscribes to Redis pub/sub for that route
  - On Redis message → emit to room → parent app receives
- [ ] Update parent app to use WebSocket instead of Firebase subscription
- [ ] Decommission Firebase RTDB (you are only using Firebase for Phone Auth now)

---

### Product Features

#### ETA Calculation
- [ ] Create `services/eta.service.ts`
- [ ] Basic ETA: `distanceToStop / averageSpeed`
- [ ] Get stop coordinates from DB, calculate haversine distance from bus position
- [ ] Include in WebSocket payload: `{ busId, lat, lng, etaMinutes }`
- [ ] Parent app shows ETA in the floating card
- [ ] For stop approach notifications: fire when ETA hits 10 minutes, then 5 minutes

#### Multi-Language Notifications (7 Languages)
- [ ] Create `packages/notifications/src/templates.ts`
- [ ] Write templates for key events in all 7 languages:
  - English, Hindi, Kannada, Tamil, Telugu, Marathi, Malayalam
  - Events: trip_started, approaching_10min, approaching_5min, arrived_stop, arrived_school, delayed
- [ ] Store user's preferred language in User record
- [ ] Notification service reads language preference → picks right template
- [ ] Test: set your test user to Hindi, confirm Hindi notification arrives

#### CSV Student Import
- [ ] Create `POST /admin/students/import` endpoint
  - Accepts multipart form with CSV file
  - Parse with `papaparse` library
  - Validate: required fields, phone numbers in E.164 format
  - Upsert students: create if new, update if phone number exists
  - Return: `{ success: 420, errors: [{ row: 3, message: "Invalid phone" }] }`
- [ ] Add import button to admin portal
- [ ] Create downloadable CSV template with correct column headers
- [ ] Test with 500 real-ish student records

#### Basic Webhook System
- [ ] Add `webhook_subscriptions` table to DB schema (url, events[], secret, tenantId)
- [ ] Create webhook endpoints in admin portal (just a simple form for now)
- [ ] When trip starts: find all webhook subscriptions for `trip.started` for this school
- [ ] POST to each URL with HMAC-SHA256 signature
- [ ] Log delivery attempt (status code, timestamp)
- [ ] This is the seed for your integration platform — do it now even if no one uses it yet

---

### Operations & Growth

#### Monitoring
- [ ] Set up Datadog or Grafana Cloud (free tier)
- [ ] Track: GPS message rate, WebSocket connection count, API response times
- [ ] Set up alerts: if GPS messages drop to 0 during school hours → alert via email/Slack
- [ ] Review Sentry errors every morning (this becomes a habit)

#### Self-Service Onboarding
- [ ] Build school registration page: `saferide.in/register`
  - School name, UDISE code, city, contact email, number of buses
  - Creates tenant record, sends welcome email
  - 30-day free trial, no credit card
- [ ] Build onboarding email sequence (3 emails):
  - Day 0: Welcome + getting started guide
  - Day 3: "Have you added your first bus?"
  - Day 7: "Here's how to invite parents"
- [ ] First 20 schools can come in through this without you doing manual setup

#### Sales Outreach
- [ ] Identify 50 schools in your launch city from IndiaSchools / JustDial / Google Maps
- [ ] Create a simple outreach WhatsApp message (2 sentences max)
- [ ] Target: transport managers directly (not principals — they move faster)
- [ ] Goal for Phase 2: 20 schools onboarded, 10 paying

---

### ✅ Phase 2 Complete When:
- [ ] 20 schools using the app, at least 10 paying
- [ ] Self-service onboarding working (school registers without your help)
- [ ] MRR: ₹1–1.5L/month
- [ ] Infrastructure running stably without you babysitting it
- [ ] GPS latency p95 < 5 seconds (measure this)
- [ ] Zero manual work to onboard a new school

---

## 🟣 PHASE 3 — Scale to 200 Schools
### Goal: Full product with video, ERP integration, stable at 200 schools
### Stack: Add Kafka, Kubernetes, mediasoup video, Fedena adapter
### Time: 4–6 months (Month 5–12)

---

### Infrastructure: Kafka + Kubernetes

#### Add Kafka (When Redis pub/sub starts feeling insufficient)
- [ ] Provision Amazon MSK (Kafka) — 2 brokers, t3.small
- [ ] Install kafkajs in backend: `pnpm add kafkajs`
- [ ] Create `packages/kafka/` — typed producer/consumer wrappers
- [ ] Migrate GPS events from Redis pub/sub to Kafka topic: `saferide.gps.location-received`
- [ ] Create separate stream-processor service that consumes from Kafka
- [ ] Stream processor: validate → enrich → update Redis → broadcast to WebSocket clients
- [ ] Confirm GPS pipeline still works end-to-end after migration
- [ ] Add Kafka consumer lag to your monitoring dashboard

#### Move to Kubernetes (EKS)
- [ ] Provision EKS cluster (2 nodes, t3.xlarge to start)
- [ ] Containerise all services (each gets a `Dockerfile`)
- [ ] Write Kubernetes manifests (or Helm charts) for each service
- [ ] Set up ArgoCD for GitOps deployment: git push → auto-deploys to K8s
- [ ] Configure HPA (auto-scaling) for telemetry-ingestor and livetrack-gateway
- [ ] Move from EC2 Docker Compose to EKS
- [ ] Confirm zero-downtime deploy works

---

### Live Bus Video

#### mediasoup Setup
- [ ] Provision a dedicated EC2 t3.xlarge for mediasoup (separate from app servers)
  - Video is CPU-heavy — it needs isolation from GPS tracking
- [ ] Install mediasoup: `pnpm add mediasoup`
- [ ] Create `apps/video-service/` — new service
- [ ] Implement WebRTC session creation:
  - `POST /video/session` → creates mediasoup room + transport, returns connection params
  - `POST /video/session/close` → cleans up room
- [ ] Add viewer count tracking in Redis: `video:viewers:{busId}` (max 50)

#### Driver App — Camera
- [ ] Install expo-camera: `npx expo install expo-camera`
- [ ] Request camera permissions when video feature is enabled for the school
- [ ] Start camera stream when trip starts (runs alongside GPS broadcast)
- [ ] Connect to mediasoup SFU as a producer:
  - Fetch session from `GET /api/v1/buses/:busId/video/session`
  - Establish WebRTC connection
  - Start producing video stream
- [ ] Handle adaptive bitrate: reduce quality if network degrades

#### Parent App — Video View
- [ ] Add "Watch Live" button on home screen (only shown when trip is active + feature enabled)
- [ ] Tapping opens video screen
- [ ] Connect to mediasoup as a consumer
- [ ] Render `RTCView` with the remote stream
- [ ] Quality indicator + viewer count shown
- [ ] Handle "Poor connection" state gracefully — show last frame, not blank

#### Recording Pipeline
- [ ] Add GStreamer / FFmpeg to video-service Docker image
- [ ] When trip starts: create recording pipeline (mediasoup → FFmpeg → HLS)
- [ ] Upload HLS segments to S3 every 10 seconds
- [ ] When trip ends: finalise playlist.m3u8
- [ ] Store recording path in `video_sessions` DB table
- [ ] Transport manager can request playback URL: `GET /trips/:tripId/video`
  - Returns signed CloudFront URL (1-hour expiry)
- [ ] Set S3 lifecycle policy: delete recordings after 30 days

#### SOS Video Clip
- [ ] When SOS triggered: extract last 60 seconds of recording buffer
- [ ] Upload to S3 with `is_sos=true` tag → lifecycle: NEVER delete
- [ ] Require dual-auth to access (see security section)

---

### ERP Integration — Fedena

#### Fedena Adapter
- [ ] Create `integrations/adapters/fedena/` folder
- [ ] Install axios: `pnpm add axios`
- [ ] `fedena.client.ts` — HTTP client with the school's Fedena URL + API key
- [ ] `fedena.mapper.ts` — map Fedena student fields to SafeRide canonical format
  - Most important: normalise phone numbers to E.164 (`9876543210` → `+919876543210`)
  - Map grade: `class=5, section=A` → `"5A"`
  - Store Fedena ID in `externalIds: { fedena: "12345" }`
- [ ] `fedena.sync.ts` — scheduled sync (runs nightly at 11 PM per tenant):
  - Fetch all students from Fedena (paginated)
  - Upsert into SafeRide (idempotent, keyed by Fedena ID)
  - Write sync result to `sync_logs` table
- [ ] Add Kubernetes CronJob: runs nightly sync for each school with Fedena enabled

#### Integration UI in Admin Portal
- [ ] Add "Integrations" page to admin portal
- [ ] Fedena setup card:
  - Enter Fedena URL + API key
  - "Test connection" button → calls Fedena, shows success/fail
  - "Sync now" button → triggers immediate sync
  - Shows last sync time + records processed
- [ ] Webhook management page:
  - List existing webhooks
  - Add new webhook form (URL, events, auto-generate secret)
  - Show delivery log (last 100 attempts with status codes)

---

### Polishing the Core Product

#### Speed & Reliability
- [ ] Load test the GPS pipeline: simulate 2,000 buses broadcasting simultaneously
  - Tool: write a script that POSTs GPS broadcasts from 2,000 virtual buses
  - Target: p95 latency <5 seconds throughout the test
  - Fix whatever bottleneck shows up
- [ ] Load test WebSocket: simulate 40,000 parent connections
- [ ] Confirm ETA is accurate within ±2 minutes for 80% of trips (measure against real trip data)

#### Parent App Polish
- [ ] Add smooth bus marker animation (4,500ms linear interpolation between GPS points)
- [ ] Add trip history screen (last 7 days of trips, with route playback)
- [ ] Add "Share bus location" — generates a one-time link for family members
- [ ] Add notification preferences screen (enable/disable specific notification types)
- [ ] Fix any remaining language issues in all 7 languages
- [ ] Submit to Google Play Store and Apple App Store

#### App Store Setup
- [ ] Create Google Play Developer account ($25 one-time fee)
- [ ] Create Apple Developer account ($99/year)
- [ ] Generate app screenshots for both stores (use your best-looking school as the demo)
- [ ] Write store listing in English (and Hindi for Play Store)
- [ ] First submission: expect 1–3 days for Google Play, up to 7 days for Apple
- [ ] Get at least 10 reviews on both stores before approaching enterprise schools

---

### ✅ Phase 3 Complete When:
- [ ] 200 schools using the app
- [ ] Live video working in production for at least 50 schools
- [ ] Fedena integration working for at least 10 schools (earns enterprise retention)
- [ ] App store rating ≥ 4.3★ on both platforms
- [ ] MRR ≥ ₹16L/month
- [ ] You can onboard a new school without any manual work from your team
- [ ] GPS pipeline stable at 2,000 concurrent buses without degradation

---

## ⭐ PHASE 4 — Full Polished Product
### Goal: Complete platform with all modules, integrations, and partner API
### Stack: Add RFID phase, Ola/Rapido, OAuth platform, AI ETA
### Time: Month 12 onwards

> By this point you have a real company with a real engineering team.
> This phase is directional — execution depends on your team and market feedback.

---

### RFID Tap System (Phase 2 Product Feature)

- [ ] Source RFID/NFC readers for bus doors (negotiate bulk pricing)
- [ ] Work with hardware vendor to connect reader to WiFi/GSM and POST to your API
- [ ] Create `POST /tap/events` endpoint
  - Validates reader auth, student card ID
  - Looks up student by RFID card ID
  - Fires `student.boarded` or `student.alighted` event → Kafka → webhook → parent notification
- [ ] Parent notification: "Arjun boarded Bus 7 at 07:43 AM at Stop 4"
- [ ] Write back attendance to Fedena (via adapter)
- [ ] This is the biggest product upgrade after video — it makes parents trust the system completely

### School Gate Entry (Phase 3 Product Feature)

- [ ] NFC reader at school gate (same hardware type as bus reader)
- [ ] `student.entered_school` event
- [ ] Final notification in the safety chain: "Arjun entered [School Name] at 08:12 AM"
- [ ] Schools love this — reduces liability questions to zero

### Ola / Rapido Integration

- [ ] Establish formal API partnership with Ola for Business or Rapido School
  - This requires business meetings, not just API docs
  - Start the conversation at Month 8 so it's ready by Month 12
- [ ] Build `integrations/adapters/ola/` — GPS normaliser + dispatch adapter
- [ ] Build `integrations/adapters/rapido/` — same pattern
- [ ] Build Dispatch Engine: when `trip.cancelled` fires → auto-dispatch ride-hailing vehicles
- [ ] Parent notification: "Bus 7 cancelled. An Ola SUV is picking up your child."
- [ ] Virtual Bus abstraction: ride-hailing vehicle appears on parent map exactly like a school bus

### OAuth Developer Platform

- [ ] Build OAuth 2.0 Authorization Server
  - Authorization Code flow (for school portals wanting to embed tracking)
  - Client Credentials flow (for ERP server-to-server sync)
- [ ] Build partner API: `/partner/v1/` endpoints
- [ ] Build developer portal: `developer.saferide.in`
  - API documentation (auto-generated from OpenAPI spec)
  - Sandbox environment with simulated buses
  - OAuth app management
- [ ] Launch: announce at major school ERP conferences (Fedena, Entab user communities)

### Liability Dashboard

- [ ] Build chain-of-custody timeline: for each student, each day:
  - Boarded bus ✓ at 07:43 · Stop 4
  - Bus arrived school ✓ at 08:15
  - Entered school ✓ at 08:17
- [ ] Incident report generator: select a date range + bus → auto-generate PDF
  - Includes GPS track, video link, boarding events, alert history
- [ ] Exportable in AIS-140 prescribed format for regulatory submission
- [ ] Schools use this to respond to parent complaints in 2 minutes instead of 2 hours

### AI ETA Upgrade

- [ ] Collect 90 days of trip data per route (you have this in TimescaleDB)
- [ ] Train a simple gradient boosting model per route:
  - Features: time of day, day of week, current speed, stop index, historical average
  - Target: actual arrival time at each stop
- [ ] Replace heuristic ETA calculation with model predictions
- [ ] Expected improvement: ETA accuracy within ±1 minute for 85% of trips

### Route Optimisation

- [ ] Use Google Maps Routes API to analyse current routes
- [ ] Identify routes where reordering stops would save >10 minutes of trip time
- [ ] Present to transport manager as suggestions: "Reorder Stop 4 and 7 to save 8 minutes"
- [ ] One-click apply with a confirmation step

---

### ✅ Phase 4 Complete When:
- [ ] RFID tap system deployed in at least 50 schools
- [ ] Ola/Rapido dispatch working end-to-end in at least 10 breakdown scenarios
- [ ] Developer portal live with at least 5 third-party integrations built on it
- [ ] Liability dashboard used in at least one real legal/insurance context
- [ ] MRR ≥ ₹54L/month (600 schools)
- [ ] Your product essentially runs itself — team focuses on growth, not maintenance
- [ ] App store rating ≥ 4.5★ on both platforms

---

## 🔧 ONGOING — Things You Do Every Phase

These are not phase-specific. You do them starting from Phase 1 and never stop.

### Every Week
- [ ] Read Sentry errors every Monday morning
- [ ] Check GPS pipeline latency is within target
- [ ] Talk to at least one school user (call, not message)
- [ ] Check if any webhook deliveries are failing for schools

### Every Month
- [ ] Review MRR growth. If flat for 2 months, talk to churned schools.
- [ ] Ship at least one improvement based on user feedback
- [ ] Check infrastructure costs vs revenue (gross margin should improve each month)
- [ ] Update `.env.example` if any new environment variables were added

### Every Quarter
- [ ] Security review: rotate JWT secrets, check for exposed credentials in git history
- [ ] Dependency update: run `pnpm audit`, update packages with security issues
- [ ] Load test: simulate 2x your current peak load. Fix anything that breaks.
- [ ] Backup verification: test that you can restore the database from backup

### Before Every Major Release
- [ ] Test on a real low-end Android phone (Redmi 9 or equivalent)
- [ ] Test on slow 3G connection (enable in Android Developer Options)
- [ ] Test all 7 languages by changing your device language
- [ ] Test with location permissions denied
- [ ] Test with notifications permissions denied

---

## 📦 ACCOUNTS & SERVICES CHECKLIST

Things to set up before you need them:

### Set Up Immediately (Day 1)
- [ ] GitHub (private repo)
- [ ] Firebase (Auth + Realtime Database)
- [ ] Expo (builds and OTA updates)
- [ ] Google Cloud (Maps API keys)
- [ ] **MSG91 (SMS) — Sender ID takes 3–7 business days to approve. Do this today.**

### Set Up in Week 2
- [ ] Sentry (error tracking — free tier)
- [ ] Railway (managed PostgreSQL for Phase 0–1)

### Set Up at Phase 2 Start
- [ ] AWS account (moving to RDS, ElastiCache, EC2)
- [ ] Datadog or Grafana Cloud (monitoring)
- [ ] Google Play Developer account ($25)
- [ ] Apple Developer account ($99/year)
- [ ] CloudFront distribution (for video CDN when video is ready)

### Set Up at Phase 3 Start
- [ ] Amazon MSK (Kafka)
- [ ] Amazon EKS (Kubernetes)
- [ ] Dedicated EC2 for mediasoup (video)

### Negotiate Starting Phase 3 (Takes Time — Start Early)
- [ ] Ola for Business API access (request via their business portal)
- [ ] Rapido School partnership (contact their B2B team)
- [ ] Fedena marketplace listing (for inbound integration leads)

---

## 🚨 ANTI-PATTERNS — Things That Will Kill Progress

- ❌ **Do not add authentication before the dot moves.** Auth is not Phase 0.
- ❌ **Do not think about Kafka before you have 50 schools.** You don't have a Kafka problem yet.
- ❌ **Do not design the database schema for 3 hours.** Start simple, migrate as you learn.
- ❌ **Do not show a blank screen when GPS is unavailable.** Always show last-known with a timestamp.
- ❌ **Do not use red as a standard colour.** See the design system.
- ❌ **Do not hardcode phone numbers without E.164 format.** You'll regret this at Phase 3.
- ❌ **Do not build the video feature before 50 schools are using GPS tracking.** Video is Phase 3.
- ❌ **Do not skip talking to users every week.** The product will drift from what they need.
- ❌ **Do not add a feature because it sounds cool.** Add it because 3+ schools asked for it.
- ❌ **Do not let a blocker stop you for more than 2 days.** Skip it, come back, or ask for help.

---

## 💡 THE ONLY THING THAT MATTERS

Every phase, every week, ask yourself:

> **"Can a parent open the app right now and see where their child's bus is?"**

If yes: you are on track.  
If no: drop everything and fix that first.

Everything else — video, RFID, Ola integration, OAuth, AI ETA — is additive. The dot on the map is the product.

---

*Last updated: March 2026*  
*Build in order. Check as you go. Ask for help when stuck.*
