import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();

  async function doLogin(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { showToast('Isi username dan password!', 'danger'); return; }
    setLoading(true);
    try {
      await login(username.trim(), password.trim());
      navigate('/');
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal masuk. Periksa kembali kredensial Anda.', 'danger');
    } finally {
      setLoading(false);
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
        <div className="auth-title">Masuk ke Sistem</div>
        <div className="auth-sub">Sistem Manajemen Gedung Pintar</div>
        <form onSubmit={doLogin}>
          <div className="form-group">
            <label className="form-label">Username / NIP</label>
            <div className="input-icon">
              <Icon name="userCircle" size={15} className="icon-left" />
              <input className="form-input" type="text" placeholder="Masukkan username Anda" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-icon has-eye">
              <Icon name="lock" size={15} className="icon-left" />
              <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="eye-btn" type="button" onClick={() => setShowPw((s) => !s)} title="Tampilkan/sembunyikan password">
                <Icon name={showPw ? 'eyeOff' : 'eye'} size={16} />
              </button>
            </div>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="chk-remember" style={{ width: 14, height: 14 }} />
            <label htmlFor="chk-remember" style={{ fontSize: '.81rem', color: 'var(--gray-600)' }}>Ingat saya</label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Memproses...' : 'Masuk'}</button>
        </form>
        <div className="auth-links">
          <Link to="/forgot">Lupa password?</Link>
          <Link to="/register">Buat akun baru</Link>
        </div>
      </div>
    </div>
  );
}
