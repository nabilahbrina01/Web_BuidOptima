import Icon from './Icon.jsx';

export default function Modal({ open, onClose, title, children, actions, maxWidth }) {
  if (!open) return null;
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={maxWidth ? { maxWidth } : undefined}>
        <div className="modal-hdr">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
