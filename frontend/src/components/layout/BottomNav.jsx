import { NavLink, useLocation } from 'react-router-dom';
import Icon from '../common/Icon.jsx';

export default function BottomNav() {
  const { pathname } = useLocation();
  const albumActive = ['/albums', '/outfits', '/favorites'].some((path) => pathname.startsWith(path));
  const items = [
    { to: '/home', label: 'Home', icon: 'house' },
    { to: '/pieces', label: 'Peças', icon: 'shirt' },
    { to: '/albums', label: 'Álbuns', icon: 'folder', active: albumActive },
    { to: '/profile', label: 'Perfil', icon: 'user' },
  ];
  return <nav className="bottom-nav" aria-label="Navegação principal">
    {items.map(({ to, label, icon, active }) => <NavLink key={to} to={to} aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={({ isActive }) => `nav-item ${active || isActive ? 'is-active' : ''}`}>
      <Icon name={icon} />
      <span className="sr-only">{label}</span>
    </NavLink>)}
  </nav>;
}
