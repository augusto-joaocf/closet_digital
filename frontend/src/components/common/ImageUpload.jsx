import { useEffect, useId, useRef, useState } from 'react';
import { releaseUnusedPreview } from '../../services/imagePreview.js';

export default function ImageUpload({ children, onChange, className = '', label = 'Selecionar imagem' }) {
  const id = useId();
  const [error, setError] = useState('');
  const ownedUrls = useRef([]);
  useEffect(() => () => ownedUrls.current.forEach(releaseUnusedPreview), []);
  return <div className={`image-upload ${className}`}>
    <label htmlFor={id} className="image-upload-label">{children}<span className="sr-only">{label}</span></label>
    <input id={id} className="file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" aria-label={label}
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)) { setError('Selecione uma imagem PNG, JPG, WebP, GIF ou AVIF.'); event.target.value = ''; return; }
        if (file.size > 10 * 1024 * 1024) { setError('Escolha uma imagem de até 10 MB.'); event.target.value = ''; return; }
        ownedUrls.current.forEach(releaseUnusedPreview);
        const url = URL.createObjectURL(file);
        ownedUrls.current.push(url);
        onChange(url);
        setError('');
        event.target.value = '';
      }} />
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
