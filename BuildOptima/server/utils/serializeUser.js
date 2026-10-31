/**
 * Bentuk user yang dikonsumsi frontend (Sidebar, Settings, Manajemen User):
 * { id, username, email, role, name, initials, nip, phone, photo }
 * Tidak pernah menyertakan password / OTP.
 */
const initialsOf = (name) =>
  String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'US';

const serializeUser = (u) => {
  const name = u.name || u.username;
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    name,
    initials: initialsOf(name),
    nip: u.nip ?? null,
    phone: u.phone ?? null,
    photo: u.photo ?? null,
    notif_email: u.notif_email ?? true,
    notif_push: u.notif_push ?? true,
    notif_daily: u.notif_daily ?? false,
    created_at: u.created_at,
  };
};

module.exports = { serializeUser, initialsOf };
