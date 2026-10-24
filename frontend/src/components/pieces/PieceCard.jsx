import PieceImage from './PieceImage.jsx';

export default function PieceCard({ piece, onClick, selected, onRemove }) {
  return <div className={`piece-card ${selected ? 'is-selected' : ''}`}>
    <button type="button" className="piece-card-main" onClick={onClick}
      aria-pressed={selected === undefined ? undefined : selected}
      aria-label={selected === undefined ? `Ver ${piece.name}` : `${selected ? 'Desmarcar' : 'Selecionar'} ${piece.name}`}>
      <PieceImage piece={piece} />
      <span>{piece.name}</span>
      {selected !== undefined && <span className="selection-dot" aria-hidden="true">{selected ? '✓' : ''}</span>}
    </button>
    {onRemove && <button type="button" className="remove-piece" onClick={onRemove} aria-label={`Remover ${piece.name} do conjunto`}>×</button>}
  </div>;
}
