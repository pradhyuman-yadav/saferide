# SafeRide — Product Requirements Document
> Version 2.0 · March 2026 · **CONFIDENTIAL**
> Phase 1: Bus Tracking + Video · Integration-Ready Foundation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Market Context](#3-market-context)
4. [Vision & Product Goals](#4-vision--product-goals)
5. [Target Users & Personas](#5-target-users--personas)
6. [Scope — Phase 1](#6-scope--phase-1)
7. [Feature Specifications](#7-feature-specifications)
8. [Live Bus Video — Feature Spec](#8-live-bus-video--feature-spec)
9. [Integration Platform — Feature Spec](#9-integration-platform--feature-spec)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [User Stories](#11-user-stories)
12. [Business Model & Pricing](#12-business-model--pricing)
13. [Go-To-Market Strategy](#13-go-to-market-strategy)
14. [Modular Roadmap](#14-modular-roadmap)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Appendix](#16-appendix)

---

## 1. Executive Summary

SafeRide is a SaaS platform for school bus tracking, live video, and child safety in India. Schools onboard as organisations, manage their fleet, and give parents real-time visibility into their child's journey. Built mobile-first, integration-ready from Day 1, and designed with a phone-first GPS approach that eliminates dependency on unreliable AIS-140 hardware.

**Why now.** The Indian government mandates AIS-140 GPS on every school bus. In practice, most devices are installed to pass RTO inspection and never maintained. Schools have the legal requirement but no working solution. SafeRide solves the actual problem — not the compliance checkbox.

**Why SafeRide wins.** The current "market leaders" are sub-10-person teams with under ₹1 crore in annual revenue. No dominant platform exists. SafeRide enters with a consumer-grade UX, a driver-phone-first GPS architecture that works without hardware, live video as a differentiator, and an integration-ready API platform that allows schools, ERPs (Fedena, Entab), and eventually ride-hailing partners (Ola, Rapido) to plug in.

### Key Metrics at a Glance

| Metric | Month 3 | Month 12 | Month 24 |
|---|---|---|---|
| Schools onboarded | 20 | 200 | 600 |
| Active parent users | 5,000 | 80,000 | 240,000 |
| Buses tracked | 200 | 2,000 | 6,000 |
| MRR | ₹1.2L | ₹16L | ₹54L |
| Platform uptime | 99.5% | 99.9% | 99.9% |

---

## 2. Problem Statement

### 2.1 The Parent Problem

Every school day, millions of Indian parents send their children on school buses with zero visibility. The bus might be late, delayed by traffic, or on a different route entirely. The only recourse is calling the driver — who is driving.

The anxiety is real. After a high-profile incident in Mumbai where a school bus went missing for several hours, parent sensitivity around this problem intensified permanently. Parents want one thing: to know their child is safe.

### 2.2 The School Problem

Schools operate fleets of 10–200+ buses reactively. Transport managers handle 50+ parent calls per day. Route deviations, driver misconduct, and fuel wastage are invisible. When an incident occurs, there is no documented chain of evidence. Schools bear liability with no audit trail.

### 2.3 The AIS-140 Reality

The government mandate exists. The hardware is installed. But:

- SIM cards in AIS-140 devices lapse quietly after the RTO inspection
- Cheap non-certified devices are labeled as compliant
- No one owns the software dashboard — schools buy hardware, never activate software
- State government control room systems rarely consume the data

**The insight:** AIS-140 hardware is a compliance artifact. The driver's phone is the actual GPS. This is the same model Uber, Ola, and Rapido have proven at hundreds of millions of trips.

### 2.4 The Market Gap

| Pain Point | Current State | SafeRide Solution |
|---|---|---|
| Parent real-time visibility | No app or basic SMS with 5-min lag | Live map, <5s updates, push alerts |
| Video evidence | None | Live streaming + 30-day recording |
| GPS reliability | Hardware fails silently | Driver phone as primary GPS |
| Board/deboard confirmation | Manual, phone calls | Phase 2: RFID tap → parent alert |
| ERP integration | None — manual spreadsheets | Webhook + adapter for Fedena/Entab |
| Ride-hailing fallback | None — bus breaks down, kids stranded | Ola/Rapido dispatch integration |
| School liability | No documentation | Audit trail + incident reports |

---

## 3. Market Context

### 3.1 Market Size

- Global school bus tracking market: **USD 1.46 billion (2024)**, growing at 10.2% CAGR to USD 3.51 billion by 2033
- Asia Pacific (fastest-growing region): **16.2% CAGR** through 2033
- India: **248 million students in 1.47 million schools** — largest untapped addressable market
- School Transport App segment specifically: **18.1% CAGR** through 2033

### 3.2 Competitive Landscape

| Competitor | Revenue | Team | Geographic reach | Gap |
|---|---|---|---|---|
| NeoTrack | Undisclosed | Small, Qatar-based | India (partial) | No school-gate tracking, no video |
| Chakraview | ₹94.7L/year | 1–10 people | Mumbai + Pune only | Tiny revenue, no national play |
| VersionX | Hardware-centric | Unknown | Pan-India (hardware) | Software afterthought |
| Trackster | Hardware-centric | Unknown | Limited | No consumer-grade UX |

**Conclusion:** No funded, well-designed, consumer-first platform owns this market. The category has not had its "Zomato moment" yet.

---

## 4. Vision & Product Goals

### 4.1 Vision Statement

> *"Every parent knows their child is safe — from the moment they board the bus to the moment they walk into class."*

### 4.2 Product Principles

**Phone-first, hardware-optional.** The driver's phone is the GPS source. AIS-140 hardware enriches data when available — it is never a dependency.

**Consumer-grade, not enterprise-grade.** Parents are the end users. If a first-time smartphone user in a Tier 2 city cannot figure out the app in 3 minutes, the app is wrong.

**Platform-first, not product-first.** Every feature is a module. Every event is published. Every entity is API-accessible. SafeRide is built so that school ERPs, ride-hailing services, and parent apps built by third parties can all connect.

**Calm and premium.** The brand — Jade Pebble Morning, SafeRide — communicates safety through stillness, not alarm. No flashing red, no aggressive notifications. Parents trust calm.

### 4.3 Phase 1 Goals

- Launch multi-tenant SaaS for school onboarding
- Real-time bus location via mobile app (Android + iOS)
- Live bus video stream for parents (720p, <3s latency)
- Fleet admin dashboard for transport managers
- AIS-140 compliance via software (phone GPS → state control room)
- Webhook system for school ERP integration
- Support 50,000 concurrent parent sessions at launch

### 4.4 Success Metrics

| Metric | Target (Month 3) | Target (Month 12) |
|---|---|---|
| Schools onboarded | 20 | 200 |
| Parent app store rating | ≥ 4.3★ | ≥ 4.5★ |
| Location update latency | <5 seconds | <3 seconds |
| Video stream latency | <3 seconds | <2 seconds |
| Platform uptime | 99.5% | 99.9% |
| Parent app weekly active rate | >70% | >75% |
| School churn rate | <5%/year | <3%/year |
| NPS (schools) | >50 | >65 |

---

## 5. Target Users & Personas

### Persona 1 — The Anxious Parent (Priya, 34)

Working mother, software professional, Bangalore. 8-year-old in Class 3 on a school bus daily. Comfortable with apps. Calls the driver 2–3x per week. Cannot focus at work until child confirms arrival.

**Goal:** Know the bus location in real-time without calling anyone.  
**Success:** *"I can see the bus is 10 minutes away and my child is on it — and if I want, I can watch the live camera."*

### Persona 2 — The Transport Manager (Ramesh, 42)

Transport in-charge at a 1,200-student CBSE school in Hyderabad. Manages 18 buses. No visibility on which bus is where. Handles 50+ parent calls per day.

**Goal:** See all buses on one screen, send bulk notifications, pull trip reports for compliance.  
**Success:** *"Zero parent calls about bus location today."*

### Persona 3 — The Principal / Decision Maker (Sunita, 50)

Principal of a 2,000-student private school in Pune. Concerned about liability, compliance, and parent satisfaction.

**Goal:** Documented proof of every trip. Legal protection. Competitive differentiation.  
**Success:** *"When a parent escalated about their child's bus, I pulled up the complete route, speed, and video in 2 minutes. Case closed."*

### Persona 4 — The Bus Driver (Raju, 38)

6-year driver at the same school in Noida. Low-end Android phone. Gets parent calls constantly while driving. Worried about being tracked and penalised.

**Goal:** Simple tool that doesn't distract while driving.  
**Success:** *"The app starts when I tap Start Trip. I don't touch it again until the end. Parents stopped calling me."*

### Persona 5 — The School IT Admin / ERP Manager (Vivek, 35)

IT manager at a large CBSE chain in Delhi. Manages Fedena ERP for 5 campuses. Wants student data in sync without manual work.

**Goal:** Student roster in SafeRide mirrors Fedena automatically. Attendance written back.  
**Success:** *"I set it up once. It syncs every night. I haven't touched it in 3 months."*

---

## 6. Scope — Phase 1

### 6.1 In Scope

- Multi-tenant school onboarding (self-serve, 30-day free trial)
- Driver app — phone GPS broadcast, trip start/end, SOS button
- Parent app — live map, ETA alerts, push notifications, 7 languages
- Live bus video — parent can watch the bus camera in real-time
- Video recording — 30-day rolling storage, incident playback
- Fleet dashboard — transport manager web portal
- AIS-140 compliance software layer
- Webhook system — schools can subscribe to trip/safety events
- Generic CSV import for student rosters
- Basic Fedena ERP adapter (roster sync + attendance writeback)

### 6.2 Out of Scope — Phase 1 (Designed In, Built Later)

| Feature | Phase | Reason deferred |
|---|---|---|
| RFID/NFC tap-in/tap-out on bus | Phase 2 | Requires hardware procurement per bus |
| School gate attendance | Phase 3 | Requires gate hardware at school |
| Liability dashboard | Phase 4 | Needs Phase 2+3 data first |
| Ola/Rapido dispatch integration | Phase 3 | Requires partnership agreement |
| OAuth 2.0 developer platform | Phase 3 | Needs more integration demand first |
| Fee management | Phase 5 | Different product area |
| AI route optimisation | Phase 5 | Data volume needed first |

### 6.3 The Modular Expansion Roadmap

```
Phase 1 (Month 0–6):    GPS tracking + video + webhooks + CSV import
Phase 2 (Month 6–12):   RFID tap system (board/alight confirmation)
Phase 3 (Month 12–18):  School gate entry + Ola/Rapido integration
Phase 4 (Month 18–24):  Liability dashboard + OAuth developer API
Phase 5 (Month 24+):    Route optimisation AI + fee management + marketplace
```

Each phase is a Kafka consumer and a REST API module. Activating a phase for a school = enabling a feature flag. Deactivating = disabling the flag. Core GPS pipeline never changes.

---

## 7. Feature Specifications

### 7.1 Organisation Onboarding

**Description:** Schools register as isolated tenants. Each tenant has its own data partition, user namespace, and feature configuration.

**Functional Requirements:**
1. School admin registers with school name, UDISE code, city, and contact email
2. System creates tenant namespace, provisions DB partition, sends welcome email
3. Admin completes profile: buses, student count, address, principal contact
4. Admin invites transport manager via role-assignment link
5. Each tenant gets unique subdomain: `dps-bangalore.saferide.in`
6. 30-day free trial, full features, no credit card required
7. Admin can bulk-import buses and routes via CSV

**Acceptance Criteria:**
- Onboarding completes in <5 minutes
- Tenant data is fully isolated (RLS enforced at DB layer)
- Welcome email arrives within 60 seconds

---

### 7.2 Driver App (GPS Source)

**Description:** The driver app is SafeRide's primary GPS source. It broadcasts phone GPS in the background throughout the trip.

**Functional Requirements:**
1. Driver logs in once with school-issued driver code. Login persists.
2. Trip start: driver taps "Start Trip" — background GPS task begins, parents notified
3. Background GPS broadcasts every 5 seconds even when screen is locked
4. Offline buffer: SQLite queue stores up to 500 GPS points offline, syncs on reconnect
5. End trip: driver taps "End Trip" — GPS stops, trip written to DB
6. One-tap SOS: visible at all times, fires emergency alert within 5 seconds
7. Low-battery mode: GPS interval extends to 15s below 20% battery
8. Foreground service notification: shows "SafeRide Active — sharing location"
9. Route progress display: current stop index, next stop name, pax count

**Acceptance Criteria:**
- GPS broadcast survives phone screen lock and OS background kill
- Offline queue flushes in correct timestamp order on reconnect
- SOS notification reaches transport manager within 10 seconds

---

### 7.3 Parent App

**Description:** The consumer-facing mobile app. The primary product. Everything else is infrastructure for this.

**Core Screens:**
- **Home** — Live map with bus marker, ETA countdown, driver name
- **Route View** — Full route with all stops, progress indicator
- **Video** — Live camera feed from bus (feature-flagged per plan)
- **Notifications** — Timeline of all trip events
- **Profile** — Child details, notification preferences, language

**Functional Requirements:**
1. Parent registers with mobile OTP. No email or password required.
2. Links child to school using 6-digit school code
3. System auto-assigns child's route and stop
4. Live map refreshes bus position every 5 seconds (WebSocket)
5. ETA shown for parent's specific pickup stop, not the school
6. Push notifications: departed, 10 min away, 5 min away, arrived at stop, arrived at school
7. App shows last-known position with timestamp when offline (never blank screen)
8. Trip history: last 30 days of routes with playback
9. SMS fallback: fires if FCM push undelivered after 30 seconds
10. Supports 7 languages at launch: English, Hindi, Kannada, Tamil, Telugu, Marathi, Malayalam
11. Parent can share bus location temporarily with another family member (one-time link)

**Acceptance Criteria:**
- New parent: registered and sees live bus in <3 minutes
- Works on Android 7.0+ and iOS 13+
- App loads live map in <2 seconds on 4G
- Graceful 2G mode: shows last-known position, reduced update frequency

---

### 7.4 Fleet Dashboard (Transport Manager — Web)

**Description:** Web portal for transport managers. Desktop-first, tablet-responsive.

**Core Views:**
- **Live Map** — All buses in real-time, colour-coded by status
- **Bus List** — Tabular view with bus, driver, speed, last update, active alerts
- **Alerts Feed** — Real-time stream: speed violations, deviations, SOS, offline devices
- **Trip Reports** — Per-bus history with GPS playback and export
- **Broadcast** — Send text notification to all parents on a route
- **Video Monitor** — Watch any active bus camera feed (feature-flagged)

**Functional Requirements:**
1. All buses visible on single map, auto-refresh every 5 seconds
2. Click bus → speed, last stop, ETA to school, driver name and phone
3. Route deviation alert: bus >500m from planned corridor
4. Speed alert: configurable threshold (default 60 km/h)
5. Manager broadcasts delay notification: delivered to all route parents within 30s
6. Trip export: CSV and PDF with all AIS-140 required fields
7. Role-based access: transport manager sees fleet; principal sees read-only

---

### 7.5 Notifications Engine

| Event | Recipients | Channel | Trigger |
|---|---|---|---|
| Bus Departed | All route parents | Push + optional SMS | Trip started |
| Approaching Stop (10 min) | Parents at that stop | Push | ETA threshold crossed |
| Approaching Stop (5 min) | Parents at that stop | Push | ETA threshold crossed |
| Bus Arrived at Stop | Parents at that stop | Push | Bus within 100m of stop coords |
| Bus Arrived at School | All route parents | Push | Bus within 200m of school |
| Bus Delayed >15 min | All route parents | Push + SMS | Schedule deviation |
| Speed Violation | Transport manager | Push + in-app | Speed >60 km/h |
| Route Deviation | Transport manager | Push + in-app | >500m off route |
| SOS Triggered | Manager + Principal | Push + SMS | Panic button |
| Device Offline | Transport manager | In-app | No ping >5 min during trip |
| Student Boarded (Phase 2) | Parent of that child | Push | RFID tap event |

---

## 8. Live Bus Video — Feature Spec

### 8.1 Overview

Live bus video is a premium differentiator. No current Indian competitor offers it as an integrated, parent-facing feature. It serves two use cases:

- **Live view (parent):** Watch the interior of the bus in real-time while trip is active
- **Incident playback (school):** Review recordings after an incident, SOS, or complaint

### 8.2 Video Source Options

| Phase | Source | Cost | Quality |
|---|---|---|---|
| Phase 1 | Driver's rear-facing phone camera | ₹0 | 720p, adequate |
| Phase 3 | Dedicated dashcam (Hikvision/Viofo) | ₹3,000–8,000 per bus | 1080p, better angles |

Phase 1 uses the driver's phone camera. This is the same phone broadcasting GPS. Zero additional hardware. The camera streams while the GPS task runs.

### 8.3 Functional Requirements

**Live View:**
1. Parent taps "Watch Live" on bus detail screen
2. Server verifies: trip active, child is on this bus, video feature enabled for tenant
3. WebRTC session created; video appears within 3 seconds
4. Adaptive quality: 720p on WiFi/4G, 480p on weaker connection, disabled on 3G
5. Parent sees interior of bus — can confirm child is present
6. Maximum 50 concurrent viewers per bus (prevents bandwidth abuse)
7. Parent disconnects → session closes, viewer count decremented

**Recording:**
1. Recording begins automatically when trip starts (configurable per school)
2. Continuous HLS recording: 10-second segments → S3 storage
3. 30-day rolling retention (DPDP 2023 compliant)
4. Transport manager can access recording via signed URL (1-hour expiry)
5. Parents cannot access recordings (other children visible — privacy)

**SOS Clips:**
1. SOS event → last 60 seconds of buffer saved as permanent clip
2. Dual-authorisation required to access: principal + SafeRide ops
3. Never auto-deleted, stored indefinitely

**Privacy & Legal:**
1. Parent consents to video recording at onboarding
2. School notifies students/parents per DPDP 2023 requirements
3. All video stored in AWS ap-south-1 (Mumbai) — never leaves India
4. Recordings accessible only to transport manager and principal of that school

### 8.4 Acceptance Criteria

- Live view appears within 3 seconds of tapping on 4G
- Video gracefully degrades to "Poor connection" message on 3G rather than buffering forever
- Recording available for playback within 5 minutes of trip ending
- SOS clip is captured even if live stream was not active

---

## 9. Integration Platform — Feature Spec

### 9.1 Why Integration Matters (Product Perspective)

SafeRide's stickiness grows when it connects to systems schools already use. A school that has SafeRide syncing with their Fedena ERP has switching costs 10x higher than a school using SafeRide standalone. Integrations are retention, not features.

### 9.2 Webhook System

Schools and partner systems can subscribe to SafeRide events via HTTP webhooks.

**Functional Requirements:**
1. School admin can register up to 10 webhook endpoints from the admin portal
2. Each webhook specifies: URL, event types to subscribe to, secret for HMAC signing
3. SafeRide delivers events within 5 seconds of occurrence
4. Retry policy: 5 attempts with exponential backoff (1s, 5s, 30s, 5m, 30m)
5. Admin can view delivery log: last 100 attempts per webhook with status codes
6. Admin can send a test event to verify endpoint is working
7. Dead-lettered webhooks (all 5 retries failed) trigger email alert to school admin

**Webhook Events Available:**
- `trip.started`, `trip.ended`, `trip.delayed`, `trip.cancelled`
- `bus.speed_exceeded`, `bus.route_deviated`, `bus.offline`
- `sos.triggered`, `sos.resolved`
- `student.boarded`, `student.alighted` (Phase 2)
- `student.entered_school` (Phase 3)

### 9.3 ERP Adapter — Fedena

Priority integration because Fedena is the most widely used school ERP in India.

**Functional Requirements:**
1. School admin enters Fedena URL and API key in integration settings
2. Initial sync: import all students from Fedena into SafeRide (with progress indicator)
3. Nightly scheduled sync: detect new, changed, and removed students
4. Writeback: when student boards bus (Phase 2 RFID), mark present in Fedena attendance
5. Conflict resolution: Fedena is source of truth for student identity; SafeRide for transport data
6. Sync log: admin can see last sync time, records processed, errors

**Acceptance Criteria:**
- Initial sync of 2,000 students completes in <3 minutes
- Delta sync detects name change within 24 hours
- Attendance writeback occurs within 60 seconds of boarding event

### 9.4 Generic CSV Import

For schools without a supported ERP.

**Functional Requirements:**
1. Admin downloads CSV templates for: students, routes, stops
2. Admin fills template in Excel, uploads to SafeRide
3. Server validates: required fields, phone number format, stop coordinates
4. Shows preview: 200 records at a time with row-level error highlighting
5. Admin confirms import, progress bar shows completion
6. Admin can re-upload to update existing records (idempotent by phone number)

---

## 10. Non-Functional Requirements

### 10.1 Performance

| Requirement | Target |
|---|---|
| GPS update latency (phone → parent app) | <5 seconds end-to-end |
| Video stream start latency | <3 seconds |
| API response time p95 | <300ms |
| App cold start (mid-range Android) | <2 seconds |
| Concurrent parent sessions | 50,000 (launch) → 500,000 (Year 1) |
| Push notification delivery | <10 seconds |

### 10.2 Availability

- 99.9% uptime SLA for GPS tracking and parent app (8.7 hours/year downtime)
- 99.5% uptime for admin dashboard
- Zero data loss for GPS telemetry (persist before ACK)
- Graceful degradation: last-known position shown if real-time pipeline fails
- Regional failover: primary Mumbai (AWS ap-south-1), failover Hyderabad

### 10.3 Security

- TLS 1.3 for all data in transit, AES-256 at rest
- Parent sees only buses linked to their child
- MQTT device auth: IMEI + rotating HMAC tokens
- DPDP 2023 compliant: children's location as sensitive personal data
- No selling or sharing of location data
- JWT sessions: 24-hour expiry, revocable
- Webhook payloads signed with HMAC-SHA256

### 10.4 Compliance

- AIS-140: Accept and process ARAI-compliant GPS data format
- AIS-140: Forward emergency events to State Control Room IP
- DPDP 2023: Consent collection, right to erasure, data minimisation
- CERT-In: Security incident reporting within 6 hours

### 10.5 Internationalisation

- 7 languages at launch (English, Hindi, Kannada, Tamil, Telugu, Marathi, Malayalam)
- Language auto-detected from device; manually overridable
- All push notifications and SMS in parent's preferred language
- Admin portal: English only at launch

---

## 11. User Stories

### Parent Stories

| ID | Story | Priority | Acceptance |
|---|---|---|---|
| P-01 | As a parent, I want to see my child's bus on a live map so I know when to go to the stop | P0 | Bus position updates <5s, renders correctly |
| P-02 | As a parent, I want push notification 10 minutes before bus reaches my stop | P0 | Notification within ±2 min of actual arrival |
| P-03 | As a parent, I want to watch the live camera feed from the bus | P1 | Video appears within 3 seconds, works on 4G |
| P-04 | As a parent, I want SMS alerts when I have no data | P1 | SMS within 30s if push undelivered |
| P-05 | As a parent, I want the app in my language | P1 | Auto-detected, manually changeable |
| P-06 | As a parent, I want to see the past week's trip history | P2 | 7 days visible with route playback |

### Transport Manager Stories

| ID | Story | Priority | Acceptance |
|---|---|---|---|
| TM-01 | As a transport manager, I want all buses on one map in real-time | P0 | All active buses visible, 5s refresh |
| TM-02 | As a transport manager, I want instant alerts for speeding or deviation | P0 | Alert within 10s of event |
| TM-03 | As a transport manager, I want to send a delay notification to all route parents | P1 | Broadcast delivered within 30s |
| TM-04 | As a transport manager, I want to watch any bus camera live | P1 | Video accessible from fleet dashboard |
| TM-05 | As a transport manager, I want incident video playback after an SOS | P1 | Recording accessible within 5 min of trip end |
| TM-06 | As a transport manager, I want to export trip reports for compliance | P1 | CSV/PDF export with AIS-140 fields |

### Driver Stories

| ID | Story | Priority | Acceptance |
|---|---|---|---|
| D-01 | As a driver, I want GPS to work automatically in the background | P0 | Broadcasts survive screen lock |
| D-02 | As a driver, I want one-tap SOS | P0 | Manager notified within 10s |
| D-03 | As a driver, I want the app to work in poor connectivity | P0 | Offline queue, syncs on reconnect |

### Integration Stories

| ID | Story | Priority | Acceptance |
|---|---|---|---|
| I-01 | As a school IT admin, I want student roster sync from Fedena | P2 | Delta sync daily, manual trigger available |
| I-02 | As a school admin, I want webhook events for our parent portal | P2 | Events delivered within 5s, retry on failure |
| I-03 | As a school admin, I want to import students from CSV | P1 | 500 students imported in <30s with error report |

---

## 12. Business Model & Pricing

### 12.1 Revenue Model

B2B SaaS. Schools are the paying customer. Parents use the app free. Annual billing preferred (2 months free). Monthly available at premium.

### 12.2 Pricing Tiers

| Plan | Target | Price | Key Inclusions |
|---|---|---|---|
| **Starter** | 1–10 buses | ₹2,500/month | GPS tracking, parent app, basic dashboard, email support |
| **Growth** | 11–30 buses | ₹6,000/month | Starter + SMS alerts, trip reports, webhooks, CSV import |
| **School** | 31–80 buses | ₹15,000/month | Growth + live video (5 buses), Fedena integration, priority support |
| **Enterprise** | 80+ buses | Custom | All features, full video fleet, dedicated CSM, SLA guarantee |

**Video add-on** (for Starter/Growth plans wanting video): ₹500/bus/month

### 12.3 Revenue Projections

| Timeline | Schools | Avg MRR/School | Total MRR | ARR |
|---|---|---|---|---|
| Month 3 | 20 | ₹6,000 | ₹1.2L | ₹14.4L |
| Month 6 | 60 | ₹7,000 | ₹4.2L | ₹50.4L |
| Month 12 | 200 | ₹8,000 | ₹16L | ₹1.92Cr |
| Month 24 | 600 | ₹9,000 | ₹54L | ₹6.5Cr |

---

## 13. Go-To-Market Strategy

### 13.1 Launch City — Pune or Bangalore

High concentration of CBSE/ICSE private schools, tech-savvy parents, active school administrator WhatsApp networks, and an established GPS hardware ecosystem for AIS-140 compliance support.

### 13.2 Sales Motion

1. Identify 5 anchor schools — offer 6 months free in exchange for testimonials and referrals
2. Host "School Transport Safety" demo day — invite 30 transport managers
3. 30-day free trial with white-glove onboarding assistance
4. Use school administrator WhatsApp groups — let happy schools recruit peers
5. Partner with GPS hardware vendors (Loconav, Intellicar) for bundled deals

### 13.3 Integration-Led Growth

The integration platform creates a new acquisition channel:

- Fedena and Entab users discover SafeRide through integration marketplace listings
- Schools that see SafeRide in their ERP's partner directory try it
- Once integrated, switching cost increases dramatically → retention moat

### 13.4 Retention

- Monthly "Safety Report" auto-generated and emailed to principal — shareable to parents
- Early access to Phase 2 (RFID tap) for Year 1 schools
- NPS survey at 30/90/180 days — every score below 7 gets a personal call
- Annual contract renewal aligned to academic year (June–May)

---

## 14. Modular Roadmap

### Phase 2 — RFID/NFC Tap Safety Layer (Month 6–12)

NFC reader at bus door. Student ID cards with NFC chip. Tap to board → parent notification. Tap to alight → parent notification. Every boarding and alighting is timestamped, geotagged, and stored.

**Key impact:** Transforms "where is the bus" into "where is my child."

### Phase 3 — Campus Entry + Ride-Hailing Fallback (Month 12–18)

NFC reader at school gate. Student entering school triggers: chain of custody complete — boarded bus ✓, arrived at school ✓, entered school ✓. Parent gets final confirmation.

Simultaneously: Ola/Rapido dispatch integration. Bus cancelled → auto-dispatch ride-hailing vehicles, parents notified, vehicles tracked in the same parent app map.

### Phase 4 — Liability Dashboard + Developer API (Month 18–24)

Full chain-of-custody timeline per student per day. Incident report generator. Exportable for legal purposes. AIS-140 trip logs in prescribed format. Insurance premium negotiation reports.

OAuth 2.0 developer API goes public: school portals, third-party parent apps, and district education platforms can build on SafeRide.

### Phase 5 — Operational Intelligence (Month 24+)

AI route optimisation (10–20% reduction in trip time). Fuel tracking. Driver scoring. Fee collection. Fleet maintenance scheduling. App marketplace for third-party integrations.

---

## 15. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Video bandwidth cost exceeds plan pricing | Medium | High | Video is a paid add-on. Bandwidth costs modelled per bus per hour. School pays for what they use. |
| Driver refuses to use the app | High | High | App requires zero interaction during trip. Background task starts at "Start Trip" tap. Driver has no reason to refuse. |
| Poor connectivity in semi-urban areas | High | Medium | Offline-first driver app. GPS queued, synced on reconnect. Last-known position shown to parents. |
| School sales cycle too slow | Medium | Medium | Bottom-up: target transport managers directly, not principals. Grass-roots pressure from parents. |
| ERP integration breaks on Fedena update | Medium | Low | Adapter pattern isolates ERP-specific code. Integration has its own test suite. Monitored for sync failures. |
| AIS-140 regulation tightened | Low | Medium | Compliance layer is an independent module. Monitor MoRTH notifications. Phone GPS → AIS-140 format conversion already built. |
| Data privacy incident | Low | Very High | Strict tenant isolation (DB-level RLS), DPDP 2023 compliance, penetration testing every 6 months. |

---

## 16. Appendix

### A. Glossary

| Term | Definition |
|---|---|
| AIS-140 | Automotive Industry Standard 140 — ARAI-defined GPS tracking spec mandatory for Indian school buses |
| DPDP 2023 | Digital Personal Data Protection Act 2023 — India's primary data privacy law |
| RFID | Radio-Frequency Identification — student ID tap card technology |
| NFC | Near-Field Communication — short-range tap technology (same chip as modern RFID) |
| UDISE | Unified District Information System for Education — India's school identification code |
| E.164 | International phone number format: +91XXXXXXXXXX |
| HLS | HTTP Live Streaming — video format for recorded playback |
| WebRTC | Web Real-Time Communication — protocol for live peer-to-peer video |
| SFU | Selective Forwarding Unit — video server that routes streams without transcoding |
| Multi-tenancy | Single software instance serving multiple schools with complete data isolation |
| Geofence | Virtual geographic boundary used for school arrival/departure detection |
| ETA | Estimated Time of Arrival — calculated from GPS position + historical data |
| Webhook | HTTP callback — SafeRide POSTs events to a URL the partner registers |

### B. Competitive Feature Matrix

| Feature | SafeRide | NeoTrack | Chakraview | VersionX |
|---|---|---|---|---|
| Real-time GPS tracking | ✓ | ✓ | ✓ | ✓ |
| Parent app (iOS + Android) | ✓ | ✓ | ✓ | ✓ |
| Live bus video | ✓ | ✗ | ✗ | ✗ |
| Incident video playback | ✓ | ✗ | ✗ | ✗ |
| Phone-first GPS (no hardware needed) | ✓ | ✗ | ✗ | ✗ |
| Webhook system | ✓ | ✗ | ✗ | ✗ |
| Fedena ERP integration | ✓ | ✗ | ✗ | ✗ |
| Ola/Rapido dispatch fallback | ✓ (Phase 3) | ✗ | ✗ | ✗ |
| Multi-language (7 languages) | ✓ | Partial | ✗ | ✗ |
| Self-service onboarding | ✓ | ✗ | ✗ | ✗ |
| RFID tap confirmation | ✓ (Phase 2) | Partial | ✗ | ✗ |
| School gate tracking | ✓ (Phase 3) | ✗ | ✗ | ✗ |
| Funding / Scale | Building | Qatar-based, $0 raised | ₹95L revenue, 1–10 staff | Hardware vendor |

---

*SafeRide PRD v2.0 — Confidential & Proprietary — March 2026*
