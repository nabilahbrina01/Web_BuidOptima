import { useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal.jsx';

function statusLabel(s) { return s === 'maint' ? 'Perawatan' : s === 'free' ? 'Tidak Terisi' : 'Terisi'; }

export default function RoomDetailModal({ room, onClose }) {
  const navigate = useNavigate();
  if (!room) return null;
  return (
    <Modal
      open={!!room}
      onClose={onClose}
      title={`Detail — ${room.room_code || room.id} — ${room.name}`}
      actions={<>
        <button className="btn-sm btn-outline" onClick={onClose}>Tutup</button>
        <button className="btn-sm btn-success" onClick={() => { navigate('/schedule'); onClose(); }}>Lihat Jadwal</button>
      </>}
    >
      <div className="modal-grid">
        <div><span className="mf-label">Status</span><p className="mf-val">{statusLabel(room.status)}</p></div>
        <div><span className="mf-label">Kapasitas</span><p className="mf-val">{room.capacity} orang</p></div>
        <div><span className="mf-label">Kegiatan</span><p className="mf-val">{room.course || '-'}</p></div>
        <div><span className="mf-label">Penanggung Jawab</span><p className="mf-val">{room.supervisor || '-'}</p></div>
        <div><span className="mf-label">Mulai — Selesai</span><p className="mf-val">{room.start_time && room.end_time && room.start_time !== '-' && room.end_time !== '-' ? `${room.start_time} — ${room.end_time} WIB` : '—'}</p></div>
        <div><span className="mf-label">Lantai</span><p className="mf-val">Lantai {room.floor}</p></div>
        <div><span className="mf-label">Suhu</span><p className="mf-val">{room.temperature ?? '–'}°C</p></div>
        <div><span className="mf-label">Kelembaban</span><p className="mf-val">{room.humidity ?? '–'}%</p></div>
      </div>
    </Modal>
  );
}
