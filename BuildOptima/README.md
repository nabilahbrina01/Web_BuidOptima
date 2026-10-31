# BuildOptima

Sistem Manajemen Gedung Pintar — Teknik Komputer, Universitas Diponegoro.

BuildOptima memantau dan mengontrol kondisi ruangan (okupansi, suhu, kelembapan, energi listrik) secara real-time menggunakan sensor IoT (ESP32), dengan dashboard web untuk monitoring, kontrol perangkat, manajemen inventaris, dan penjadwalan ruangan.

## Fitur

- 📊 **Dashboard** — ringkasan ruangan aktif, konsumsi energi, dan peta gedung real-time
- 🏠 **Manajemen Ruangan** — status okupansi, jadwal aktif, suhu & kelembapan
- 📅 **Jadwal** — penjadwalan penggunaan ruangan dengan deteksi bentrok jadwal
- 💡 **Kontrol Perangkat** — nyala/matikan AC, lampu, dll dari jarak jauh via MQTT
- 📦 **Inventaris** — pendataan aset dengan QR code dan analisis kondisi (AI Predictive Maintenance)
- 🤖 **AI Inventory Verification** — verifikasi kondisi inventaris ruangan dari foto (deteksi objek otomatis, dibandingkan dengan data inventaris yang tercatat)
- ⚡ **Monitoring Energi** — konsumsi listrik harian/mingguan/bulanan/tahunan per ruangan
- 🔔 **Notifikasi** — peringatan real-time (perangkat offline, anomali energi, dll)
- 📄 **Laporan** — export laporan ke Excel & PDF
- 👥 **Manajemen User** — role admin & staff

## Tech Stack

**Backend**
- Node.js + Express
- MySQL + Prisma ORM
- Socket.IO (realtime)
- MQTT (komunikasi dengan ESP32)
- JWT Authentication

**Frontend**
- React (Vite)
- Socket.IO Client
- Recharts (grafik)
- Axios

## Struktur Proyek

buildoptima/
├── server/ # Backend API (Express + Prisma)
│ └── ai/ # Service AI Inventory Verification (lihat catatan di bawah)
├── frontend/ # Web dashboard (React)
└── iot/ # Firmware ESP32 (sensor & aktuator)


## Cara Menjalankan

### Prasyarat
- Node.js v18+
- MySQL (bisa pakai XAMPP/Laragon)
- npm

### 1. Clone repository

```bash
git clone # BuildOptima

Sistem Manajemen Gedung Pintar — Teknik Komputer, Universitas Diponegoro.

BuildOptima memantau dan mengontrol kondisi ruangan (okupansi, suhu, kelembapan, energi listrik) secara real-time menggunakan sensor IoT (ESP32), dengan dashboard web untuk monitoring, kontrol perangkat, manajemen inventaris, dan penjadwalan ruangan.

## Fitur

- 📊 **Dashboard** — ringkasan ruangan aktif, konsumsi energi, dan peta gedung real-time
- 🏠 **Manajemen Ruangan** — status okupansi, jadwal aktif, suhu & kelembapan
- 📅 **Jadwal** — penjadwalan penggunaan ruangan dengan deteksi bentrok jadwal
- 💡 **Kontrol Perangkat** — nyala/matikan AC, lampu, dll dari jarak jauh via MQTT
- 📦 **Inventaris** — pendataan aset dengan QR code dan analisis kondisi (AI Predictive Maintenance)
- 🤖 **AI Inventory Verification** — verifikasi kondisi inventaris ruangan dari foto (deteksi objek otomatis, dibandingkan dengan data inventaris yang tercatat)
- ⚡ **Monitoring Energi** — konsumsi listrik harian/mingguan/bulanan/tahunan per ruangan
- 🔔 **Notifikasi** — peringatan real-time (perangkat offline, anomali energi, dll)
- 📄 **Laporan** — export laporan ke Excel & PDF
- 👥 **Manajemen User** — role admin & staff

## Tech Stack

**Backend**
- Node.js + Express
- MySQL + Prisma ORM
- Socket.IO (realtime)
- MQTT (komunikasi dengan ESP32)
- JWT Authentication

**Frontend**
- React (Vite)
- Socket.IO Client
- Recharts (grafik)
- Axios

## Struktur Proyek

buildoptima/
├── server/ # Backend API (Express + Prisma)
│ └── ai/ # Service AI Inventory Verification (lihat catatan di bawah)
├── frontend/ # Web dashboard (React)
└── iot/ # Firmware ESP32 (sensor & aktuator)


## Cara Menjalankan

### Prasyarat
- Node.js v18+
- MySQL (bisa pakai XAMPP/Laragon)
- npm

### 1. Clone repository

```bash
git clone https://github.com/nabilahbrina01/Web_BuidOptima.git
cd buildoptimafix
```

### 2. Setup Backend

```bash
cd server
npm install
```

Copy `.env.example` menjadi `.env`, lalu isi sesuai environment kamu:

```env
DATABASE_URL="mysql://root:@localhost:3306/buildoptima"
JWT_SECRET="ganti_dengan_string_acak_minimal_32_karakter"
PORT=4000
CLIENT_URL=http://localhost:5173
```

Buat database MySQL bernama `buildoptima`, lalu jalankan migrasi & seed data awal:

```bash
npx prisma migrate dev
npm run prisma:seed
```

Jalankan server:

```bash
npm run dev
```

Backend berjalan di `http://localhost:4000`.

