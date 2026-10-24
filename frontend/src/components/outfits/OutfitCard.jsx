import Button from '../common/Button.jsx';
import { outfitAvailable } from '../../services/outfitsService.js';

export default function OutfitCard({ outfit, pieces }) {
  const available = outfitAvailable(outfit, pieces);
  return <div className="outfit-card">
    <Button to={`/outfits/${outfit.id}`}>{outfit.name}</Button>
    {!available && <span className="outfit-unavailable">Indisponível</span>}
  </div>;
}
