# Laporan Sinkronisasi Frontend ↔ Backend

UI **tidak diubah**: `index.css` identik, tidak ada `className` yang berubah, tidak ada elemen ditambah/dihapus.
Yang berubah hanya logika, pemanggilan API, dan pengikatan data.

## Cara menerapkan

```bash
cd server
npm install
npx prisma migrate deploy      # atau: npx prisma migrate dev  (2 migrasi baru)
npx prisma generate
npm run prisma:seed            # opsional (aman diulang)
npm run dev
```

Migrasi baru: `20260905090000_add_user_profile_and_asset_qr_code` dan `20260905120000_add_email_verified`. Yang pertama: (kolom `name`, `nip`, `phone`, `photo` di `users`,
plus backfill `qr_code` aset lama menjadi kode `SB-<tahun>-<id>`).

## Yang diperbaiki

### Kritis
| # | Masalah | Perbaikan |
|---|---------|-----------|
| 1 | **MQTT tidak pernah mem-publish.** `publish()` memakai `getClient` lokal, `mqtt/index.js` hanya menimpa `exports.getClient`. Kontrol perangkat & simulator tidak mengirim apa pun. | `mqtt/client.js` kini menyimpan client (`setClient`), `publish()` mengembalikan true/false. |
| 2 | **Siapa pun bisa mendaftar sebagai admin** lewat field `role` di `/auth/register`. | Pendaftaran publik selalu `staff`. |
| 3 | `PUT /users/:id` meneruskan body mentah ke Prisma (mass-assignment: `id`, `otp_code`, ...). | Whitelist field; hanya admin yang bisa ubah `role`. |

### Auth & Pengguna
- Data user tidak cocok: frontend butuh `name`, `initials`, `nip`, `phone`, `photo` → ditambah di DB + serializer (Sidebar tidak lagi menampilkan "??").
- Register/OTP: OTP tidak pernah diverifikasi dan email OTP baru dikirim *setelah* kode diisi. Sekarang: Register → backend kirim OTP → Verify memeriksa kode lewat `/auth/verify-otp`.
- Tombol "Kirim ulang" tidak melakukan apa pun → `/auth/resend-otp`.
- `/auth/forgot` (dipakai frontend) ≠ `/auth/forgot-password` → alias ditambahkan.
- Login mendukung username, **email, atau NIP** (label form "Username / NIP"; mock sudah begitu).
- `normalizeEmail()` menghapus titik email Gmail → diganti trim + lowercase.
- Gagal kirim email OTP kini membersihkan akun yatim (sebelumnya username/email terblokir).
- Ganti password di Pengaturan hanya toast → `/auth/change-password`.
- Staff tidak bisa menyimpan profil sendiri (`PUT /users/:id` admin-only, error ditelan) → boleh untuk akun sendiri.
- NIP & Telepon di Pengaturan tidak pernah disimpan (input tak terkontrol) → kini tersimpan.
- Foto profil (base64) melebihi limit body 100 KB → limit 2 MB.

### Inventaris
- `qr_code` berupa path file PNG, scan selalu 404 → kini kode pendek `SB-2026-007` (isi QR + kunci scan). QR lama (JSON/ID) tetap bisa discan.
- Bug scan ID numerik (`JSON.parse("5")` berhasil → cabang ID tak pernah jalan).
- Filter ruangan membandingkan string dengan angka (`===`) → hasil selalu kosong.
- Dropdown & toast menampilkan ID numerik, bukan kode ruangan.
- Tombol "+ Jadwalkan" hanya toast → kini menyimpan ke Riwayat Perawatan (Laporan) via `POST /reports/maintenance`.
- Seed: `condition_status` tidak konsisten dengan `condition`, `qr_code` kosong.

### Perangkat, Ruangan, Energi, Notifikasi
- Pencarian perangkat **crash** (`d.room_id.toLowerCase()` pada angka).
- Filter ruangan di Energi tidak berfungsi (frontend kirim `room`, backend baca `roomId`).
- Notifikasi: `summary` & `detail` tidak ada di backend → kartu & modal kosong.
- Detail ruangan menampilkan "null — null WIB", suhu/kelembapan kosong → fallback "–".
- Dashboard: grafik "Energi Hari Ini" selalu 0 → dari timeline harian; label tarif ikut backend.
- Angka kWh/Rp dibulatkan di backend.

