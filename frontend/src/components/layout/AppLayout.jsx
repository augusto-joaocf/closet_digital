import { useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';
import { useCloset } from '../../context/ClosetContext.jsx';
import './Layout.css';

export function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
export default function AppLayout() {
  const { storageWarning } = useCloset();
  return <>
    <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    <main id="main-content" className="private-content" tabIndex={-1}>
      {storageWarning && <p className="demo-note" role="status">{storageWarning}</p>}
      <Outlet />
    </main>
    <BottomNav />
  </>;
}
