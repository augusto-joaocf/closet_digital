import { useEffect, useState } from 'react';
import hanger from '../../assets/icons/clothes-hanger-regular.png';
import jordan from '../../assets/demo/nike-jordan.png';
import cinza from '../../assets/demo/nike-cinza.png';
import './Pieces.css';

const demoImages = { jordan, cinza };
export default function PieceImage({ piece = {}, className = '' }) {
  const source = piece.image || demoImages[piece.imageKey];
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  const fallback = !source || failed;
  return <div className={`piece-image ${fallback ? 'piece-image--fallback' : ''} ${className}`}>
    <img src={fallback ? hanger : source} alt={fallback ? `${piece.name || 'Peça'} sem fotografia — cabide` : piece.name || 'Prévia da peça'}
      onError={fallback ? undefined : () => setFailed(true)} />
  </div>;
}
