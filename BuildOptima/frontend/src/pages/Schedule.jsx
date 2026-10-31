import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const STATUS_MAP = { done: { cls: 'bg-blue', lb: 'Selesai' }, ongoing: { cls: 'bg-green', lb: 'Berlangsung' }, upcoming: { cls: 'bg-amber', lb: 'Mendatang' } };
const emptyForm = { room_id: '', course: '', supervisor: '', day: 'Kamis', start_time: '08:00', end_time: '10:00' };

export default function Schedule() {
  const { isAdmin } = useAuth();
  const { schedules, rooms, addSchedule, updateSchedule, deleteSchedule } = useData();
  const showToast = useToast();
  const [dayFilter, setDayFilter] = useState(''); // '' = Semua Hari
  const [roomFilter, setRoomFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [conflict, setConflict] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => schedules.filter((s) => (!dayFilter || s.day === dayFilter) && (!roomFilter || String(s.room_id) === String(roomFilter))),
    [schedules, dayFilter, roomFilter]
  );

  // peringatan hilang otomatis begitu ruangan / hari / jam diubah
  useEffect(() => { setConflict(''); }, [form.room_id, form.day, form.start_time, form.end_time]);

  function openAdd() { setEditing(null); setForm({ ...emptyForm, room_id: rooms[0]?.id || '' }); setModalOpen(true); }
  function openEdit(s) { setEditing(s); setForm({ room_id: s.room_id, course: s.course, supervisor: s.supervisor, day: s.day, start_time: s.start_time, end_time: s.end_time }); setModalOpen(true); }

  async function save() {
    if (saving) return; // cegah klik ganda / submit dobel
    if (!form.course.trim()) { showToast('Isi nama mata kuliah!', 'danger'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateSchedule(editing.id, form);
        showToast('Jadwal diperbarui!', 'success');
      } else {
        await addSchedule(form);
        showToast('Jadwal ditambahkan!', 'success');
      }
      setModalOpen(false);
    } catch (err) {
      const msg = err.response?.data?.error || 'Gagal menyimpan jadwal.';
      if (err.response?.status === 409) setConflict(msg); // tampil di dalam modal
      else showToast(msg, 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function remove(s) {
    if (!confirm(`Hapus jadwal "${s.course}"?`)) return;
    await deleteSchedule(s.id);
    showToast('Jadwal dihapus.', 'success');
  }

  return (
    <>
      <div className="sec-hdr">
        <div className="sec-title">Jadwal</div>
        {isAdmin && <button className="btn btn-primary" style={{ width: 'auto', padding: '7px 13px', fontSize: '.79rem' }} onClick={openAdd}>+ Tambah Jadwal</button>}
      </div>
      <div className="sched-filters">
        <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
          <option value="">Semua Hari</option>
          {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
          <option value="">Semua Ruangan</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_code}</option>)}
        </select>
        <span style={{ fontSize: '.79rem', color: 'var(--gray-500)' }}>{filtered.length} jadwal</span>
      </div>
      <div className="card">
        <div className="sched-list">
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--gray-400)', fontSize: '.83rem' }}>Tidak ada jadwal untuk filter ini.</div>}
          {filtered.map((s) => (
            <div className="sched-item" key={s.id}>
              <div className="sched-time">{s.start_time}–{s.end_time}</div>
              <div className="sched-info">
                <div className="sched-name">{s.course}</div>
                <div className="sched-room">{s.room_code} · {s.supervisor} · {s.day}</div>
              </div>
              <span className={`badge ${STATUS_MAP[s.status].cls}`}>{STATUS_MAP[s.status].lb}</span>
              {isAdmin && (
                <div className="sched-actions">
                  <button className="btn-sm btn-outline" onClick={() => openEdit(s)}>Edit</button>
                  <button className="btn-sm btn-danger" onClick={() => remove(s)}>Hapus</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Edit Jadwal' : 'Tambah Jadwal'}
        actions={<>
          <button className="btn-sm btn-outline" disabled={saving} onClick={() => setModalOpen(false)}>Batal</button>
          <button className="btn-sm btn-success" disabled={saving} onClick={save}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </>}
      >
        {conflict && (
          <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 12px', fontSize: '.8rem', marginBottom: 12 }}>
            ⚠️ {conflict}
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Mata Kuliah / Acara</label>
          <input className="form-input" type="text" placeholder="Jaringan Komputer" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
        </div>
        <div className="modal-grid" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <label className="form-label">Ruangan</label>
            <select className="form-input" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_code}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Hari</label>
            <select className="form-input" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label className="form-label">Penanggung Jawab</label><input className="form-input" type="text" placeholder="Dr. Budi Santoso" value={form.supervisor} onChange={(e) => setForm({ ...form, supervisor: e.target.value })} /></div>
        <div className="modal-grid" style={{ marginBottom: 0 }}>
          <div className="form-group"><label className="form-label">Waktu Mulai</label><input className="form-input" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Waktu Selesai</label><input className="form-input" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
        </div>
      </Modal>
    </>
  );
}
