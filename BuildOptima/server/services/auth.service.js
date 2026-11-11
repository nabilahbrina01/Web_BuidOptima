const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const dayjs    = require('dayjs');
const prisma   = require('../config/prisma');
const mailer   = require('../utils/mailer');
const { serializeUser } = require('../utils/serializeUser');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants');

const SALT_ROUNDS = 12;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const authResponse = (user) => ({ token: signToken(user), user: serializeUser(user) });

const register = async ({ username, email, password, name, nip }) => {
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  const retry = exists && !exists.email_verified && exists.email === email && exists.username === username;
  if (exists && !retry) throw { status: 409, message: 'Email or username already in use' };

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const otp    = generateOtp();
  const otpExp = dayjs().add(3, 'minute').toDate();
  const profile = { name: (name && String(name).trim()) || username, nip: nip || null };

  const user = retry
    ? await prisma.user.update({
        where: { id: exists.id },
        data: { password: hashed, ...profile, otp_code: otp, otp_expired: otpExp },
      })
    : await prisma.user.create({
        data: { username, email, password: hashed, role: 'staff', email_verified: false, ...profile, otp_code: otp, otp_expired: otpExp },
      });

  try {
    await mailer.sendOtp(email, otp);
  } catch (err) {
    // Jangan tinggalkan akun "yatim" yang tak bisa diverifikasi & memblokir username/email
    if (!retry) await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    console.error('[MAIL] Gagal mengirim OTP:', err.message);
    throw { status: 502, message: 'Failed to send verification email' };
  }

  return { id: user.id, email: user.email, username: user.username };
};

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────
const verifyOtp = async ({ email, otp }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw { status: 404, message: 'User not found' };
  if (user.otp_code !== otp) throw { status: 400, message: 'Invalid OTP' };
  if (dayjs().isAfter(user.otp_expired)) throw { status: 400, message: 'OTP expired' };

  await prisma.user.update({
    where: { id: user.id },
    data: { otp_code: null, otp_expired: null, email_verified: true },
  });

  return authResponse({ ...user, email_verified: true });
};

// ─── RESEND OTP ───────────────────────────────────────────────────────────────
const resendOtp = async ({ email }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // jangan bocorkan apakah email terdaftar

  const otp    = generateOtp();
  const otpExp = dayjs().add(3, 'minute').toDate();
  await prisma.user.update({ where: { id: user.id }, data: { otp_code: otp, otp_expired: otpExp } });
  await mailer.sendOtp(email, otp);
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// Form login berlabel "Username / NIP" — terima username, email, atau NIP.
const login = async ({ username, password }) => {
  const identifier = String(username).trim();
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }, { nip: identifier }] },
  });
  if (!user) throw { status: 401, message: 'Invalid credentials' };

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw { status: 401, message: 'Invalid credentials' };

  // Pakai 403 (bukan 401) supaya interceptor frontend tidak menganggapnya token kedaluwarsa
  if (!user.email_verified) throw { status: 403, message: 'Email not verified' };

  return authResponse(user);
};

// ─── ME ───────────────────────────────────────────────────────────────────────
const me = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: parseInt(userId, 10) } });
  if (!user) throw { status: 404, message: 'User not found' };
  return serializeUser(user);
};

// ─── CHANGE PASSWORD (user sudah login) ───────────────────────────────────────
const changePassword = async (userId, { oldPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: parseInt(userId, 10) } });
  if (!user) throw { status: 404, message: 'User not found' };

  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) throw { status: 400, message: 'Old password is incorrect' };

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
const forgotPassword = async ({ email }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always respond OK to prevent email enumeration
  if (!user) return;

  const otp    = generateOtp();
  const otpExp = dayjs().add(3, 'minute').toDate();

  await prisma.user.update({
    where: { id: user.id },
    data: { otp_code: otp, otp_expired: otpExp },
  });

  await mailer.sendOtp(email, otp, 'password_reset');
};

// ─── VERIFY RESET OTP (langkah 2 lupa password) ───────────────────────────────
// Hanya memeriksa kode; OTP baru dihabiskan saat reset-password dipanggil.
const verifyResetOtp = async ({ email, otp }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.otp_code || user.otp_code !== otp) throw { status: 400, message: 'Invalid OTP' };
  if (dayjs().isAfter(user.otp_expired)) throw { status: 400, message: 'OTP expired' };
};

// ─── RESET PASSWORD (after OTP) ───────────────────────────────────────────────
const resetPassword = async ({ email, otp, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw { status: 404, message: 'User not found' };
  if (user.otp_code !== otp) throw { status: 400, message: 'Invalid OTP' };
  if (dayjs().isAfter(user.otp_expired)) throw { status: 400, message: 'OTP expired' };

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, otp_code: null, otp_expired: null, email_verified: true },
  });
};

module.exports = { register, verifyOtp, resendOtp, login, me, changePassword, forgotPassword, verifyResetOtp, resetPassword };