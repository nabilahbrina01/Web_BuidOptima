import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { useData } from '../context/DataContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const emptyForm = { name: '', email: '', username: '', password: '', role: 'staff' };

export default function Users() {
  const { users, addUser, updateUser, deleteUser } = useData();
  const showToast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const admins = users.filter((u) => u.role === 'admin');
  const staff = users.filter((u) => u.role === 'staff');

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(u) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, username: u.username, password: '', role: u.role });
    setModalOpen(true);
  }

  async function save() {
    if (saving) return; // cegah klik ganda / submit dobel
    if (!form.name.trim() || !form.email.trim() || !form.username.trim()) {
      showToast('Lengkapi semua data pengguna!', 'danger'); return;
    }
    if (!editing && !form.password.trim()) {
      showToast('Isi password awal untuk pengguna baru!', 'danger'); return;
    }
    setSaving(true);
    try {
      if (editing) {
        const body = { name: form.name, email: form.email, role: form.role };
        if (form.password.trim()) body.password = form.password.trim();
        await updateUser(editing.id, body);
        showToast('Pengguna berhasil diperbarui!', 'success');
      } else {
        await addUser(form);
        showToast('Pengguna berhasil ditambahkan!', 'success');
      }
      setModalOpen(false);
      setForm(emptyForm);
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menyimpan pengguna.', 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function remove(u) {
    if (!confirm(`Hapus ${u.name}?`)) return;
    await deleteUser(u.id);
    showToast(`${u.name} dihapus.`, 'success');
  }

  function UserList({ list, cls }) {
    return (
      <div className="user-list">
        {list.map((u) => (
          <div className="user-item" key={u.id}>
            <div className={`user-av ${cls}`} style={{ overflow: 'hidden' }}>
              {u.photo ? <img src={u.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : u.initials}
            </div>
            <div className="user-info"><h4>{u.name}</h4><p>{u.email}</p></div>
            <div className="user-actions">
              <button className="btn-sm btn-outline" onClick={() => openEdit(u)}>Edit</button>
              <button className="btn-sm btn-danger" onClick={() => remove(u)}>Hapus</button>
            </div>
          </div>
        ))}
        {list.length === 0 && <div style={{ padding: 14, color: 'var(--gray-400)', fontSize: '.8rem' }}>Belum ada pengguna.</div>}
      </div>
    );
  }

  return (
    <>
      <div className="sec-hdr"><div className="sec-title">Manajemen Pengguna</div><button className="btn btn-primary" style={{ width: 'auto', padding: '7px 13px', fontSize: '.79rem' }} onClick={openAdd}>+ Tambah User</button></div>
      <div className="card"><div className="sec-hdr" style={{ marginBottom: 10 }}><div className="sec-title" style={{ fontSize: '.81rem' }}>Administrator</div></div><UserList list={admins} cls="ua-blue" /></div>
      <div className="card"><div className="sec-hdr" style={{ marginBottom: 10 }}><div className="sec-title" style={{ fontSize: '.81rem' }}>Staff / Teknisi</div></div><UserList list={staff} cls="ua-green" /></div>

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? `Edit Pengguna — ${editing.name}` : 'Tambah Pengguna'}
        actions={<>
          <button className="btn-sm btn-outline" disabled={saving} onClick={() => setModalOpen(false)}>Batal</button>
          <button className="btn-sm btn-success" disabled={saving} onClick={save}>{saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Buat Akun'}</button>
        </>}>
        <div className="input-row" style={{ marginBottom: 11 }}>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">Nama Lengkap</label><input className="form-input" type="text" placeholder="Nama Pengguna" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Peran</label>
            <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Administrator</option>
              <option value="staff">Staff / Teknisi</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="user@undip.ac.id" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="modal-grid" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" type="text" placeholder="username" value={form.username} disabled={!!editing} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{editing ? 'Password Baru (opsional)' : 'Password Awal'}</label>
            <input className="form-input" type="password" placeholder={editing ? 'Kosongkan jika tidak diubah' : '••••••••'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
        </div>
      </Modal>
    </>
  );
}
