# BuildOptima — Smart Building Management System (Backend)

Backend API server for **BuildOptima**, a Smart Building Management System built for Teknik Komputer UNDIP. Provides real-time IoT integration, room scheduling, energy monitoring, inventory management, and AI-based inventory verification.

---

## Tech Stack

| Layer         | Technology                              |
|---------------|-----------------------------------------|
| Runtime       | Node.js ≥ 18                            |
| Framework     | Express.js                              |
| Database      | MySQL 8+                                |
| ORM           | Prisma                                  |
| Auth          | JWT + bcrypt                            |
| Realtime      | Socket.IO                               |
| IoT Messaging | MQTT (via EMQX or Mosquitto)            |
| Email         | Nodemailer                              |
| File Upload   | Multer                                  |
| Validation    | express-validator                       |
| Date Handling | dayjs                                   |
| QR Codes      | qrcode                                  |

---

## Project Structure

```
server/
├── prisma/
│   ├── schema.prisma          # Full relational schema (MySQL)
│   └── seed.js                # Demo data seeder
├── config/
│   ├── prisma.js              # Prisma client singleton
│   └── constants.js           # App-wide constants & MQTT config
├── routes/                    # Express route definitions
├── controllers/               # HTTP request handlers
├── services/                  # Business logic layer
├── middleware/
│   ├── auth.middleware.js     # JWT verify + role guard
│   ├── validate.middleware.js # express-validator error handler
│   └── upload.middleware.js   # Multer image upload
├── mqtt/
│   ├── index.js               # MQTT init & topic router
│   ├── client.js              # MQTT client singleton
│   └── processors.js          # Per-topic message processors
├── sockets/
│   └── index.js               # Socket.IO init & event handling
├── validators/                # express-validator rule sets
├── uploads/                   # Uploaded images & QR codes
├── utils/
│   ├── mailer.js              # Nodemailer OTP sender
│   ├── asyncHandler.js        # Async error wrapper
│   └── deviceHealthChecker.js # Periodic offline detection
├── ai/
│   └── aiVerification.service.js  # YOLO placeholder + mock
├── simulators/                # Dummy IoT data generators
│   ├── mmwave.simulator.js
│   ├── dht22.simulator.js
│   ├── pzem.simulator.js
│   ├── heartbeat.simulator.js
│   └── index.js
├── app.js                     # Express app (routes + middleware)
└── server.js                  # Entry point (HTTP + Socket.IO + MQTT)
```

---

## Prerequisites

- **Node.js** ≥ 18.0.0
- **MySQL** 8.0+ (running locally or remote)
- **MQTT Broker** — EMQX Community or Mosquitto (optional; required for IoT)

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
DATABASE_URL="mysql://root:yourpassword@localhost:3306/buildoptima"
JWT_SECRET="your_secret_min_32_chars"
```

### 3. Set Up Database

```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to MySQL (creates all tables)
npm run prisma:push

# Seed demo data (users, rooms, devices, schedules, etc.)
npm run prisma:seed
```

### 4. Start Development Server

```bash
npm run dev
```

API will be available at: `http://localhost:5000`

---

## Default Credentials (after seed)

| Role  | Email                     | Password     |
|-------|---------------------------|--------------|
| Admin | `admin` (email: buildoptimaproject@gmail.com, ubah lewat `ADMIN_EMAIL`) | 12345678 |
| Staff | `staff` (email: staff@buildoptima.id, ubah lewat `STAFF_EMAIL`)         | 12345678 |

---

## API Reference

### Base URL
```
http://localhost:5000/api
```

All protected routes require:
```
Authorization: Bearer <jwt_token>
```

---

### Authentication  `/auth`

