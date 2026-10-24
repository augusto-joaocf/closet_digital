import Button from '../components/common/Button.jsx';
import './Outfits.css';

export default function AlbumsPage() {
  return <>
    <h1 className="page-title">Seus Álbuns</h1>
    <div className="narrow-content album-actions"><Button to="/outfits">Conjuntos</Button><Button to="/favorites">Favoritas</Button></div>
  </>;
}
