import { useEffect, useId, useRef } from 'react';
import './Modal.css';

export default function Modal({ title, onClose, children, className = '', showClose = true }) {
  const ref = useRef(null);
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); closeRef.current(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <h2 id={id} className={className.includes('confirm') ? '' : 'sr-only'}>{title}</h2>
    {showClose && <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>}
    {children}
  </dialog>;
}
