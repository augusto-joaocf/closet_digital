import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCloset } from '../context/ClosetContext.jsx';
import { emptyFilters } from '../data/options.js';
import { filterPieces } from '../services/piecesService.js';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import PieceCard from '../components/pieces/PieceCard.jsx';
import PieceDetailsModal from '../components/pieces/PieceDetailsModal.jsx';
import PieceFilters from '../components/pieces/PieceFilters.jsx';
import PieceSearch from '../components/pieces/PieceSearch.jsx';
import PieceForm from '../components/pieces/PieceForm.jsx';

export function PiecesPage({ favorites = false }) {
  const { pieces, filters, setFilters, search, setSearch } = useCloset();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const results = filterPieces(pieces, favorites ? { favorites: true } : { filters, search });
  const hasCriteria = Boolean(search.trim() || Object.values(filters).some(Boolean));
  const onlyUnavailable = pieces.length > 0 && pieces.every((piece) => piece.status === 'Indisponível') && !hasCriteria;
  if (!favorites && pieces.length === 0) return <>
    <h1 className="sr-only">Meu Closet</h1>
    <div className="empty-page reference-empty"><EmptyState title="Seu closet ainda está vazio!" description="Adicione sua primeira peça para começar." to="/pieces/new" /></div>
  </>;
  return <>
    {favorites ? <h1 className={results.length ? 'page-title' : 'sr-only'}>Favoritas</h1> : <>
      <h1 className="sr-only">Meu Closet</h1>
      <PieceSearch value={search} onChange={setSearch} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen(!filtersOpen)} filterCount={Object.values(filters).filter(Boolean).length} />
    </>}
    {filtersOpen ? <PieceFilters filters={filters} onApply={(value) => { setFilters(value); setFiltersOpen(false); }} onClear={() => { setFilters(emptyFilters()); setFiltersOpen(false); }} />
      : results.length > 0 ? <>
        <div className={`piece-grid ${favorites ? 'favorites-grid' : ''}`}>{results.map((piece) => <PieceCard key={piece.id} piece={piece} onClick={() => setDetailId(piece.id)} />)}</div>
        {!favorites && <Button className="listing-add" to="/pieces/new">+ Adicionar</Button>}
      </> : <div className={`empty-page ${favorites ? 'reference-empty' : ''}`}>
        {favorites ? <EmptyState title="Você não tem peças favoritas!" description={pieces.some((p) => p.favorite) ? 'Suas favoritas estão indisponíveis. Encontre-as pelo filtro de status no closet.' : 'Favorite suas peças e elas aparecerão aqui.'} />
          : <EmptyState title="Nenhuma peça encontrada" description={onlyUnavailable ? 'Suas peças estão indisponíveis. Encontre-as pelo filtro de status.' : 'Experimente outra busca ou remova os filtros.'} action="Limpar busca e filtros" onAction={hasCriteria ? () => { setSearch(''); setFilters(emptyFilters()); } : undefined} />}
        {!favorites && pieces.length > 0 && <Button className="narrow-content" to="/pieces/new">+ Adicionar</Button>}
      </div>}
    {detailId && <PieceDetailsModal id={detailId} onClose={() => setDetailId(null)} closeOnUnfavorite={favorites} />}
  </>;
}

export function PieceFormPage() {
  const { id } = useParams();
  const { pieces } = useCloset();
  const piece = pieces.find((p) => p.id === id);
  if (id && !piece) return <EmptyState title="Peça não encontrada" to="/pieces" action="Voltar ao Closet" />;
  return <>
    <Link className="back-link" to="/pieces">‹ Voltar</Link>
    <h1 className="page-title">{piece ? 'Editar Peça' : 'Adicionar Peça'}</h1>
    <PieceForm key={id || 'new'} piece={piece} />
  </>;
}
