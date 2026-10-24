import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCloset } from '../context/ClosetContext.jsx';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { authService } from '../services/authService.js';
import useFormAction from '../hooks/useFormAction.js';
import Button from '../components/common/Button.jsx';
import FloatingInput from '../components/common/FloatingInput.jsx';
import ImageUpload from '../components/common/ImageUpload.jsx';
import Avatar from '../components/common/Avatar.jsx';
import './Profile.css';

export function ProfilePage() {
  const { user, pieces, outfits } = useCloset();
  const navigate = useNavigate();
  return <div className="profile-page">
    <h1 className="sr-only">Seu Perfil</h1>
    <Avatar user={user} />
    <p className="profile-greeting">Olá, {user.name}!<br /><span>{user.email}</span></p>
    <dl className="profile-stats narrow-content">
      {[['Peças', 'Peça', pieces.length], ['Conjuntos', 'Conjunto', outfits.length], ['Indisponíveis', 'Indisponível', pieces.filter((p) => p.status === 'Indisponível').length], ['Álbuns', 'Álbum', 2]].map(([plural, singular, count]) => <div key={plural}><dt className="sr-only">{plural}</dt><dd>{count} {count === 1 ? singular : plural}</dd></div>)}
    </dl>
    <div className="profile-actions narrow-content">
      <Button to="/profile/edit">Editar Perfil</Button><Button to="/profile/change-password">Alterar Senha</Button>
      <Button onClick={async () => { await authService.logout(); navigate('/', { replace: true }); }}>Sair da Conta</Button>
    </div>
  </div>;
}

export function EditProfilePage() {
  const { user } = useCloset();
  const [values, setValues] = useState({ ...user });
  const { errors, busy, run } = useFormAction();
  const navigate = useNavigate();
  const notify = useFeedback();
  return <>
    <Link className="back-link" to="/profile">‹ Voltar</Link>
    <h1 className="page-title">Editar Perfil</h1>
    <form className="profile-form" noValidate onSubmit={(event) => { event.preventDefault(); run(async () => {
      await authService.updateProfile(values); notify('Perfil atualizado em modo demonstrativo.'); navigate('/profile');
    }); }}>
      <ImageUpload className="avatar-upload" label="Selecionar imagem de perfil" onChange={(avatar) => setValues({ ...values, avatar })}>
        <Avatar user={values} /><span className="avatar-plus" aria-hidden="true">+</span>
      </ImageUpload>
      <div className="profile-fields narrow-content">
        <FloatingInput label="Nome" name="name" autoComplete="name" value={values.name} maxLength={100} error={errors.name} required onChange={(event) => setValues({ ...values, name: event.target.value })} />
        <FloatingInput label="Email" name="email" type="email" autoComplete="email" value={values.email} error={errors.email} required onChange={(event) => setValues({ ...values, email: event.target.value })} />
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        <Button type="submit" className="profile-save" disabled={busy}>Salvar Alterações</Button>
      </div>
    </form>
  </>;
}

export function ChangePasswordPage() {
  const [values, setValues] = useState({ currentPassword: '', password: '', confirmPassword: '' });
  const { errors, busy, run } = useFormAction();
  const navigate = useNavigate();
  const notify = useFeedback();
  return <>
    <Link className="back-link" to="/profile">‹ Voltar</Link>
    <h1 className="page-title">Alterar Senha</h1>
    <form className="password-form narrow-content" noValidate onSubmit={(event) => { event.preventDefault(); run(async () => {
      await authService.changePassword(values); setValues({ currentPassword: '', password: '', confirmPassword: '' });
      notify('Alteração simulada. A senha atual não é verificada nem armazenada.'); navigate('/profile');
    }); }}>
      {[['currentPassword', 'Senha Atual'], ['password', 'Nova Senha'], ['confirmPassword', 'Repita a Nova Senha']].map(([key, label]) => <FloatingInput key={key} label={label} name={key} type="password" value={values[key]} error={errors[key]} required autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />)}
      {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
      <Button type="submit" disabled={busy}>Salvar Alterações</Button>
      <p className="demo-note">Demonstração: nenhuma credencial será alterada ou armazenada.</p>
    </form>
  </>;
}
