import { db, persist, HOURLY_PATTERN } from './mockDb.js';

const DELAY = 220;

function wait(value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), DELAY));
}

class MockApiError extends Error {
  constructor(status, message) {
    super(message);
    this.response = { status, data: { error: message } };
  }
}

function fail(status, message) {
  throw new MockApiError(status, message);
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'US';
}

// Backend asli mengirim room_code (label) + room_id (id numerik). Di mock, id ruangan = kodenya.
const rc = (o) => (o && o.room_code === undefined ? { ...o, room_code: o.room_id ?? o.id } : o);
const rcAll = (list) => list.map(rc);

function h_verifyOtp(body) {
  if (!body.email || !body.otp) fail(400, 'Masukkan kode verifikasi.');
  return { message: 'Email terverifikasi (mode demo).' };
}

function h_verifyResetOtp(body) {
  if (!body.email || !/^\d{6}$/.test(String(body.otp || ''))) fail(400, 'Kode verifikasi salah.');
  return { message: 'OTP valid' }; // mode demo: kode 6 digit apa pun diterima
}

function h_resetPassword(body) {
  if (!body.email || !body.otp || !body.newPassword) fail(400, 'Lengkapi data reset password.');
  if (body.newPassword.length < 8) fail(422, 'Password baru minimal 8 karakter.');
  const u = db.users.find((x) => x.email === body.email);
  if (!u) fail(404, 'Pengguna tidak ditemukan.');
  db.credentials[u.username] = body.newPassword; // mode demo: kode apa pun diterima
  persist();
  return { message: 'Password reset' };
}

function h_changePassword(body) {
  let username = null;
  try { username = JSON.parse(localStorage.getItem('bo_user'))?.username; } catch { /* ignore */ }
  if (!username || db.credentials[username] !== body.oldPassword) fail(400, 'Password lama salah.');
  if (!body.newPassword || body.newPassword.length < 8) fail(422, 'Password baru minimal 8 karakter.');
  db.credentials[username] = body.newPassword;
  persist();
  return { message: 'Password changed' };
}

const OPEN = ['pending', 'in_progress'];

function h_addMaintenance(body) {
  const asset = db.inventory.find((i) => i.id === Number(body.asset_id));
  if (!asset) fail(404, 'Aset tidak ditemukan.');
  if (db.maintenanceHistory.some((m) => m.asset_id === asset.id && OPEN.includes(m.status))) fail(409, 'Perawatan untuk aset ini sudah dijadwalkan.');
  const planned = new Date(); planned.setHours(0, 0, 0, 0);
  if (asset.condition_status !== 'Rusak') planned.setDate(planned.getDate() + 7);
  const log = {
    id: Date.now(), asset_id: asset.id, asset_name: asset.name, room_id: asset.room_id,
    activity: body.activity || 'Servis Terjadwal', technician: null, notes: null, status: 'pending',
    performed_at: new Date().toISOString(), scheduled_date: planned.toISOString(), completed_at: null,
  };
  db.maintenanceHistory.unshift(log);
  persist();
  return log;
}

function h_updateMaintenance(id, body) {
  const log = db.maintenanceHistory.find((m) => String(m.id) === String(id));
  if (!log) fail(404, 'Pekerjaan perawatan tidak ditemukan.');
  if (!OPEN.includes(log.status)) fail(409, 'Pekerjaan perawatan ini sudah ditutup.');
  ['activity', 'technician', 'notes'].forEach((k) => { if (body[k] !== undefined) log[k] = body[k] || (k === 'activity' ? log.activity : null); });
  if (body.scheduled_date !== undefined) log.scheduled_date = body.scheduled_date ? new Date(body.scheduled_date).toISOString() : null;
  if (body.status) {
    if (!['pending', 'in_progress', 'done', 'cancelled'].includes(body.status)) fail(422, 'Status tidak valid.');
    log.status = body.status;
    if (body.status === 'done') {
      log.completed_at = new Date().toISOString();
      const asset = db.inventory.find((i) => i.id === log.asset_id);
      if (asset) asset.condition_status = ['Baik', 'Ada Yang Rusak', 'Rusak'].includes(body.condition_after) ? body.condition_after : 'Baik';
    }
  }
  persist();
  return log;
}

