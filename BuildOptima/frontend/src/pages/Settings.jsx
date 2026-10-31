import { useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { resizeImageFile } from '../utils/image.js';

export default function Settings() {
  const { user, isAdmin, logout, updateProfile, changePassword } = useAuth();
  const { updateUser, sendTestEmail } = useData();
  const showToast = useToast();
  const fileInputRef = useRef(null);
  const [editProfile, setEditProfile] = useState(false);
  const [changePass, setChangePass] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [nip, setNip] = useState(user?.nip || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [pw, setPw] = useState({ old: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  // Preferensi notifikasi tersimpan di server (per akun), bukan lagi hanya di layar
  const [prefs, setPrefs] = useState({ email: user?.notif_email !== false, push: user?.notif_push !== false, daily: !!user?.notif_daily });
  const [testing, setTesting] = useState('');
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  // Simpan ke backend dulu; profil lokal (sidebar, dsb.) hanya diperbarui kalau server menerima.
  async function saveToServer(patch) {
    const saved = await updateUser(user.id, patch);
    updateProfile({ name: saved.name, email: saved.email, nip: saved.nip, phone: saved.phone, initials: saved.initials, photo: saved.photo, notif_email: saved.notif_email, notif_push: saved.notif_push, notif_daily: saved.notif_daily });
    return saved;
  }

  async function saveProfile() {
    if (saving) return;
    if (!name.trim() || !email.trim()) { showToast('Nama dan email wajib diisi!', 'danger'); return; }
    setSaving(true);
    try {
      await saveToServer({ name: name.trim(), email: email.trim(), nip: nip.trim(), phone: phone.trim() });
      setEditProfile(false);
      showToast('Profil berhasil disimpan!', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menyimpan profil.', 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar.', 'danger');
      return;
    }
    try {
      const dataUrl = await resizeImageFile(file);
      await saveToServer({ photo: dataUrl });
      showToast('Foto profil berhasil diperbarui!', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal memproses gambar.', 'danger');
    }
  }

  async function removePhoto() {
    try {
      await saveToServer({ photo: null });
      showToast('Foto profil dihapus.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menghapus foto.', 'danger');
    }
  }

  const PREF_FIELD = { email: 'notif_email', push: 'notif_push', daily: 'notif_daily' };

  // Meminta izin notifikasi browser (harus dipicu klik pengguna)
  async function askPermission() {
    if (typeof Notification === 'undefined') { setPerm('unsupported'); return false; }
    const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    setPerm(result);
    return result === 'granted';
  }

  async function togglePref(key, checked) {
    if (key === 'push' && checked && !(await askPermission())) {
      showToast('Izin notifikasi browser tidak diberikan. Izinkan lewat ikon gembok di address bar browser.', 'danger');
      return;
    }
    setPrefs((p) => ({ ...p, [key]: checked }));
    try {
      await saveToServer({ [PREF_FIELD[key]]: checked });
      showToast('Preferensi notifikasi disimpan.', 'success');
    } catch (err) {
      setPrefs((p) => ({ ...p, [key]: !checked })); // kembalikan bila gagal disimpan
      showToast(err.response?.data?.error || 'Gagal menyimpan preferensi.', 'danger');
    }
  }

  async function sendTest(kind) {
    if (testing) return;
    setTesting(kind);
    try {
      const d = await sendTestEmail(kind);
      showToast(`Email contoh dikirim ke ${d.to}. Cek inbox (dan folder Spam).`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal mengirim email contoh.', 'danger');
    } finally {
      setTesting('');
    }
  }

  async function savePassword() {
    if (!pw.old || !pw.next) { showToast('Isi password lama dan password baru!', 'danger'); return; }
    if (pw.next.length < 8) { showToast('Password baru minimal 8 karakter.', 'danger'); return; }
    if (pw.next !== pw.confirm) { showToast('Konfirmasi password baru tidak cocok.', 'danger'); return; }
    try {
      await changePassword(pw.old, pw.next);
      showToast('Password berhasil diubah.', 'success');
      setPw({ old: '', next: '', confirm: '' });
      setChangePass(false);
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal mengubah password.', 'danger');
    }
  }

  return (
    <>
      <div className="settings-card" style={{ textAlign: 'center', paddingTop: 22 }}>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
        <div className="profile-avatar-lg" style={{ cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
          {user?.photo ? (
            <img src={user.photo} alt="Foto profil" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
          ) : (
            user?.initials
          )}
          <div className="avatar-edit"><Icon name="edit" size={12} stroke="white" strokeWidth={2.5} /></div>
        </div>
        {user?.photo && (
          <button
            className="btn-ghost"
            style={{ fontSize: '.75rem', color: 'var(--red)', marginBottom: 6 }}
            onClick={removePhoto}
          >
            Hapus Foto
          </button>
        )}
        <div style={{ fontSize: '.97rem', fontWeight: 700, color: 'var(--gray-900)' }}>{user?.name}</div>
        <div style={{ fontSize: '.79rem', color: 'var(--gray-500)', marginBottom: 4 }}>{user?.email}</div>
        <span className="badge bg-blue">{isAdmin ? 'Administrator' : 'Staff / Teknisi'}</span>
      </div>

      <div className="settings-card">
        <div className="sec-title" style={{ marginBottom: 13 }}>Profil</div>
        {!editProfile ? (
          <div className="set-confirm-card">
            <div className="set-confirm-info"><h4>Edit Profil</h4><p>Ubah nama, NIP, email, dan nomor telepon Anda.</p></div>
            <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '.82rem' }} onClick={() => setEditProfile(true)}>Edit Profil</button>
          </div>
        ) : (
          <div className="set-form open">
            <div style={{ height: 12 }} />
            <div className="input-row" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">Nama Lengkap</label><input className="form-input" type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">NIP</label><input className="form-input" type="text" value={nip} onChange={(e) => setNip(e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Nomor Telepon</label><input className="form-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveProfile}>Simpan Perubahan</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditProfile(false)}>Batal</button>
            </div>
          </div>
        )}
      </div>

      <div className="settings-card">
        <div className="sec-title" style={{ marginBottom: 13 }}>Keamanan</div>
        {!changePass ? (
          <div className="set-confirm-card">
            <div className="set-confirm-info"><h4>Ubah Password</h4><p>Perbarui kata sandi akun Anda secara berkala.</p></div>
            <button className="btn btn-outline" style={{ width: 'auto', padding: '8px 16px', fontSize: '.82rem', borderWidth: '1.5px' }} onClick={() => setChangePass(true)}>Ubah Password</button>
          </div>
        ) : (
          <div className="set-form open">
            <div style={{ height: 12 }} />
            <div className="form-group"><label className="form-label">Password Lama</label><input className="form-input" type="password" placeholder="••••••••" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Password Baru</label><input className="form-input" type="password" placeholder="Min. 8 karakter" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Konfirmasi Password Baru</label><input className="form-input" type="password" placeholder="Ulangi password baru" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={savePassword}>Simpan Password</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setChangePass(false)}>Batal</button>
            </div>
          </div>
        )}
      </div>

      <div className="settings-card">
        <div className="sec-title" style={{ marginBottom: 13 }}>Preferensi Notifikasi</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['email', 'Notifikasi Email', 'Peringatan perangkat offline & lonjakan daya dikirim ke email Anda'],
            ['push', 'Notifikasi Push', perm === 'unsupported' ? 'Browser ini tidak mendukung notifikasi'
              : perm === 'denied' ? 'Diblokir di browser. Izinkan lewat ikon gembok di address bar'
              : 'Peringatan muncul sebagai notifikasi browser (saat aplikasi terbuka)'],
            ['daily', 'Laporan Harian', 'Ringkasan harian via email, dikirim setiap pagi'],
          ].map(([k, t, d]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div><div style={{ fontSize: '.83rem', fontWeight: 500, color: 'var(--gray-800)' }}>{t}</div><div style={{ fontSize: '.73rem', color: 'var(--gray-500)' }}>{d}</div></div>
              <label className="toggle"><input type="checkbox" checked={prefs[k]} onChange={(e) => togglePref(k, e.target.checked)} /><span className="tslider" /></label>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--gray-100)' }}>
          <div style={{ fontSize: '.73rem', color: 'var(--gray-500)', marginBottom: 8 }}>Email dikirim ke <b>{user?.email}</b>. Kirim contoh untuk memastikan email masuk:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-sm btn-outline" disabled={!!testing} onClick={() => sendTest('alert')}>{testing === 'alert' ? 'Mengirim...' : 'Kirim contoh peringatan'}</button>
            <button className="btn-sm btn-outline" disabled={!!testing} onClick={() => sendTest('daily')}>{testing === 'daily' ? 'Mengirim...' : 'Kirim contoh laporan harian'}</button>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('Keluar dari sistem?')) logout(); }}>Keluar dari Sistem</button>
      </div>
    </>
  );
}
