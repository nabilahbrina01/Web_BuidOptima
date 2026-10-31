import { useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

export default function QRCode({ value, size = 100 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCodeLib.toCanvas(canvasRef.current, String(value), {
      width: size,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
    }).catch(() => {});
  }, [value, size]);

  if (!value) {
    return <div style={{ width: size, height: size, background: '#f3f4f6', borderRadius: 6 }} />;
  }
  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', margin: '0 auto' }} />;
}