function h_deleteMaintenance(id) {
  const i = db.maintenanceHistory.findIndex((m) => String(m.id) === String(id));
  if (i < 0) fail(404, 'Pekerjaan perawatan tidak ditemukan.');
  db.maintenanceHistory.splice(i, 1);
  persist();
  return { success: true };
}

function h_login(body) {
  const { username, password } = body;
  const user = db.users.find((u) => u.username === username || u.email === username);
  if (!user || db.credentials[user.username] !== password) fail(401, 'Username atau password salah.');
  return { token: `mock-token-${user.id}-${Date.now()}`, user };
}

function h_register(body) {
  const { name, nip, email, username, password } = body;
  if (!name || !email || !username || !password) fail(400, 'Lengkapi semua data pendaftaran.');
  if (db.users.some((u) => u.username === username || u.email === email)) fail(409, 'Username atau email sudah terdaftar.');
  const user = { id: db.nextIds.user++, name, username, email, role: 'staff', initials: initials(name), phone: null, nip: nip || null };
  db.users.push(user);
  db.credentials[username] = password;
  persist();
  return { message: 'Akun berhasil dibuat. Silakan login.' };
}

function h_forgot(body) {
  if (!body.email) fail(400, 'Masukkan email terdaftar.');
  return { message: 'Kode reset password dikirim ke email Anda. (mode demo — kode apa pun diterima)' };
}

function h_updateRoom(id, body) {
  const room = db.rooms.find((r) => r.id === id);
  if (!room) fail(404, 'Ruangan tidak ditemukan.');
  Object.assign(room, body);
  persist();
  return rc(room);
}
function h_addRoom(body) {
  if (!body.id || !body.name) fail(400, 'Isi nama & ID ruangan!');
  if (db.rooms.some((r) => r.id === body.id)) fail(409, 'ID ruangan sudah dipakai.');
  const room = { status: 'free', course: '-', supervisor: '-', start_time: '-', end_time: '-', temperature: 25, humidity: 55, ...body, room_code: body.id };
  db.rooms.push(room);
  persist();
  return rc(room);
}

const toMin = (t) => { const [h, m] = String(t || '0:0').split(':'); return Number(h) * 60 + Number(m); };

// Sama seperti backend: ruangan + hari sama dan rentang waktu saling tumpang tindih = bentrok.
function assertNoConflict(next, excludeId = null) {
  if (toMin(next.start_time) >= toMin(next.end_time)) fail(400, 'Waktu selesai harus lebih besar dari waktu mulai.');
  const c = db.schedules.find((s) =>
    s.id !== excludeId && String(s.room_id) === String(next.room_id) && s.day === next.day &&
    toMin(next.start_time) < toMin(s.end_time) && toMin(next.end_time) > toMin(s.start_time));
  if (c) fail(409, `Jadwal bentrok! Ruangan ${c.room_id} sudah dipakai "${c.course}" pada ${c.day} ${c.start_time}–${c.end_time}.`);
}

function h_addSchedule(body) {
  if (!body.room_id || !body.course) fail(400, 'Lengkapi semua data jadwal.');
  assertNoConflict(body);
  const sched = { id: db.nextIds.schedule++, supervisor: '—', status: 'upcoming', ...body };
  db.schedules.push(sched);
  persist();
  return rc(sched);
}
function h_updateSchedule(id, body) {
  const sched = db.schedules.find((s) => s.id === id);
  if (!sched) fail(404, 'Jadwal tidak ditemukan.');
  assertNoConflict({ ...sched, ...body }, sched.id);
  Object.assign(sched, body);
  persist();
  return rc(sched);
}

function h_addDevice(body) {
  if (!body.room_id || !body.name) fail(400, 'Isi nama & ruangan perangkat!');
  const device = { id: db.nextIds.device++, type: 'Lainnya', is_on: false, power_watt: 0, auto_mode: true, ...body };
  db.devices.push(device);
  persist();
  return rc(device);
}
function h_updateDevice(id, body) {
  const device = db.devices.find((d) => d.id === id);
  if (!device) fail(404, 'Perangkat tidak ditemukan.');
  Object.assign(device, body);
  persist();
  return rc(device);
}
function h_toggleDevice(id, on) {
  const device = db.devices.find((d) => d.id === id);
  if (!device) fail(404, 'Perangkat tidak ditemukan.');
  device.is_on = !!on;
  device.power_watt = on ? (device.type === 'AC' ? 850 : device.type === 'Proyektor' ? 300 : 160) : 0;
  persist();
  return { ...rc(device), mqtt_published: true };
}

