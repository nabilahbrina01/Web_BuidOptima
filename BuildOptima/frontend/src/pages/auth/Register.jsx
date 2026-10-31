import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', nip: '', email: '', username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();

  function set(k) { return (e) => setForm((f) => ({ ...f, [k]: e.target.value })); }

  async function goToVerify(e) {
    e.preventDefault();
    if (submitting) return;
    if (!form.name || !form.email || !form.username || !form.password) {
      showToast('Lengkapi semua data pendaftaran!', 'danger');
      return;
    }
    setSubmitting(true);
    try {
      await register({ ...form, name: form.name.trim(), email: form.email.trim(), username: form.username.trim() });
      navigate('/verify', { state: { email: form.email.trim(), username: form.username.trim() } });
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal mendaftar. Coba lagi.', 'danger');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen auth-bg active">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><Icon name="building" size={21} fill="white" stroke="none" /></div>
          <div className="auth-logo-text"><h1>BuildOptima</h1><p>Teknik Komputer — Universitas Diponegoro</p></div>
        </div>
        <div className="auth-divider" />
        <div className="auth-title">Buat Akun Baru</div>
        <div className="auth-sub">Pendaftaran untuk Staff / Teknisi</div>
        <form onSubmit={goToVerify}>
          <div className="form-group">
            <label className="form-label">Peran</label>
            <input className="form-input" type="text" value="Staff / Teknisi" readOnly style={{ background: 'var(--gray-100)', color: 'var(--gray-600)', cursor: 'not-allowed' }} />
          </div>
          <div className="input-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Nama Lengkap</label>
              <input className="form-input" type="text" placeholder="Dr. Budi Santoso" value={form.name} onChange={set('name')} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">NIP / NIM</label>
              <input className="form-input" type="text" placeholder="19880101..." value={form.nip} onChange={set('nip')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="budi@undip.ac.id" value={form.email} onChange={set('email')} />
          </div>
          <div className="input-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Username</label>
              <input className="form-input" type="text" placeholder="budi_santoso" value={form.username} onChange={set('username')} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Password</label>
              <div className="input-icon has-eye" style={{ position: 'relative' }}>
                <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="Min. 8 karakter" style={{ paddingRight: 36 }} value={form.password} onChange={set('password')} />
                <button className="eye-btn" type="button" onClick={() => setShowPw((s) => !s)}><Icon name={showPw ? 'eyeOff' : 'eye'} size={16} /></button>
              </div>
            </div>
          </div>
          <button className="btn btn-primary" type="submit">Lanjut Verifikasi Email</button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 11 }}>
          <Link to="/login" className="btn-ghost">← Kembali ke Login</Link>
        </div>
      </div>
    </div>
  );
}
