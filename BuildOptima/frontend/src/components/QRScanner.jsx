import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import Icon from './Icon.jsx';

export default function QRScanner({ onDetect, active }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const detectedRef = useRef(false);

  const [status, setStatus] = useState('idle'); // idle | starting | scanning | error
  const [errorMsg, setErrorMsg] = useState('');

  async function startCamera() {
    setStatus('starting');
    setErrorMsg('');
    detectedRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser ini tidak mendukung akses kamera.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('scanning');
      tick();
    } catch (err) {
      setStatus('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Akses kamera ditolak. Izinkan akses kamera di browser, atau gunakan input kode manual di bawah.');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('Tidak ditemukan kamera pada perangkat ini. Gunakan input kode manual di bawah.');
      } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setErrorMsg('Akses kamera butuh koneksi HTTPS (kecuali di localhost). Gunakan input kode manual di bawah.');
      } else {
        setErrorMsg(err.message || 'Gagal mengakses kamera. Gunakan input kode manual di bawah.');
      }
    }
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus('idle');
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || detectedRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (code?.data) {
        detectedRef.current = true;
        stopCamera();
        onDetect(code.data);
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (active) startCamera();
    else stopCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="scanner-area">
      <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'scanning' ? 'block' : 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {status === 'scanning' && (
        <>
          <div className="scanner-corners"><div className="sc-tl" /><div className="sc-tr" /><div className="sc-bl" /><div className="sc-br" /></div>
          <div className="scanner-line" />
        </>
      )}

      {status === 'starting' && <div className="scanner-text">Mengaktifkan kamera...</div>}

      {status === 'idle' && (
        <button
          type="button"
          onClick={startCamera}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.85)' }}
        >
          <Icon name="device" size={28} stroke="white" />
          <span className="scanner-text">Klik untuk mengaktifkan kamera</span>
        </button>
      )}

      {status === 'error' && (
        <div style={{ padding: '0 20px', textAlign: 'center' }}>
          <div className="scanner-text" style={{ color: '#fca5a5', marginBottom: 8 }}>{errorMsg}</div>
          <button type="button" className="btn-sm btn-outline" style={{ borderColor: 'rgba(255,255,255,.4)', color: 'white' }} onClick={startCamera}>Coba Lagi</button>
        </div>
      )}
    </div>
  );
}
