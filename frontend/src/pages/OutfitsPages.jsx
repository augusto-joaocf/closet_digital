import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCloset } from '../context/ClosetContext.jsx';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { outfitsService, outfitAvailable, validateOutfit } from '../services/outfitsService.js';
import useFormAction from '../hooks/useFormAction.js';
import { assertValid } from '../services/validation.js';
import Button from '../components/common/Button.jsx';
import FloatingInput from '../components/common/FloatingInput.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ConfirmModal from '../components/common/ConfirmModal.jsx';
import PieceCard from '../components/pieces/PieceCard.jsx';
import PieceDetailsModal from '../components/pieces/PieceDetailsModal.jsx';
import OutfitCard from '../components/outfits/OutfitCard.jsx';
import PieceSelector from '../components/outfits/PieceSelector.jsx';
import './Outfits.css';

export function OutfitsPage() {
  const { outfits, pieces } = useCloset();
  return <>
    <h1 className={outfits.length ? 'page-title' : 'sr-only'}>Conjuntos</h1>
    {outfits.length ? <div className="narrow-content outfit-list">
      {outfits.map((outfit) => <OutfitCard key={outfit.id} outfit={outfit} pieces={pieces} />)}
      <Button className="outfit-list-add" to="/outfits/new">+ Adicionar</Button>
    </div> : <div className="empty-page reference-empty"><EmptyState title="Você não tem conjuntos!" description="Adicione seu primeiro conjunto." to="/outfits/new" /></div>}
  </>;
}

export function OutfitDetailsPage() {
  const { id } = useParams();
  const { outfits, pieces } = useCloset();
  const [detailId, setDetailId] = useState(null);
  const outfit = outfits.find((o) => o.id === id);
  if (!outfit) return <EmptyState title="Conjunto não encontrado" to="/outfits" action="Voltar aos Conjuntos" />;
  const available = outfitAvailable(outfit, pieces);
  return <>
    <Link className="back-link" to="/outfits">‹ Voltar</Link>
    <h1 className="page-title">{outfit.name}</h1>
    {!available && <p className="availability-note" role="status">Indisponível · {outfit.pieceIds.length ? 'Uma ou mais peças estão indisponíveis.' : 'As peças deste conjunto foram excluídas.'}</p>}
    <div className="piece-grid outfit-detail-grid">{outfit.pieceIds.map((pieceId) => pieces.find((p) => p.id === pieceId)).filter(Boolean).map((piece) => <PieceCard key={piece.id} piece={piece} onClick={() => setDetailId(piece.id)} />)}</div>
    <Button className="narrow-content outfit-edit-button" to={`/outfits/${id}/edit`}>Editar Conjunto</Button>
    {detailId && <PieceDetailsModal id={detailId} onClose={() => setDetailId(null)} />}
  </>;
}

function OutfitForm({ outfit }) {
  const { pieces } = useCloset();
  const [name, setName] = useState(outfit?.name || '');
  const [pieceIds, setPieceIds] = useState(outfit?.pieceIds || []);
  const [selecting, setSelecting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const { errors, busy, run } = useFormAction();
  const notify = useFeedback();
  const navigate = useNavigate();
  const selectedPieces = pieceIds.map((id) => pieces.find((p) => p.id === id)).filter(Boolean);
  return <>
    <form className="outfit-form" noValidate onSubmit={(event) => { event.preventDefault(); run(async () => {
      const values = { name, pieceIds };
      assertValid(validateOutfit(values, pieces));
      await outfitsService.save(values, outfit?.id);
      notify(outfit ? 'Conjunto atualizado.' : 'Conjunto criado.'); navigate('/outfits');
    }); }}>
      <div className="narrow-content outfit-name"><FloatingInput label="Nome do Conjunto" name="name" value={name} error={errors.name} maxLength={100} required onChange={(event) => setName(event.target.value)} /></div>
      {selectedPieces.length > 0 && <div className="piece-grid outfit-selected-grid">{selectedPieces.map((piece) => <PieceCard key={piece.id} piece={piece} onClick={() => setDetailId(piece.id)} onRemove={() => setPieceIds(pieceIds.filter((id) => id !== piece.id))} />)}</div>}
      {selectedPieces.some((p) => p.status !== 'Disponível') && <p className="availability-note">O conjunto ficará indisponível enquanto houver peças indisponíveis.</p>}
      <div className="narrow-content outfit-form-actions">
        <Button onClick={() => setSelecting(true)}>+ Adicionar Peça</Button>
        {errors.pieceIds && <p className="form-error" role="alert">{errors.pieceIds}</p>}
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        <Button type="submit" className="outfit-save" disabled={busy}>Salvar Conjunto</Button>
        {outfit && <Button className="outfit-delete" onClick={() => setConfirm(true)}>Excluir Conjunto</Button>}
      </div>
    </form>
    {selecting && <PieceSelector selectedIds={pieceIds} onClose={() => setSelecting(false)} onConfirm={(ids) => { setPieceIds(ids); setSelecting(false); }} />}
    {detailId && <PieceDetailsModal id={detailId} onClose={() => setDetailId(null)} />}
    {confirm && <ConfirmModal description={`Excluir ${outfit.name}? As peças continuarão no closet.`} onClose={() => setConfirm(false)} onConfirm={async () => {
      await outfitsService.remove(outfit.id); notify('Conjunto excluído.'); navigate('/outfits');
    }} />}
  </>;
}
export function OutfitFormPage() {
  const { id } = useParams();
  const { outfits } = useCloset();
  const outfit = outfits.find((o) => o.id === id);
  if (id && !outfit) return <EmptyState title="Conjunto não encontrado" to="/outfits" action="Voltar aos Conjuntos" />;
  return <>
    <Link className="back-link" to="/outfits">‹ Voltar</Link>
    <h1 className="page-title">{outfit ? 'Editar Conjunto' : 'Adicionar Conjunto'}</h1>
    <OutfitForm key={id || 'new'} outfit={outfit} />
  </>;
}
