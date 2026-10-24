import { useId } from 'react';
import './Controls.css';

export default function SelectField({ label, options, value, onChange, error, all = false, ...props }) {
  const id = useId();
  return <div className={`select-field ${error ? 'has-error' : ''}`}>
    <label className="sr-only" htmlFor={id}>{label}</label>
    <select id={id} value={value} onChange={onChange} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props}>
      <option value="">{all ? `${label}: todos` : label}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
    {error && <span id={`${id}-error`} className="field-error">{error}</span>}
  </div>;
}
