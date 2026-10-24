import { useNavigate } from 'react-router-dom';
import { useCloset } from '../../context/ClosetContext.jsx';
import { useFeedback } from '../../context/FeedbackContext.jsx';
import { piecesService } from '../../services/piecesService.js';
import { pieceOptions } from '../../data/options.js';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';
import Modal from '../common/Modal.jsx';
import PieceImage from './PieceImage.jsx';

export default function PieceDetailsModal({ id, onClose, closeOnUnfavorite = false }) {
  const { pieces } = useCloset();
  const navigate = useNavigate();
  const notify = useFeedback();
  const piece = pieces.find((p) => p.id === id);
  if (!piece) return null;
  return <Modal title={`Detalhes de ${piece.name}`} onClose={onClose} className="detail-modal">
    <PieceImage piece={piece} />
    <button className="favorite-toggle" type="button" aria-label={piece.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} aria-pressed={piece.favorite}
      onClick={async () => {
        try {
          await piecesService.toggleFavorite(piece.id);
          notify(piece.favorite ? 'Peça removida dos favoritos.' : 'Peça adicionada aos favoritos.');
          if (piece.favorite && closeOnUnfavorite) onClose();
        } catch (error) { notify(error.message); }
      }}><Icon name={piece.favorite ? 'heartFilled' : 'heart'} /></button>
    <h3>{piece.name}</h3>
    <dl>{Object.entries(pieceOptions).map(([key, option]) => <div key={key}><dt className="sr-only">{option.label}</dt><dd>{piece[key]}</dd></div>)}</dl>
    <Button onClick={() => { onClose(); navigate(`/pieces/${piece.id}/edit`); }}>Editar Peça</Button>
  </Modal>;
}
