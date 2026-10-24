import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useCloset } from './context/ClosetContext.jsx';
import AppLayout, { ScrollToTop } from './components/layout/AppLayout.jsx';
import { WelcomePage, RegisterPage, LoginPage, ForgotPasswordPage, VerifyCodePage, ResetPasswordPage } from './pages/auth/AuthPages.jsx';
import HomePage from './pages/HomePage.jsx';
import { PiecesPage, PieceFormPage } from './pages/PiecesPage.jsx';
import AlbumsPage from './pages/AlbumsPage.jsx';
import { OutfitsPage, OutfitDetailsPage, OutfitFormPage } from './pages/OutfitsPages.jsx';
import { ProfilePage, EditProfilePage, ChangePasswordPage } from './pages/ProfilePages.jsx';
import EmptyState from './components/common/EmptyState.jsx';

function ProtectedRoutes() {
  const { session } = useCloset();
  const location = useLocation();
  return session ? <Outlet /> : <Navigate to="/login" state={{ from: location.pathname }} replace />;
}
function PublicRoutes() {
  const { session } = useCloset();
  return session ? <Navigate to="/home" replace /> : <Outlet />;
}
export default function App() {
  const { session } = useCloset();
  return <div className="app-shell">
    <ScrollToTop />
    <Routes>
      <Route element={<PublicRoutes />}>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-code" element={<VerifyCodePage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route element={<ProtectedRoutes />}>
        <Route element={<AppLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/pieces" element={<PiecesPage key="closet" />} />
          <Route path="/pieces/new" element={<PieceFormPage />} />
          <Route path="/pieces/:id/edit" element={<PieceFormPage />} />
          <Route path="/albums" element={<AlbumsPage />} />
          <Route path="/favorites" element={<PiecesPage key="favorites" favorites />} />
          <Route path="/outfits" element={<OutfitsPage />} />
          <Route path="/outfits/new" element={<OutfitFormPage />} />
          <Route path="/outfits/:id" element={<OutfitDetailsPage />} />
          <Route path="/outfits/:id/edit" element={<OutfitFormPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<EditProfilePage />} />
          <Route path="/profile/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Route>
      <Route path="*" element={<main className="not-found"><EmptyState title="Página não encontrada" to={session ? '/home' : '/'} action="Voltar ao início" /></main>} />
    </Routes>
  </div>;
}