function h_addInventory(body) {
  if (!body.name || !body.room_id) fail(400, 'Isi nama & ruangan aset!');
  const qr_code = `SB-2025-${String(db.inventory.length + 1).padStart(3, '0')}`;
  const item = { id: db.nextIds.inventory++, qty: 1, condition_status: 'Baik', note: null, ...body, qr_code };
  db.inventory.push(item);
  persist();
  return rc(item);
}
function h_updateInventory(id, body) {
  const item = db.inventory.find((i) => i.id === id);
  if (!item) fail(404, 'Aset tidak ditemukan.');
  Object.assign(item, body);
  persist();
  return rc(item);
}

function h_addUser(body) {
  const { name, email, username, password, role } = body;
  if (!name || !email || !username || !password) fail(400, 'Lengkapi semua data pengguna.');
  const user = { id: db.nextIds.user++, name, username, email, role: role === 'admin' ? 'admin' : 'staff', initials: initials(name), phone: null, nip: null };
  db.users.push(user);
  db.credentials[username] = password;
  persist();
  return user;
}
function h_updateUser(id, body) {
  const user = db.users.find((u) => u.id === id);
  if (!user) fail(404, 'Pengguna tidak ditemukan.');
  const { password, ...rest } = body;
  Object.assign(user, rest, { initials: rest.name ? initials(rest.name) : user.initials });
  if (password) db.credentials[user.username] = password;
  persist();
  return user;
}

function h_timeline(period) {
  let labels;
  if (period === 'weekly') labels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  else if (period === 'monthly') labels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  else if (period === 'yearly') labels = ['2022', '2023', '2024', '2025', '2026'];
  else labels = HOURLY_PATTERN.map((_, i) => String(i).padStart(2, '0'));
  const vals = labels.map(() => 0);
  return { period, labels, vals, unit: 'kWh', tarif: db.tarif };
}