| Method | Endpoint              | Auth | Description                     |
|--------|-----------------------|------|---------------------------------|
| POST   | `/auth/register`      | ✗    | Register staff (sends OTP; re-register while unverified resends OTP) |
| POST   | `/auth/verify-otp`    | ✗    | Verify email with OTP → returns JWT |
| POST   | `/auth/resend-otp`    | ✗    | Send a new verification OTP     |
| POST   | `/auth/login`         | ✗    | Login by username / email / NIP → JWT (403 if email not verified) |
| POST   | `/auth/forgot-password` (alias `/auth/forgot`) | ✗ | Send password reset OTP |
| POST   | `/auth/reset-password`  | ✗  | Reset password with OTP         |
| POST   | `/auth/change-password` | ✓  | Change own password (old + new) |
| GET    | `/auth/me`            | ✓    | Get current user profile        |

**Login body:**
```json
{ "username": "admin", "password": "12345678" }
```

---

### Rooms  `/rooms`

| Method | Endpoint        | Role  | Description               |
|--------|-----------------|-------|---------------------------|
| GET    | `/rooms`        | all   | List all rooms            |
| GET    | `/rooms/status` | all   | Occupancy status overview |
| GET    | `/rooms/:id`    | all   | Room detail with devices  |
| POST   | `/rooms`        | admin | Create room               |
| PUT    | `/rooms/:id`    | admin | Update room               |
| DELETE | `/rooms/:id`    | admin | Delete room               |

Query params: `?floor=2`

---

### Schedules  `/schedules`

| Method | Endpoint               | Role  | Description                  |
|--------|------------------------|-------|------------------------------|
| GET    | `/schedules`           | all   | List schedules               |
| GET    | `/schedules/:id`       | all   | Schedule detail              |
| POST   | `/schedules`           | admin | Create (validates conflicts) |
| PUT    | `/schedules/:id`       | admin | Update                       |
| DELETE | `/schedules/:id`       | admin | Delete                       |
| POST   | `/schedules/conflicts` | all   | Check for time conflict      |

Conflict check body:
```json
{ "roomId": 1, "day": "monday", "startTime": "10:00:00", "endTime": "12:00:00" }
```

---

### Devices  `/devices`

| Method | Endpoint            | Role  | Description               |
|--------|---------------------|-------|---------------------------|
| GET    | `/devices`          | all   | List devices              |
| GET    | `/devices/:id`      | all   | Device detail             |
| POST   | `/devices`          | admin | Register new ESP32        |
| PUT    | `/devices/:id`      | admin | Update device info        |
| DELETE | `/devices/:id`      | admin | Remove device             |
| POST   | `/devices/heartbeat`| all   | ESP32 heartbeat ping      |

Heartbeat body:
```json
{ "esp_id": "ESP32_R101_01" }
```

---

### Sensors  `/sensors`

| Method | Endpoint              | Auth | Description              |
|--------|-----------------------|------|--------------------------|
| GET    | `/sensors`            | ✓    | List sensors             |
| POST   | `/sensors`            | admin| Create sensor            |
| DELETE | `/sensors/:id`        | admin| Remove sensor            |
| GET    | `/sensors/logs/:id`   | ✓    | Sensor reading history   |

Query params: `?period=1h|24h|7d`

---

### Energy  `/energy`

| Method | Endpoint              | Auth | Description                    |
|--------|-----------------------|------|--------------------------------|
| GET    | `/energy`             | ✓    | Latest energy readings         |
| POST   | `/energy`             | ✓    | Log energy reading             |
| GET    | `/energy/analytics`   | ✓    | Aggregated usage by period     |

Query: `?period=daily|weekly|monthly&roomId=1`

---

### Assets  `/assets`

| Method | Endpoint       | Role  | Description                  |
|--------|----------------|-------|------------------------------|
| GET    | `/assets`      | all   | List assets (filter by room) |
| GET    | `/assets/:id`  | all   | Asset detail + QR path       |
| POST   | `/assets`      | admin | Create asset (auto QR gen)   |
| PUT    | `/assets/:id`  | admin | Update asset                 |
| DELETE | `/assets/:id`  | admin | Remove asset                 |

---

### Notifications  `/notifications`

