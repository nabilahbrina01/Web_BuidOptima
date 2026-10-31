import { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import RoomDetailModal from './RoomDetailModal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useData } from '../../context/DataContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

function sdot(s) { return s === 'used' ? 'dot-g' : s === 'maint' ? 'dot-r' : 'dot-gr'; }
function slabel(s) { return s === 'maint' ? 'Perawatan' : s === 'free' ? 'Tidak Terisi' : 'Terisi'; }

const emptyForm = { id: '', name: '', capacity: 40, floor: 1 };

export default function Rooms() {
  const { isAdmin } = useAuth();
  const { rooms, addRoom, updateRoom, deleteRoom } = useData();
  const showToast = useToast();
  const [floorFilter, setFloorFilter] = useState('all');
  const [detailRoom, setDetailRoom] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const filtered = rooms.filter((r) => floorFilter === 'all' || String(r.floor) === floorFilter);
  const floors = [...new Set(rooms.map((r) => r.floor))].sort();

  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(r) { setEditing(r); setForm({ id: r.id, name: r.name, capacity: r.capacity, floor: r.floor }); setModalOpen(true); }

  async function save() {
    if (saving) return; // cegah klik ganda / submit dobel
    if (!form.name.trim()) { showToast('Isi nama ruangan!', 'danger'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateRoom(editing.id, { name: form.name, capacity: Number(form.capacity) || 40, floor: Number(form.floor) || 1 });
        showToast('Ruangan diperbarui!', 'success');
      } else {
        if (!form.id.trim()) { showToast('Isi ID ruangan, contoh: R.301', 'danger'); setSaving(false); return; }
        await addRoom({ id: form.id.trim(), name: form.name, capacity: Number(form.capacity) || 40, floor: Number(form.floor) || 1 });
        showToast('Ruangan ditambahkan!', 'success');
      }
      setModalOpen(false);
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menyimpan ruangan.', 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function remove(r) {
    if (!confirm(`Hapus ruangan "${r.room_code || r.id} — ${r.name}"?`)) return;
    await deleteRoom(r.id);
    showToast('Ruangan berhasil dihapus.', 'success');
  }

  return (
    <>
      <div className="sec-hdr">
        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select className="form-select" value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} style={{ padding: 5, borderRadius: 5, border: '1px solid #ddd' }}>
            <option value="all">Semua Ruangan</option>
            {floors.map((f) => <option key={f} value={f}>Lantai {f}</option>)}
          </select>
        </div>
        {isAdmin && <button className="btn btn-primary" style={{ width: 'auto', padding: '7px 13px', fontSize: '.79rem' }} onClick={openAdd}>+ Tambah Ruangan</button>}
      </div>

      <div className="room-list">
        {filtered.map((r) => (
          <div className="room-item" key={r.id}>
            <div className={`status-dot ${sdot(r.status)}`} style={{ cursor: 'pointer' }} onClick={() => setDetailRoom(r)} />
            <div className="room-info" style={{ cursor: 'pointer' }} onClick={() => setDetailRoom(r)}>
              <div className="room-name">{r.room_code} — {r.name}</div>
              <div className="room-meta">Lantai {r.floor} · {r.course && r.course !== '-' ? r.course : 'Tidak ada jadwal'} · {slabel(r.status)}</div>
              <div className="room-env"><span className="env-chip">🌡 {r.temperature ?? '–'}°C</span><span className="env-chip">💧 {r.humidity ?? '–'}%</span></div>
            </div>
            {isAdmin && (
              <div className="room-acts">
                <button className="btn-sm btn-outline" onClick={() => openEdit(r)}>Edit</button>
                <button className="btn-sm btn-danger" onClick={() => remove(r)}>Hapus</button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)', fontSize: '.83rem' }}>Belum ada ruangan.</div>}
      </div>

      <RoomDetailModal room={detailRoom} onClose={() => setDetailRoom(null)} />

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Edit Ruangan' : 'Tambah Ruangan'}
        actions={<>
          <button className="btn-sm btn-outline" disabled={saving} onClick={() => setModalOpen(false)}>Batal</button>
          <button className="btn-sm btn-success" disabled={saving} onClick={save}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </>}
      >
        {!editing && (
          <div className="form-group">
            <label className="form-label">ID Ruangan</label>
            <input className="form-input" type="text" placeholder="R.301" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Nama Ruangan</label>
          <input className="form-input" type="text" placeholder="Lab Baru" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="modal-grid" style={{ marginBottom: 0 }}>
          <div className="form-group"><label className="form-label">Lantai</label><input className="form-input" type="number" min="1" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Kapasitas</label><input className="form-input" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
        </div>
      </Modal>
    </>
  );
}
