import { useId } from 'react';
import './Controls.css';

export default function FloatingInput({ label, error, value = '', id, className = '', ...props }) {
  const generated = useId();
  const inputId = id || generated;
  return <div className={`floating-field ${value !== '' ? 'has-value' : ''} ${error ? 'has-error' : ''} ${className}`}>
    <input id={inputId} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} {...props} />
    <label htmlFor={inputId}>{label}</label>
    {error && <span id={`${inputId}-error`} className="field-error">{error}</span>}
  </div>;
}