| Method | Endpoint                    | Auth | Description          |
|--------|-----------------------------|------|----------------------|
| GET    | `/notifications`            | ✓    | List notifications   |
| PUT    | `/notifications/:id/read`   | ✓    | Mark one as read     |
| PUT    | `/notifications/read-all`   | ✓    | Mark all as read     |
| DELETE | `/notifications/:id`        | ✓    | Delete notification  |

Query: `?unreadOnly=true`

---

### AI Inventory Verification  `/ai-verification`

| Method | Endpoint           | Auth | Description                         |
|--------|--------------------|------|-------------------------------------|
| POST   | `/ai-verification` | ✓    | Upload room image → get AI report   |
| GET    | `/ai-verification` | ✓    | Verification history                |

POST: `multipart/form-data` with fields `room_id` + `image` (jpg/png/webp).

---

### Automation  `/automation`

| Method | Endpoint             | Role        | Description              |
|--------|----------------------|-------------|--------------------------|
| POST   | `/automation/relay`  | admin/staff | Toggle relay actuator    |
| POST   | `/automation/ir`     | admin/staff | Send IR command          |

Relay body: `{ "actuatorId": 1, "state": "on" }`  
IR body: `{ "deviceId": 1, "command": "AC_POWER_ON", "data": "..." }`

---

### Dashboard  `/dashboard`

| Method | Endpoint              | Auth | Description               |
|--------|-----------------------|------|---------------------------|
| GET    | `/dashboard/summary`  | ✓    | Aggregated stats snapshot |

---

## MQTT Topics

All topics follow the pattern: `buildoptima/{category}/{esp_id}[/{sub}]`

| Topic Pattern                          | Direction    | Description                    |
|----------------------------------------|--------------|--------------------------------|
| `buildoptima/mmwave/{esp_id}`          | ESP → Server | mmWave presence detection      |
| `buildoptima/sensor/{esp_id}/{type}`   | ESP → Server | DHT22 / generic sensor data    |
| `buildoptima/energy/{esp_id}`          | ESP → Server | PZEM-004T energy reading       |
| `buildoptima/device/{esp_id}/heartbeat`| ESP → Server | Device alive ping              |
| `buildoptima/control/{esp_id}/relay/{id}` | Server → ESP | Relay toggle command        |
| `buildoptima/control/{esp_id}/ir`      | Server → ESP | IR command                     |

### ESP32 Payload Examples

**mmWave presence:**
```json
{ "presence": true, "room_id": 1, "ts": 1718000000000 }
```

**DHT22 temperature:**
```json
{ "sensor_id": 2, "value": 26.5, "ts": 1718000000000 }
```

**PZEM-004T energy:**
```json
{ "room_id": 1, "voltage": 220.1, "current": 3.2, "power": 704.3, "energy_kwh": 0.00195 }
```
`energy_kwh` is the consumption **during this reading interval (delta)** — the dashboard sums these values.
If the firmware only has PZEM's cumulative counter, send `"energy_total_kwh"` instead (omit `energy_kwh`);
the server computes the delta against the previous reading (first reading = baseline, counter reset is handled).

**Heartbeat:**
```json
{ "esp_id": "ESP32_R101_01", "ts": 1718000000000 }
```

---

## Socket.IO Events

Connect to: `http://localhost:4000` (Socket.IO). A valid JWT is **required**: `io(url, { auth: { token } })`.

| Event              | Direction      | Payload                                |
|--------------------|----------------|----------------------------------------|
| `dashboard:update` | Server → Client| Full dashboard summary object          |
| `room:occupancy`   | Server → Client| `{ room_id, status, ts }`              |
| `device:status`    | Server → Client| `{ espId, status, deviceId }`          |
| `sensor:data`      | Server → Client| `{ esp_id, sensor_type, value, ... }`  |
| `energy:data`      | Server → Client| Full EnergyLog record                  |
| `notification:new` | Server → Client| Full Notification record               |
| `device:update`    | Server → Client| `{ deviceId, actuatorId, status }`     |
| `mqtt-status`      | Server → Client| `{ connected }` (also sent on connect) |