### 3. Setup Frontend

Buka terminal baru:

```bash
cd frontend
npm install
```

Pastikan file `.env` berisi:

```env
VITE_API_MODE=real
VITE_SOCKET_URL=http://localhost:4000
```

Jalankan:

```bash
npm run dev
```

Frontend berjalan di `http://localhost:5173`.

### 4. Login

Setelah seeding, gunakan akun default berikut:

| Role  | Username | Password |
|-------|----------|----------|
| Admin | `admin`  | `12345678` |
| Staff | `staff`  | `12345678` |

## Kontribusi Tim

| Bagian    | Deskripsi |
|-----------|-----------|
| Backend   | API, database, business logic |
| Frontend  | Dashboard web (React) |
| IoT       | Firmware ESP32, sensor, aktuator |
| AI        | Model deteksi objek untuk verifikasi inventaris (lihat bagian **AI Inventory Verification** di bawah) |

## AI Inventory Verification

Endpoint sudah tersedia di backend (`POST /api/ai-verification`, `GET /api/ai-verification`) untuk menerima foto ruangan dan membandingkan objek yang terdeteksi dengan data inventaris ruangan tersebut.

**Status saat ini:**
- Deteksi objek masih berupa **mock/dummy data** (lihat `server/ai/aiVerification.service.js`, fungsi `runDetection()`) — belum terhubung ke model AI sungguhan.
- **Belum ada halaman di frontend** untuk upload foto & menampilkan hasil verifikasi — perlu dibuat.

**Yang perlu dikerjakan tim AI:**
1. Ganti fungsi `runDetection()` di `server/ai/aiVerification.service.js` dengan model deteksi objek sungguhan (disarankan YOLO — arsitektur backend sudah disiapkan untuk ini). Bisa berupa model lokal (ONNX runtime), microservice Python terpisah (FastAPI), atau layanan cloud vision API.
2. Input: file gambar (lihat `middleware/upload.middleware.js` untuk format upload yang diterima).
3. Output yang diharapkan dari `runDetection()`: array objek `{ label, confidence, count }` — lihat contoh mock di file yang sama untuk format persisnya.
4. Koordinasi dengan tim Frontend untuk membuat halaman upload foto ruangan + tampilan hasil verifikasi (data mismatch antara objek terdeteksi vs inventaris tercatat).

## Lisensi

Proyek internal — Teknik Komputer UNDIP.

cd buildoptimafix
```

### 2. Setup Backend

```bash
cd server
npm install
```

Copy `.env.example` menjadi `.env`, lalu isi sesuai environment kamu:

```env
DATABASE_URL="mysql://root:@localhost:3306/buildoptima"
JWT_SECRET="ganti_dengan_string_acak_minimal_32_karakter"
PORT=4000
CLIENT_URL=http://localhost:5173
```

Buat database MySQL bernama `buildoptima`, lalu jalankan migrasi & seed data awal:

```bash
npx prisma migrate dev
npm run prisma:seed
```

Jalankan server:

```bash
npm run dev
```

Backend berjalan di `http://localhost:4000`.

### 3. Setup Frontend

Buka terminal baru:

```bash
cd frontend
npm install
```

Pastikan file `.env` berisi:

```env
VITE_API_MODE=real
VITE_SOCKET_URL=http://localhost:4000
```

Jalankan:

```bash
npm run dev
```

Frontend berjalan di `http://localhost:5173`.

### 4. Login

Setelah seeding, gunakan akun default berikut:

| Role  | Username | Password |
|-------|----------|----------|
| Admin | `admin`  | `12345678` |
| Staff | `staff`  | `12345678` |

## Kontribusi Tim

| Bagian    | Deskripsi |
|-----------|-----------|
| Backend   | API, database, business logic |
| Frontend  | Dashboard web (React) |
| IoT       | Firmware ESP32, sensor, aktuator |
| AI        | Model deteksi objek untuk verifikasi inventaris (lihat bagian **AI Inventory Verification** di bawah) |

## AI Inventory Verification

Endpoint sudah tersedia di backend (`POST /api/ai-verification`, `GET /api/ai-verification`) untuk menerima foto ruangan dan membandingkan objek yang terdeteksi dengan data inventaris ruangan tersebut.

**Status saat ini:**
- Deteksi objek masih berupa **mock/dummy data** (lihat `server/ai/aiVerification.service.js`, fungsi `runDetection()`) — belum terhubung ke model AI sungguhan.
- **Belum ada halaman di frontend** untuk upload foto & menampilkan hasil verifikasi — perlu dibuat.

**Yang perlu dikerjakan tim AI:**
1. Ganti fungsi `runDetection()` di `server/ai/aiVerification.service.js` dengan model deteksi objek sungguhan (disarankan YOLO — arsitektur backend sudah disiapkan untuk ini). Bisa berupa model lokal (ONNX runtime), microservice Python terpisah (FastAPI), atau layanan cloud vision API.
2. Input: file gambar (lihat `middleware/upload.middleware.js` untuk format upload yang diterima).
3. Output yang diharapkan dari `runDetection()`: array objek `{ label, confidence, count }` — lihat contoh mock di file yang sama untuk format persisnya.
4. Koordinasi dengan tim Frontend untuk membuat halaman upload foto ruangan + tampilan hasil verifikasi (data mismatch antara objek terdeteksi vs inventaris tercatat).

## Lisensi

Proyek internal — Teknik Komputer UNDIP.
