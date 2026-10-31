import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function Reset() {
  const [cells, setCells] = useState(Array(6).fill(''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputsRef = useRef([]);
  const { state } = useLocation();
  const { resetPassword, forgotPassword } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!state?.email) { navigate('/forgot', { replace: true }); return; }
    inputsRef.current[0]?.focus();
  }, []);

  function handleChange(i, v) {
    const digit = v.replace(/\D/g, '').slice(0, 1);
    const next = [...cells]; next[i] = digit; setCells(next);
    if (digit && i < 5) inputsRef.current[i + 1]?.focus();
  }
  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !cells[i] && i > 0) inputsRef.current[i - 1]?.focus();
  }

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    const code = cells.join('');
    if (code.length < 6) { showToast('Masukkan 6 digit kode!', 'danger'); return; }
    if (password.length < 8) { showToast('Password baru minimal 8 karakter.', 'danger'); return; }
    if (password !== confirm) { showToast('Konfirmasi password tidak cocok.', 'danger'); return; }
    setSubmitting(true);
    try {
      await resetPassword({ email: state.email, otp: code, newPassword: password });
      showToast('Password berhasil direset! Silakan login.', 'success');
      navigate('/login');
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal mereset password.', 'danger');
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    try {
      await forgotPassword(state.email);
      showToast('Kode reset baru telah dikirim ke email Anda.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal mengirim ulang kode.', 'danger');
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
        <div className="auth-title">Reset Password</div>
        <div className="auth-sub">Masukkan kode 6 digit dari email dan password baru Anda</div>
        <form onSubmit={submit}>
          <div className="otp-wrap">
            {cells.map((v, i) => (
              <input
                key={i}
                ref={(el) => (inputsRef.current[i] = el)}
                type="tel"
                maxLength={1}
                className="otp-cell"
                value={v}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
              />
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">Password Baru</label>
            <div className="input-icon has-eye" style={{ position: 'relative' }}>
              <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="Min. 8 karakter" style={{ paddingRight: 36 }} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="eye-btn" type="button" onClick={() => setShowPw((s) => !s)}><Icon name={showPw ? 'eyeOff' : 'eye'} size={16} /></button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Konfirmasi Password Baru</label>
            <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="Ulangi password baru" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit">Reset Password</button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: '.79rem', color: 'var(--gray-500)' }}>
          Tidak menerima kode? <button type="button" className="btn-ghost" style={{ fontSize: '.79rem' }} onClick={resend}>Kirim ulang</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 5 }}><Link to="/forgot" className="btn-ghost">← Kembali</Link></div>
      </div>
    </div>
  );
}
