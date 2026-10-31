const rateLimit = require('express-rate-limit');

/**
 * Pembatasan percobaan (rate limiting) — mencegah tebak password / tebak OTP / spam email.
 *
 * Semua angka bisa diubah lewat .env (lihat .env.example):
 *   RATE_LIMIT_DISABLED=true      matikan semua limiter (hanya untuk tes otomatis)
 *   RATE_LIMIT_WINDOW_MIN=15      lamanya jendela hitung (menit)
 *   RATE_LIMIT_MAX=2000           batas umum seluruh /api per IP per jendela
 *   AUTH_RATE_LIMIT_MAX=8         login GAGAL per IP+username per jendela (per IP saja = 3x)
 *   OTP_RATE_LIMIT_MAX=5          tebakan OTP SALAH per email per jendela (per IP = 4x)
 *   OTP_SEND_RATE_LIMIT_MAX=5     permintaan kirim OTP per email per jendela (per IP = 4x)
 *
 * Catatan: penghitung disimpan di memori server (reset saat restart, tidak dibagi antar-instance).
 * Bila server berada di belakang proxy/Nginx, isi TRUST_PROXY=1 agar IP asli klien terbaca.
 */
const num = (v, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const WINDOW_MS = num(process.env.RATE_LIMIT_WINDOW_MIN, 15) * 60 * 1000;
const MAX_API   = num(process.env.RATE_LIMIT_MAX, 2000);
const MAX_LOGIN = num(process.env.AUTH_RATE_LIMIT_MAX, 8);
const MAX_OTP   = num(process.env.OTP_RATE_LIMIT_MAX, 5);
const MAX_SEND  = num(process.env.OTP_SEND_RATE_LIMIT_MAX, 5);

const ipOf = (req) => (rateLimit.ipKeyGenerator ? rateLimit.ipKeyGenerator(req.ip) : req.ip);
const emailOf = (req) => String(req.body?.email || '').trim().toLowerCase();
const userOf = (req) => String(req.body?.username || '').trim().toLowerCase();

const make = (max, keyGenerator, { skipSuccessfulRequests = false } = {}) =>
  rateLimit({
    windowMs: WINDOW_MS,
    limit: max,
    standardHeaders: 'draft-7', // header RateLimit-* + Retry-After
    legacyHeaders: false,
    skipSuccessfulRequests,
    skip: () => process.env.RATE_LIMIT_DISABLED === 'true',
    keyGenerator,
    validate: { xForwardedForHeader: false }, // dev lewat proxy Vite mengirim X-Forwarded-For
    handler: (_req, res) =>
      res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' }),
  });

// Umum: semua /api per IP (longgar — agar banyak pengguna di satu jaringan kampus tidak terblokir)
const apiLimiter = make(MAX_API, (req) => `api:${ipOf(req)}`);

// Login: hanya percobaan GAGAL yang dihitung (login berhasil tidak mengurangi jatah)
const loginLimiters = [
  make(MAX_LOGIN, (req) => `login:${ipOf(req)}|${userOf(req)}`, { skipSuccessfulRequests: true }),
  make(MAX_LOGIN * 3, (req) => `login-ip:${ipOf(req)}`, { skipSuccessfulRequests: true }),
];

// Tebak OTP (verify-otp, verify-reset-otp, reset-password): dihitung per EMAIL (menahan serangan
// dari banyak IP) dan per IP (menahan serangan ke banyak email). Hanya yang gagal dihitung.
const otpLimiters = [
  make(MAX_OTP, (req) => `otp:${emailOf(req) || ipOf(req)}`, { skipSuccessfulRequests: true }),
  make(MAX_OTP * 4, (req) => `otp-ip:${ipOf(req)}`, { skipSuccessfulRequests: true }),
];

// Kirim OTP (register, resend-otp, forgot): mencegah spam email ke orang lain
const sendLimiters = [
  make(MAX_SEND, (req) => `send:${emailOf(req) || ipOf(req)}`),
  make(MAX_SEND * 4, (req) => `send-ip:${ipOf(req)}`),
];

// Ganti password (sudah login): tebak password lama dengan token curian — per user
const changePasswordLimiter = make(MAX_LOGIN, (req) => `chpw:${req.user?.id ?? ipOf(req)}`, { skipSuccessfulRequests: true });

// Email tes (Pengaturan -> Preferensi Notifikasi): cegah dipakai untuk spam. 5 kali per jendela per user.
const testEmailLimiter = make(5, (req) => `test-email:${req.user?.id ?? ipOf(req)}`);

module.exports = { apiLimiter, loginLimiters, otpLimiters, sendLimiters, changePasswordLimiter, testEmailLimiter };
