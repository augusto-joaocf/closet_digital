import { useState } from 'react';
import { useCloset } from '../../context/ClosetContext.jsx';
import { filterPieces } from '../../services/piecesService.js';
import { emptyFilters } from '../../data/options.js';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import PieceSearch from '../pieces/PieceSearch.jsx';
import PieceFilters from '../pieces/PieceFilters.jsx';
import PieceCard from '../pieces/PieceCard.jsx';

export default function PieceSelector({ selectedIds, onConfirm, onClose }) {
  const { pieces } = useCloset();
  const [selected, setSelected] = useState(new Set(selectedIds));
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const visible = filterPieces(pieces, { search, filters });
  return <Modal title="Selecionar peças do conjunto" onClose={onClose} className="selector-modal">
    <PieceSearch value={search} onChange={setSearch} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen(!filtersOpen)} filterCount={Object.values(filters).filter(Boolean).length} />
    {filtersOpen ? <PieceFilters filters={filters} onApply={(next) => { setFilters(next); setFiltersOpen(false); }} onClear={() => { setFilters(emptyFilters()); setFiltersOpen(false); }} />
      : <>
        <div className="piece-grid">{visible.map((piece) => <PieceCard key={piece.id} piece={piece} selected={selected.has(piece.id)} onClick={() => setSelected((previous) => {
          const next = new Set(previous);
          if (next.has(piece.id)) next.delete(piece.id); else next.add(piece.id);
          return next;
        })} />)}</div>
        {visible.length === 0 && <p className="result-empty">{pieces.length ? 'Nenhuma peça encontrada para estes filtros.' : 'Cadastre uma peça no closet antes de montar seu conjunto.'}</p>}
        <p className="sr-only" role="status">{selected.size} peças selecionadas</p>
        <Button className="selector-confirm" onClick={() => onConfirm([...selected].filter((id) => pieces.some((p) => p.id === id)))}>Confirmar</Button>
      </>}
  </Modal>;
}
