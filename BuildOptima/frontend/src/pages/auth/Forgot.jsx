import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const STEPS = ['Email', 'Kode OTP', 'Password Baru'];
const RESEND_SECONDS = 30;

export default function Forgot() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [cells, setCells] = useState(Array(6).fill(''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef([]);
  const { forgotPassword, verifyResetOtp, resetPassword } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();
  const code = cells.join('');

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => { if (step === 2) inputsRef.current[0]?.focus(); }, [step]);

  function resetCells() { setCells(Array(6).fill('')); }

  // ── Langkah 1: kirim OTP ───────────────────────────────────────────────
  async function sendCode(e) {
    e?.preventDefault();
    if (busy) return;
    if (!email.trim()) { showToast('Masukkan email terdaftar!', 'danger'); return; }
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      showToast('Jika email terdaftar, kode OTP telah dikirim.', 'success');
      setCooldown(RESEND_SECONDS);
      resetCells();
      setStep(2);
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal mengirim kode OTP.', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      showToast('Kode OTP baru telah dikirim.', 'success');
      setCooldown(RESEND_SECONDS);
      resetCells();
      inputsRef.current[0]?.focus();
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal mengirim ulang kode.', 'danger');
    } finally {
      setBusy(false);
    }
  }

  // ── Langkah 2: verifikasi OTP ──────────────────────────────────────────
  function handleChange(i, v) {
    const digit = v.replace(/\D/g, '').slice(0, 1);
    const next = [...cells]; next[i] = digit; setCells(next);
    if (digit && i < 5) inputsRef.current[i + 1]?.focus();
  }
  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !cells[i] && i > 0) inputsRef.current[i - 1]?.focus();
  }
  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    setCells(Array.from({ length: 6 }, (_, i) => text[i] || ''));
    inputsRef.current[Math.min(text.length, 5)]?.focus();
  }

  async function verifyCode(e) {
    e.preventDefault();
    if (busy) return;
    if (code.length < 6) { showToast('Masukkan 6 digit kode OTP!', 'danger'); return; }
    setBusy(true);
    try {
      await verifyResetOtp({ email: email.trim(), otp: code });
      showToast('Kode OTP benar. Silakan buat password baru.', 'success');
      setStep(3);
    } catch (err) {
      showToast(err.response?.data?.error || 'Kode OTP salah.', 'danger');
    } finally {
      setBusy(false);
    }
  }

  // ── Langkah 3: password baru ───────────────────────────────────────────
  async function savePassword(e) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) { showToast('Password baru minimal 8 karakter.', 'danger'); return; }
    if (password !== confirm) { showToast('Konfirmasi password tidak cocok.', 'danger'); return; }
    setBusy(true);
    try {
      await resetPassword({ email: email.trim(), otp: code, newPassword: password });
      showToast('Password berhasil direset! Silakan login.', 'success');
      navigate('/login');
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal mereset password.', 'danger');
      // OTP kedaluwarsa / tidak lagi valid → kembali ke langkah verifikasi
      if (err.response?.status === 400) { resetCells(); setStep(2); }
    } finally {
      setBusy(false);
    }
  }

  const subtitle = step === 1
    ? 'Masukkan email untuk menerima kode OTP'
    : step === 2
      ? `Kode 6 digit telah dikirim ke ${email.trim()}`
      : 'Buat password baru untuk akun Anda';

  return (
    <div className="screen auth-bg active">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><Icon name="building" size={21} fill="white" stroke="none" /></div>
          <div className="auth-logo-text"><h1>BuildOptima</h1><p>Teknik Komputer — Universitas Diponegoro</p></div>
        </div>
        <div className="auth-divider" />

        {/* indikator langkah */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = step > n; const active = step === n;
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', fontSize: '.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done || active ? 'var(--blue-600)' : 'var(--gray-200)', color: done || active ? '#fff' : 'var(--gray-500)' }}>
                    {done ? '✓' : n}
                  </div>
                  <span style={{ fontSize: '.64rem', color: active ? 'var(--blue-600)' : 'var(--gray-400)', fontWeight: active ? 600 : 500 }}>{label}</span>
                </div>
                {n < STEPS.length && <div style={{ width: 26, height: 2, marginBottom: 14, background: step > n ? 'var(--blue-600)' : 'var(--gray-200)' }} />}
              </div>
            );
          })}
        </div>

        <div className="auth-title">Lupa Password</div>
        <div className="auth-sub">{subtitle}</div>

        {step === 1 && (
          <form onSubmit={sendCode}>
            <div className="form-group">
              <label className="form-label">Email Terdaftar</label>
              <div className="input-icon">
                <Icon name="mail" size={15} className="icon-left" />
                <input className="form-input" type="email" placeholder="budi@undip.ac.id" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit">{busy ? 'Mengirim...' : 'Kirim Kode OTP'}</button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={verifyCode}>
            <div className="otp-wrap">
              {cells.map((v, i) => (
                <input key={i} ref={(el) => (inputsRef.current[i] = el)} type="tel" maxLength={1} className="otp-cell" value={v}
                  onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)} onPaste={handlePaste} />
              ))}
            </div>
            <button className="btn btn-primary" type="submit">{busy ? 'Memeriksa...' : 'Verifikasi Kode'}</button>
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: '.79rem', color: 'var(--gray-500)' }}>
              Tidak menerima kode?{' '}
              <button type="button" className="btn-ghost" style={{ fontSize: '.79rem' }} onClick={resend} disabled={cooldown > 0}>
                {cooldown > 0 ? `Kirim ulang (${cooldown}d)` : 'Kirim ulang'}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <button type="button" className="btn-ghost" style={{ fontSize: '.79rem' }} onClick={() => setStep(1)}>Ganti email</button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={savePassword}>
            <div className="form-group">
              <label className="form-label">Password Baru</label>
              <div className="input-icon has-eye" style={{ position: 'relative' }}>
                <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="Min. 8 karakter" style={{ paddingRight: 36 }} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
                <button className="eye-btn" type="button" onClick={() => setShowPw((s) => !s)}><Icon name={showPw ? 'eyeOff' : 'eye'} size={16} /></button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Konfirmasi Password Baru</label>
              <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="Ulangi password baru" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit">{busy ? 'Menyimpan...' : 'Simpan Password Baru'}</button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 11 }}><Link to="/login" className="btn-ghost">← Kembali ke Login</Link></div>
      </div>
    </div>
  );
}