**Client can join room-specific channel:**
```js
socket.emit('join:room', roomId);
// Now receives targeted room:occupancy events for that room
```

---

## Sensor Simulators

Set `ENABLE_SIMULATORS=true` in `.env` to run without hardware.

Simulators publish fake MQTT messages at these intervals:

| Simulator    | Interval | Data                             |
|--------------|----------|----------------------------------|
| Heartbeat    | 15s      | Device alive pings               |
| mmWave       | 8s       | Random presence (60% occupied)   |
| DHT22        | 10s      | Temp 25–28°C, Humidity 57–73%    |
| PZEM-004T    | 12s      | Realistic power & kWh values     |

---

## Database Schema Overview

```
users          → authentication, roles, OTP
rooms          → room registry, occupancy status
schedules      → room booking with conflict validation
devices        → ESP32 device registry, heartbeat
sensors        → sensor type assignments per device
sensor_logs    → time-series sensor readings
occupancy_logs → mmWave presence history
energy_logs    → PZEM-004T time-series data
actuators      → relay / IR state per device
assets         → inventory items with QR codes
notifications  → system alerts & events
inventory_ai_results → YOLO detection result history
```

---

## Security Notes

- All passwords hashed with **bcrypt** (12 rounds)
- JWT tokens expire in 7 days (configurable)
- Role-based routes: `admin` can manage; `staff` can read + operate
- OTP codes expire after **10 minutes**
- File uploads restricted to image types; 10 MB max
- CORS restricted to `CLIENT_URL` in production
- All sensitive config via `.env` — never commit `.env`

---

## Future Extensions

| Feature                | Status      | Notes                                    |
|------------------------|-------------|------------------------------------------|
| YOLO object detection  | Placeholder | Replace `runDetection()` in `ai/`        |
| Mobile app support     | Ready       | Stateless JWT API, no session coupling   |
| React frontend         | Ready       | CORS + Socket.IO configured              |
| Multi-building support | Easy        | Add `building_id` to rooms schema        |
| Rate limiting          | Recommended | Add `express-rate-limit` middleware      |
| Redis caching          | Optional    | For dashboard summary & sensor snapshots |
| HTTPS / SSL            | Production  | Use nginx reverse proxy + Let's Encrypt  |


---

## 🔒 Security

| Area | Implementation |
|------|----------------|
| Authentication | JWT (`Authorization: Bearer …`), passwords hashed with bcrypt (12 rounds), email verification via OTP |
| Authorization | Role-based (`admin` / `staff`) enforced on the server |
| Brute-force protection | `express-rate-limit`: failed logins (per IP+username and per IP), wrong OTP guesses (per email and per IP), OTP/email sending (per email and per IP), change-password, plus a generous global `/api` limit. Exceeding a limit returns **429** with `Retry-After` |
| HTTP headers | `helmet` (X-Content-Type-Options, HSTS, X-Frame-Options, …); `X-Powered-By` removed |
| Secrets | `JWT_SECRET` must be a random string ≥ 32 chars. With `NODE_ENV=production` the server **refuses to start** if it is empty/weak; in development it only warns |
| Error handling | Unexpected errors (bugs, database/Prisma) are logged on the server only; clients get a generic `Internal server error` |
| SQL injection | Prisma ORM (parameterised queries) |
| Realtime | Socket.IO requires a valid JWT |

Limits are configurable in `.env` (`RATE_LIMIT_*`, `AUTH_RATE_LIMIT_MAX`, `OTP_RATE_LIMIT_MAX`, `OTP_SEND_RATE_LIMIT_MAX`).
Counters live in server memory (reset on restart). Behind a proxy/Nginx set `TRUST_PROXY=1`.

Production checklist: `NODE_ENV=production`, strong `JWT_SECRET`, HTTPS, change the seeded passwords (`12345678`), set `CLIENT_URL` to the real frontend URL.