### Realtime
- Nama event frontend (`room:update`, `energy:reading`, ...) tidak ada satu pun yang di-emit backend. Diganti dengan event yang benar: `room:occupancy`, `sensor:data` (kini membawa `room_id`), `device:update/status`, `energy:data`, `notification:new`.
- Indikator "MQTT tersambung" tak pernah hijau → backend emit `mqtt-status`.
- `useRealtime` ditambah event baru; proxy Vite `/ws` → `/socket.io`.

### Konfigurasi
- `server/.env.example`: PORT 5000→4000, CLIENT_URL 3000→5173 (sesuai README & proxy Vite).
- `frontend/.env.example`: variabel yang disebut tidak dipakai kode → diganti yang benar.
- Pesan error backend (Inggris) dipetakan ke Indonesia; error validasi 422 menampilkan pesan field, bukan "Validation failed".
- Mock mode ikut diselaraskan (`room_code`, endpoint baru).

## Pengujian
- Backend: 42 tes HTTP terhadap aplikasi Express asli dengan Prisma palsu in-memory (auth, user, aset/QR, notifikasi, maintenance, MQTT) — lulus semua.
- Frontend: `vite build` sukses.
- **Belum diuji** terhadap MySQL, broker MQTT, dan SMTP sungguhan. SQL migrasi ditulis manual (Prisma CLI tidak bisa jalan di lingkungan tanpa akses internet) — jalankan `prisma migrate` dan cek.

## Putaran 2 — item yang sebelumnya menunggu keputusan (sudah dikerjakan)

1. **Lupa password kini bisa diselesaikan dari UI.** Halaman baru `/reset` (kode 6 digit + password baru + kirim ulang kode),
   memakai kelas CSS yang sama dengan Verify/Register. Satu-satunya perubahan teks di halaman lama (Forgot):
   "tautan reset" → "kode reset" (karena backend mengirim OTP, bukan tautan).
2. **Verifikasi email dipaksa.** Kolom `users.email_verified` (migrasi `20260905120000_add_email_verified`; semua akun yang sudah ada
   otomatis `true`). Login akun belum verifikasi → 403 "Email belum diverifikasi". Mendaftar ulang dengan email+username yang sama
   selama belum verifikasi = kirim OTP baru (bukan 409). Reset password yang sukses juga menandai email terverifikasi. User buatan admin langsung terverifikasi.
3. **Socket.IO kini wajib JWT.** Tanpa token / token palsu → `unauthorized`; frontend berhenti mencoba ulang bila ditolak.
4. **Toggle perangkat jujur terhadap MQTT.** Jika perintah tidak terkirim ke broker → HTTP 503 dan status di DB **tidak** diubah
   (UI menampilkan toast "Periksa koneksi broker MQTT!"). Auto-off saat ruangan kosong tetap lanjut meski satu relay gagal.
5. **Kontrak energi.** `energy_kwh` = delta per interval (yang dijumlahkan dashboard). Simulator PZEM diperbaiki (sebelumnya kumulatif).
   Firmware yang hanya punya counter kumulatif PZEM bisa mengirim `energy_total_kwh`; server menghitung delta-nya
   (pembacaan pertama = baseline, reset counter ditangani). Terdokumentasi di `server/README.md`.
6. Server memakai zona waktu `Asia/Jakarta` secara default (jadwal/status ruangan), bisa ditimpa lewat env `TZ`.

Pengujian putaran 2: 62 tes backend lulus (termasuk Socket.IO sungguhan dengan/tanpa token, relay saat broker mati,
logika delta energi, alur verifikasi & reset password); `vite build` sukses.

## Masih terbuka
- Preferensi notifikasi di Pengaturan hanya tersimpan lokal (belum ada endpoint backend).
- Fitur AI Verification belum punya halaman frontend (sesuai README proyek).
- Belum diuji terhadap MySQL, broker MQTT, dan SMTP sungguhan; jalankan `prisma migrate deploy` dan uji alur register → OTP → login di lingkungan Anda.
- Pesan error backend selain yang terdaftar di `frontend/src/api/client.js` (ERROR_ID) tampil dalam bahasa Inggris.
