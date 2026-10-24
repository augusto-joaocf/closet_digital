import { useNavigate } from 'react-router-dom';
import { useCloset } from '../context/ClosetContext.jsx';
import { emptyFilters } from '../data/options.js';
import Button from '../components/common/Button.jsx';
import './Home.css';

export default function HomePage() {
  const { user, setFilters, setSearch } = useCloset();
  const navigate = useNavigate();
  return <div className="home-page">
    <h1>Olá, {user.name.split(' ')[0]}!<br />O que você quer vestir hoje?</h1>
    <div className="narrow-content home-actions">
      <Button to="/pieces">Meu Closet</Button>
      <div className="button-row"><Button to="/pieces/new">Nova Peça</Button><Button to="/outfits/new">Novo Conjunto</Button></div>
      <div className="home-categories">
        {[['Camisetas', 'Camiseta'], ['Calças', 'Calça'], ['Casacos', 'Casaco'], ['Tênis', 'Tênis']].map(([label, type]) => <Button key={type} onClick={() => {
          setFilters({ ...emptyFilters(), type }); setSearch(''); navigate('/pieces');
        }}>{label}</Button>)}
      </div>
      <Button to="/pieces/new">+ Adicionar Peça</Button>
    </div>
  </div>;
}
