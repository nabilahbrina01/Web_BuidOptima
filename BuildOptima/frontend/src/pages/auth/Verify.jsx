import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function Verify() {
  const [cells, setCells] = useState(Array(6).fill(''));
  const inputsRef = useRef([]);
  const { state } = useLocation();
  const { verifyOtp, resendOtp } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();

  useEffect(() => { inputsRef.current[0]?.focus(); }, []);

  function handleChange(i, v) {
    const digit = v.replace(/\D/g, '').slice(0, 1);
    const next = [...cells]; next[i] = digit; setCells(next);
    if (digit && i < 5) inputsRef.current[i + 1]?.focus();
  }
  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !cells[i] && i > 0) inputsRef.current[i - 1]?.focus();
  }

  async function doVerify(e) {
    e.preventDefault();
    const code = cells.join('');
    if (code.length < 6) { showToast('Masukkan 6 digit kode!', 'danger'); return; }
    if (!state?.email) { showToast('Data pendaftaran tidak ditemukan, silakan ulangi.', 'danger'); navigate('/register'); return; }
    try {
      await verifyOtp({ email: state.email, otp: code });
      showToast('Akun berhasil dibuat! Silakan login.', 'success');
      navigate('/login');
    } catch (err) {
      showToast(err.response?.data?.error || 'Kode verifikasi salah.', 'danger');
    }
  }

  async function doResend() {
    if (!state?.email) { navigate('/register'); return; }
    try {
      await resendOtp(state.email);
      showToast('Kode verifikasi baru telah dikirim ke email Anda.', 'success');
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
        <div className="auth-title">Verifikasi Email</div>
        <div className="auth-sub">Kode 6 digit telah dikirim ke email Anda</div>
        <div className="verify-info">
          <Icon name="info" size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>Periksa inbox email Anda. Kode berlaku selama <strong>10 menit</strong>.</div>
        </div>
        <form onSubmit={doVerify}>
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
          <button className="btn btn-primary" type="submit">Verifikasi &amp; Buat Akun</button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: '.79rem', color: 'var(--gray-500)' }}>
          Tidak menerima kode? <button type="button" className="btn-ghost" style={{ fontSize: '.79rem' }} onClick={doResend}>Kirim ulang</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 5 }}><Link to="/register" className="btn-ghost">← Kembali</Link></div>
      </div>
    </div>
  );
}
