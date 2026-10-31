import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/client.js';
import useRealtime from '../ws/useRealtime.js';
import { useAuth } from './AuthContext.jsx';

const DataContext = createContext(null);

// Notifikasi browser (Notification API) untuk peringatan baru. Hanya bekerja selama aplikasi terbuka di browser.
// Syarat: preferensi "Notifikasi Push" aktif di Pengaturan + izin browser sudah diberikan.
function showBrowserNotification(n, enabled) {
  if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!['danger', 'warn'].includes(n.type)) return; // hanya peringatan penting
  try { new Notification(n.title, { body: n.summary || n.message, tag: `bo-${n.id}` }); } catch { /* browser menolak */ }
}

export function DataProvider({ children }) {
  const { token, user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [devices, setDevices] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [assetHealth, setAssetHealth] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [energySummary, setEnergySummary] = useState(null);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const lastEnergyRefresh = useRef(0);

  const loadAll = useCallback(async () => {
    const [r, s, d, i, h, a, u, es] = await Promise.all([
      api.get('/rooms'),
      api.get('/schedules'),
      api.get('/devices'),
      api.get('/inventory'),
      api.get('/inventory/health'),
      api.get('/alerts'),
      api.get('/users'),
      api.get('/energy/today-summary'),
    ]);
    setRooms(r.data);
    setSchedules(s.data);
    setDevices(d.data);
    setInventory(i.data);
    setAssetHealth(h.data);
    setAlerts(a.data);
    setUsers(u.data);
    setEnergySummary(es.data);
    setLoaded(true);
  }, []);

  // Muat ulang daftar aset + hasil analisis AI (dipanggil setelah jadwal/perubahan status perawatan)
  const refreshInventory = useCallback(async () => {
    const [i, h] = await Promise.all([api.get('/inventory'), api.get('/inventory/health')]);
    setInventory(i.data);
    setAssetHealth(h.data);
  }, []);

  useEffect(() => {
    if (token) loadAll().catch(console.error);
    else setLoaded(false);
  }, [token, loadAll]);

  // Event di sini HARUS sama dengan yang di-emit backend (server/config/constants.js → SOCKET_EVENTS).
  useRealtime((event, payload) => {
    switch (event) {
      case 'mqtt-status':
        setMqttConnected(!!payload?.connected);
        break;

      case 'notification:new':
        setAlerts((prev) => {
          if (prev.some((a) => a.id === payload.id)) return prev;
          showBrowserNotification(payload, user?.notif_push !== false);
          return [payload, ...prev];
        });
        break;

      case 'room:occupancy':
        setRooms((prev) => prev.map((r) => (
          Number(r.id) === Number(payload.room_id)
            // aktif = terdeteksi sensor ATAU sedang ada jadwal berlangsung (sama seperti backend)
            ? { ...r, occupancy_status: payload.status, status: (payload.status === 'occupied' || (r.course && r.course !== '-')) ? 'used' : 'free' }
            : r
        )));
        break;

      case 'sensor:data': {
        if (payload.room_id == null) break;
        const key = payload.sensor_type === 'dht22_temp' ? 'temperature' : payload.sensor_type === 'dht22_hum' ? 'humidity' : null;
        if (!key) break;
        setRooms((prev) => prev.map((r) => (Number(r.id) === Number(payload.room_id) ? { ...r, [key]: Number(payload.value) } : r)));
        break;
      }

      case 'device:update':
      case 'device:status':
        // Relay berubah (mis. auto-off saat ruangan kosong) / perangkat online-offline → ambil ulang daftar perangkat
        api.get('/devices').then((res) => setDevices(res.data)).catch(() => {});
        break;

      case 'energy:data': {
        // Data PZEM datang tiap beberapa detik per ruangan; batasi refresh ringkasan maksimal 1× / 5 detik
        const now = Date.now();
        if (now - lastEnergyRefresh.current > 5000) {
          lastEnergyRefresh.current = now;
          api.get('/energy/today-summary').then((res) => setEnergySummary(res.data)).catch(() => {});
        }
        break;
      }

      default:
        break;
    }
  });

  const actions = {
    async addRoom(body) { const { data } = await api.post('/rooms', body); setRooms((p) => [...p, data]); return data; },
    async updateRoom(id, body) { const { data } = await api.put(`/rooms/${id}`, body); setRooms((p) => p.map((r) => (r.id === id ? data : r))); return data; },
    async deleteRoom(id) { await api.delete(`/rooms/${id}`); setRooms((p) => p.filter((r) => r.id !== id)); },

    async addSchedule(body) { const { data } = await api.post('/schedules', body); setSchedules((p) => [...p, data]); return data; },
    async updateSchedule(id, body) { const { data } = await api.put(`/schedules/${id}`, body); setSchedules((p) => p.map((s) => (s.id === id ? data : s))); return data; },
    async deleteSchedule(id) { await api.delete(`/schedules/${id}`); setSchedules((p) => p.filter((s) => s.id !== id)); },

    async toggleDevice(id, on) { const { data } = await api.patch(`/devices/${id}/toggle`, { on }); setDevices((p) => p.map((d) => (d.id === id ? data : d))); return data; },
    async setDeviceAuto(id, auto) { const { data } = await api.patch(`/devices/${id}/auto`, { auto }); setDevices((p) => p.map((d) => (d.id === id ? data : d))); return data; },
    async addDevice(body) { const { data } = await api.post('/devices', body); setDevices((p) => [...p, data]); return data; },
    async updateDevice(id, body) { const { data } = await api.put(`/devices/${id}`, body); setDevices((p) => p.map((d) => (d.id === id ? data : d))); return data; },
    async deleteDevice(id) { await api.delete(`/devices/${id}`); setDevices((p) => p.filter((d) => d.id !== id)); },

    async addInventory(body) { const { data } = await api.post('/inventory', body); setInventory((p) => [...p, data]); return data; },
    async updateInventory(id, body) { const { data } = await api.put(`/inventory/${id}`, body); setInventory((p) => p.map((i) => (i.id === id ? data : i))); return data; },
    async deleteInventory(id) { await api.delete(`/inventory/${id}`); setInventory((p) => p.filter((i) => i.id !== id)); },
    async scanInventory(code) { const { data } = await api.get(`/inventory/scan/${encodeURIComponent(code)}`); return data; },
    async scheduleMaintenance(assetId, activity) {
      const { data } = await api.post('/reports/maintenance', { asset_id: assetId, activity });
      await refreshInventory().catch(() => {}); // tombol di panel AI langsung berubah jadi "Terjadwal"
      return data;
    },
    refreshInventory,
    async sendTestEmail(kind) { const { data } = await api.post('/alerts/test-email', { kind }); return data; },

    async markAlertRead(id) { await api.patch(`/alerts/${id}/read`); setAlerts((p) => p.map((a) => (a.id === id ? { ...a, is_read: true } : a))); },
    async markAllAlertsRead() { await api.patch('/alerts/read-all'); setAlerts((p) => p.map((a) => ({ ...a, is_read: true }))); },

    async addUser(body) { const { data } = await api.post('/users', body); setUsers((p) => [...p, data]); return data; },
    async updateUser(id, body) { const { data } = await api.put(`/users/${id}`, body); setUsers((p) => p.map((u) => (u.id === id ? data : u))); return data; },
    async deleteUser(id) { await api.delete(`/users/${id}`); setUsers((p) => p.filter((u) => u.id !== id)); },

    async fetchTimeline(period, room) {
      const { data } = await api.get('/energy/timeline', { params: { period, roomId: room } });
      return data;
    },
    async refreshEnergySummary() {
      const { data } = await api.get('/energy/today-summary');
      setEnergySummary(data);
      return data;
    },
    reload: loadAll,
  };

  return (
    <DataContext.Provider
      value={{ rooms, schedules, devices, inventory, assetHealth, alerts, users, energySummary, mqttConnected, loaded, ...actions }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
