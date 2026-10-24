import Icon from '../common/Icon.jsx';

export default function PieceSearch({ value, onChange, filtersOpen, onToggleFilters, filterCount = 0 }) {
  return <div className="piece-search">
    <label className="search-field"><span className="sr-only">Buscar peças</span>
      <input type="search" placeholder="Buscar peças" value={value} onChange={(event) => onChange(event.target.value)} />
      <Icon name="search" />
    </label>
    <button type="button" className={`filter-toggle ${filterCount ? 'has-filters' : ''}`} aria-label={`Filtros${filterCount ? `: ${filterCount} ativos` : ''}`} aria-expanded={filtersOpen} onClick={onToggleFilters}>
      <Icon name="filter" />
    </button>
  </div>;
}
