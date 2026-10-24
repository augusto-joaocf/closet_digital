import { useState } from 'react';
import { emptyFilters, pieceOptions } from '../../data/options.js';
import SelectField from '../common/SelectField.jsx';
import Button from '../common/Button.jsx';

export default function PieceFilters({ filters, onApply, onClear }) {
  const [draft, setDraft] = useState(filters);
  return <form className="piece-filters" aria-label="Filtros de peças" onSubmit={(event) => { event.preventDefault(); onApply(draft); }}>
    {Object.entries(pieceOptions).map(([key, option]) => <SelectField key={key} label={option.label} options={option.values} value={draft[key]}
      onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />)}
    <div className="filter-actions">
      <Button type="submit">Aplicar Filtros</Button>
      <Button onClick={() => { setDraft(emptyFilters()); onClear(); }}>Remover Filtros</Button>
    </div>
  </form>;
}
