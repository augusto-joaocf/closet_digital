import { useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';

export default function ConfirmModal({ onClose, onConfirm, description }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Modal title="Confirma a Exclusão?" onClose={onClose} className="confirm-modal" showClose={false}>
    <p className="sr-only">{description}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="button-row">
      <Button disabled={busy} onClick={async () => {
        setBusy(true);
        try { await onConfirm(); } catch (e) { setError(e.message); setBusy(false); }
      }}>Confirmar</Button>
      <Button autoFocus disabled={busy} onClick={onClose}>Voltar</Button>
    </div>
  </Modal>;
}
