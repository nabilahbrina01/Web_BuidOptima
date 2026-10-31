import { useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const emptyForm = { room_id: '', name: '', type: 'AC', power_watt: 0 };

export default function Devices() {
  const { isAdmin } = useAuth();
  const { devices, rooms, toggleDevice, setDeviceAuto, addDevice, updateDevice, deleteDevice, mqttConnected } = useData();
  const showToast = useToast();
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState({});
  const [saving, setSaving] = useState(false);

  const roomById = useMemo(() => Object.fromEntries(rooms.map((r) => [String(r.id), r])), [rooms]);
  const roomFloor = useMemo(() => Object.fromEntries(rooms.map((r) => [r.id, r.floor])), [rooms]);

  const filtered = devices.filter((d) => {
    const matchesSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || (d.room_code || '').toLowerCase().includes(search.toLowerCase()) || (roomById[String(d.room_id)]?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesFloor = floorFilter === 'all' || String(roomFloor[d.room_id]) === floorFilter;
    return matchesSearch && matchesFloor;
  });

  async function handleToggle(d, on) {
    setBusy((b) => ({ ...b, [d.id]: true }));
    try {
      await toggleDevice(d.id, on);
      showToast(`${d.name} berhasil ${on ? 'dinyalakan' : 'dimatikan'} via MQTT.`, 'success');
    } catch {
      showToast(`Gagal mengendalikan ${d.name}. Periksa koneksi broker MQTT!`, 'danger');
    } finally {
      setBusy((b) => ({ ...b, [d.id]: false }));
    }
  }

  function openAdd() { setEditing(null); setForm({ ...emptyForm, room_id: rooms[0]?.id || '' }); setModalOpen(true); }
  function openEdit(d) { setEditing(d); setForm({ room_id: d.room_id ?? rooms[0]?.id ?? '', name: d.name, type: d.type, power_watt: d.power_watt }); setModalOpen(true); }

  async function save() {
    if (saving) return; // cegah klik ganda / submit dobel
    if (!form.name.trim()) { showToast('Isi nama perangkat!', 'danger'); return; }
    if (!form.room_id) { showToast('Pilih ruangan terlebih dahulu! (tambahkan ruangan jika belum ada)', 'danger'); return; }
    setSaving(true);
    try {
      if (editing) { await updateDevice(editing.id, form); showToast('Perangkat diperbarui!', 'success'); }
      else { await addDevice(form); showToast('Perangkat ditambahkan!', 'success'); }
      setModalOpen(false);
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menyimpan perangkat.', 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function remove(d) {
    if (!confirm(`Hapus perangkat "${d.name}"?`)) return;
    await deleteDevice(d.id);
    showToast('Perangkat dihapus.', 'success');
  }

  return (
    <>
      <div className="sec-hdr" style={{ display: 'flex', flexDirection: 'column', gap: 15, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div className="sec-title" style={{ margin: 0 }}>
            Kontrol Perangkat Listrik{' '}
            <span style={{ fontSize: '.68rem', fontWeight: 600, color: mqttConnected ? '#10b981' : '#ef4444' }}>
              ({mqttConnected ? 'MQTT tersambung' : 'MQTT terputus'})
            </span>
          </div>
          {isAdmin && <button className="btn btn-primary" style={{ width: 'auto', padding: '7px 13px', fontSize: '.79rem' }} onClick={openAdd}>+ Tambah Perangkat</button>}
        </div>
        <div className="filter-controls" style={{ display: 'flex', gap: 10, width: '100%', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <input type="text" placeholder="Cari perangkat atau ruangan..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: '.85rem' }} />
          </div>
          <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, fontSize: '.85rem', minWidth: 130, cursor: 'pointer' }}>
            <option value="all">Semua Lantai</option>
            {[...new Set(rooms.map((r) => r.floor))].sort().map((f) => <option key={f} value={f}>Lantai {f}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Ruangan</th><th>Perangkat</th><th>Status</th><th>Daya</th><th>Auto</th><th>Kontrol</th>{isAdmin && <th>Aksi</th>}</tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{roomById[String(d.room_id)]?.name || d.room_name || d.room_code || '-'}</span>
                    {(roomById[String(d.room_id)]?.room_code || d.room_code) && (
                      <div style={{ fontSize: '.7rem', color: 'var(--gray-400)' }}>{roomById[String(d.room_id)]?.room_code || d.room_code}</div>
                    )}
                  </td>
                  <td>{d.name}</td>
                  <td><span className={`badge ${d.is_on ? 'bg-green' : 'bg-blue'}`}>{d.is_on ? 'Menyala' : 'Mati'}</span></td>
                  <td><span style={{ fontFamily: "'DM Mono'", fontSize: '.79rem' }}>{d.power_watt} W</span></td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={!!d.auto_mode} onChange={(e) => setDeviceAuto(d.id, e.target.checked)} />
                      <span className="tslider" />
                    </label>
                  </td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={!!d.is_on} disabled={busy[d.id]} onChange={(e) => handleToggle(d, e.target.checked)} />
                      <span className="tslider" />
                    </label>
                  </td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button className="btn-sm btn-outline" onClick={() => openEdit(d)}>Edit</button>
                        <button className="btn-sm btn-danger" onClick={() => remove(d)}>Hapus</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', padding: 20, color: 'var(--gray-400)' }}>Tidak ada perangkat ditemukan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Edit Perangkat' : 'Tambah Perangkat Listrik'}
        actions={<>
          <button className="btn-sm btn-outline" disabled={saving} onClick={() => setModalOpen(false)}>Batal</button>
          <button className="btn-sm btn-success" disabled={saving} onClick={save}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </>}
      >
        <div className="form-group"><label className="form-label">Nama Perangkat</label><input className="form-input" type="text" placeholder="AC Split 1 PK" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="modal-grid" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <label className="form-label">Ruangan</label>
            <select className="form-input" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_code || r.id}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Jenis</label>
            <select className="form-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option>AC</option><option>Lampu</option><option>Proyektor</option><option>Lainnya</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label className="form-label">Daya (Watt)</label><input className="form-input" type="number" placeholder="850" value={form.power_watt} onChange={(e) => setForm({ ...form, power_watt: e.target.value })} /></div>
      </Modal>
    </>
  );
}
