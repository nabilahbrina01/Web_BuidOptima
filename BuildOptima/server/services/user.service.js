const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');
const { serializeUser } = require('../utils/serializeUser');

const SALT_ROUNDS = 12;

const getAll = async () => {
  const users = await prisma.user.findMany({ orderBy: { created_at: 'desc' } });
  return users.map(serializeUser);
};

const getById = async (id) => {
  const user = await prisma.user.findUnique({ where: { id: parseInt(id, 10) } });
  if (!user) throw { status: 404, message: 'User not found' };
  return serializeUser(user);
};

const create = async ({ username, email, password, role, name, nip, phone }) => {
  if (!username || !email || !password) {
    throw { status: 400, message: 'username, email, and password are required' };
  }
  const exists = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (exists) throw { status: 409, message: 'Username or email already registered' };

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashed,
      role: role === 'admin' ? 'admin' : 'staff',
      email_verified: true, // dibuat oleh admin, tidak perlu OTP
      name: name || username,
      nip: nip || null,
      phone: phone || null,
    },
  });
  return serializeUser(user);
};

/**
 * @param {object} actor - req.user (JWT payload) — menentukan apakah boleh mengubah role
 */
const update = async (id, data, actor = {}) => {
  const userId = parseInt(id, 10);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw { status: 404, message: 'User not found' };

  // Whitelist field — jangan pernah meneruskan body mentah ke Prisma
  // (mencegah mass-assignment ke id / otp_code / password hash dsb).
  const updateData = {};
  if (data.name !== undefined)  updateData.name  = String(data.name).trim() || user.username;
  if (data.nip !== undefined)   updateData.nip   = data.nip || null;
  if (data.phone !== undefined) updateData.phone = data.phone || null;
  if (data.photo !== undefined) updateData.photo = data.photo || null;
  // Preferensi notifikasi: hanya nilai boolean sungguhan yang diterima
  ['notif_email', 'notif_push', 'notif_daily'].forEach((k) => {
    if (typeof data[k] === 'boolean') updateData[k] = data[k];
  });

  if (data.email !== undefined && data.email !== user.email) {
    const taken = await prisma.user.findFirst({ where: { email: data.email, NOT: { id: userId } } });
    if (taken) throw { status: 409, message: 'Username or email already registered' };
    updateData.email = data.email;
  }

  // Hanya admin yang boleh mengubah role
  if (data.role !== undefined && actor.role === 'admin' && ['admin', 'staff'].includes(data.role)) {
    updateData.role = data.role;
  }

  if (data.password) {
    if (String(data.password).length < 8) throw { status: 422, message: 'Password must be at least 8 characters' };
    updateData.password = await bcrypt.hash(data.password, SALT_ROUNDS);
  }

  const updated = await prisma.user.update({ where: { id: userId }, data: updateData });
  return serializeUser(updated);
};

const remove = async (id) => {
  const user = await prisma.user.findUnique({ where: { id: parseInt(id, 10) } });
  if (!user) throw { status: 404, message: 'User not found' };
  await prisma.user.delete({ where: { id: parseInt(id, 10) } });
};

module.exports = { getAll, getById, create, update, remove };
