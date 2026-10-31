const STORAGE_KEY = 'bo_mock_db_v2';

const seedUsers = [
  { id: 1, name: 'Administrator', username: 'admin', email: 'admin@undip.ac.id', role: 'admin', initials: 'AD', phone: null, nip: null },
  { id: 2, name: 'Staff Teknisi', username: 'staff', email: 'staff@undip.ac.id', role: 'staff', initials: 'ST', phone: null, nip: null },
];

const seedCredentials = { admin: '12345678', staff: '12345678' };

const HOURLY_PATTERN = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function defaultDb() {
  return {
    rooms: [],
    schedules: [],
    devices: [],
    inventory: [],
    assetHealth: [],
    alerts: [],
    users: seedUsers,
    credentials: seedCredentials,
    maintenanceHistory: [],
    nextIds: { schedule: 1, device: 1, inventory: 1, user: 3 },
    tarif: 1877,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore corrupted storage */ }
  const fresh = defaultDb();
  save(fresh);
  return fresh;
}

function save(db) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* storage full/unavailable */ }
}

export const db = load();
export function persist() { save(db); }
export function resetMockDb() { const fresh = defaultDb(); Object.assign(db, fresh); save(db); }
export { HOURLY_PATTERN };