const ROUTES = [
  [/^POST \/auth\/login$/, (m, body) => h_login(body)],
  [/^POST \/auth\/register$/, (m, body) => h_register(body)],
  [/^POST \/auth\/forgot$/, (m, body) => h_forgot(body)],
  [/^POST \/auth\/verify-otp$/, (m, body) => h_verifyOtp(body)],
  [/^POST \/auth\/resend-otp$/, () => ({ message: 'Kode verifikasi baru dikirim (mode demo).' })],
  [/^POST \/alerts\/test-email$/, () => ({ to: '(mode demo, tidak ada email sungguhan yang dikirim)' })],
  [/^POST \/auth\/verify-reset-otp$/, (m, body) => h_verifyResetOtp(body)],
  [/^POST \/auth\/reset-password$/, (m, body) => h_resetPassword(body)],
  [/^POST \/auth\/change-password$/, (m, body) => h_changePassword(body)],

  [/^GET \/rooms$/, () => rcAll(db.rooms)],
  [/^POST \/rooms$/, (m, body) => h_addRoom(body)],
  [/^PUT \/rooms\/(.+)$/, (m, body) => h_updateRoom(decodeURIComponent(m[1]), body)],
  [/^DELETE \/rooms\/(.+)$/, (m) => { db.rooms = db.rooms.filter((r) => r.id !== decodeURIComponent(m[1])); persist(); return { ok: true }; }],

  [/^GET \/schedules$/, () => rcAll(db.schedules)],
  [/^POST \/schedules$/, (m, body) => h_addSchedule(body)],
  [/^PUT \/schedules\/(\d+)$/, (m, body) => h_updateSchedule(Number(m[1]), body)],
  [/^DELETE \/schedules\/(\d+)$/, (m) => { db.schedules = db.schedules.filter((s) => s.id !== Number(m[1])); persist(); return { ok: true }; }],

  [/^GET \/devices$/, () => rcAll(db.devices)],
  [/^POST \/devices$/, (m, body) => h_addDevice(body)],
  [/^PUT \/devices\/(\d+)$/, (m, body) => h_updateDevice(Number(m[1]), body)],
  [/^PATCH \/devices\/(\d+)\/toggle$/, (m, body) => h_toggleDevice(Number(m[1]), body.on)],
  [/^PATCH \/devices\/(\d+)\/auto$/, (m, body) => { const d = db.devices.find((x) => x.id === Number(m[1])); if (!d) fail(404, 'Perangkat tidak ditemukan.'); d.auto_mode = !!body.auto; persist(); return rc(d); }],
  [/^DELETE \/devices\/(\d+)$/, (m) => { db.devices = db.devices.filter((d) => d.id !== Number(m[1])); persist(); return { ok: true }; }],

  [/^GET \/inventory\/health$/, () => db.assetHealth],
  [/^GET \/inventory\/scan\/(.+)$/, (m) => { const item = db.inventory.find((i) => i.qr_code === decodeURIComponent(m[1])); if (!item) fail(404, 'Aset dengan kode tersebut tidak ditemukan.'); return item; }],
  [/^GET \/inventory$/, () => rcAll(db.inventory)],
  [/^POST \/inventory$/, (m, body) => h_addInventory(body)],
  [/^PUT \/inventory\/(\d+)$/, (m, body) => h_updateInventory(Number(m[1]), body)],
  [/^DELETE \/inventory\/(\d+)$/, (m) => { db.inventory = db.inventory.filter((i) => i.id !== Number(m[1])); persist(); return { ok: true }; }],

  [/^GET \/alerts$/, () => db.alerts],
  [/^PATCH \/alerts\/read-all$/, () => { db.alerts.forEach((a) => { a.is_read = true; }); persist(); return { ok: true }; }],
  [/^PATCH \/alerts\/(\d+)\/read$/, (m) => { const a = db.alerts.find((x) => x.id === Number(m[1])); if (a) a.is_read = true; persist(); return { ok: true }; }],

  [/^GET \/users$/, () => db.users],
  [/^POST \/users$/, (m, body) => h_addUser(body)],
  [/^PUT \/users\/(\d+)$/, (m, body) => h_updateUser(Number(m[1]), body)],
  [/^DELETE \/users\/(\d+)$/, (m) => { db.users = db.users.filter((u) => u.id !== Number(m[1])); persist(); return { ok: true }; }],

  [/^GET \/energy\/timeline$/, (m, body, config) => h_timeline(config?.params?.period || 'daily')],
  [/^GET \/energy\/today-summary$/, () => ({ todayKwh: 0, yesterdayKwh: 0, monthKwh: 0, efficiencyPct: 0, biayaToday: 0, biayaMonthEstimate: 0, tarif: db.tarif })],
  [/^GET \/energy\/per-room$/, () => db.rooms.map((r) => ({ room_id: r.id, total: 0 }))],

  [/^GET \/reports\/maintenance-history$/, () => db.maintenanceHistory],
  [/^POST \/reports\/maintenance$/, (m, body) => h_addMaintenance(body)],
  [/^PATCH \/reports\/maintenance\/(.+)$/, (m, body) => h_updateMaintenance(m[1], body)],
  [/^DELETE \/reports\/maintenance\/(.+)$/, (m) => h_deleteMaintenance(m[1])],
  [/^GET \/reports\/alert-summary$/, () => {
    const s = { danger: 0, warn: 0, info: 0, success: 0 };
    db.alerts.forEach((a) => { s[a.type] = (s[a.type] || 0) + 1; });
    return s;
  }],
];

function matchRoute(method, url) {
  const key = `${method} ${url}`;
  for (const [pattern, handler] of ROUTES) {
    const m = key.match(pattern);
    if (m) return { m, handler };
  }
  return null;
}

async function request(method, url, body, config) { // eslint-disable-line
  const found = matchRoute(method, url);
  if (!found) {
    console.warn(`[mock-api] Tidak ada handler untuk ${method} ${url}`);
    return wait({ data: null });
  }
  try {
    const data = found.handler(found.m, body || {}, config);
    return wait({ data });
  } catch (err) {
    await wait(null);
    throw err;
  }
}

const mockApi = {
  get: (url, config) => request('GET', url, null, config),
  post: (url, body, config) => request('POST', url, body, config),
  put: (url, body, config) => request('PUT', url, body, config),
  patch: (url, body, config) => request('PATCH', url, body, config),
  delete: (url, config) => request('DELETE', url, null, config),
};

export default mockApi;
