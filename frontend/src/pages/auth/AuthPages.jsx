import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import logo from '../../assets/ClosetDigital_logo.png';
import { authService, DEMO_CODE } from '../../services/authService.js';
import { assertValid, isEmail } from '../../services/validation.js';
import useFormAction from '../../hooks/useFormAction.js';
import { useFeedback } from '../../context/FeedbackContext.jsx';
import FloatingInput from '../../components/common/FloatingInput.jsx';
import Button from '../../components/common/Button.jsx';
import './Auth.css';

function AuthLayout({ title, variant, children }) {
  return <main className={`auth-layout auth-layout--${variant}`} tabIndex={-1}>
    <div className="auth-card"><h1>{title}</h1>{children}</div>
    <img className="auth-logo" src={logo} alt="Closet Digital" />
    <footer className="auth-footer">
      <p className="auth-demo">Modo demonstrativo · Sem autenticação real</p>
      <p>Copyright - 2026<br />Todos os direitos reservados</p>
    </footer>
  </main>;
}
function FormError({ errors }) { return errors.form && <p className="form-error" role="alert">{errors.form}</p>; }

export function WelcomePage() {
  return <main className="welcome-page" tabIndex={-1}>
    <h1>Olá, seja bem-vindo(a)!</h1>
    <p>Crie uma conta<br />ou<br />Entre na sua conta</p>
    <div className="welcome-actions"><Button to="/register">Criar conta</Button><Button to="/login">Entrar</Button></div>
  </main>;
}

export function RegisterPage() {
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const { errors, busy, run } = useFormAction();
  const navigate = useNavigate();
  const notify = useFeedback();
  const fields = [
    ['name', 'Insira seu nome', 'text', 'name'], ['email', 'Insira seu email', 'email', 'email'],
    ['password', 'Insira sua senha', 'password', 'new-password'], ['confirmPassword', 'Repita a senha', 'password', 'new-password'],
  ];
  return <AuthLayout title="Crie uma conta" variant="register">
    <form noValidate onSubmit={(event) => { event.preventDefault(); run(async () => {
      await authService.register(values); setValues({ ...values, password: '', confirmPassword: '' });
      notify('Conta demonstrativa criada. Nenhuma senha foi armazenada.'); navigate('/home', { replace: true });
    }); }}>
      <div className="auth-fields">{fields.map(([key, label, type, autoComplete]) => <FloatingInput key={key} label={label} type={type} name={key} autoComplete={autoComplete} value={values[key]} error={errors[key]}
        maxLength={key === 'name' ? 100 : 254} required onChange={(event) => setValues({ ...values, [key]: event.target.value })} />)}</div>
      <FormError errors={errors} />
      <Button type="submit" variant="filled" className="auth-submit" disabled={busy}>Cadastrar</Button>
      <Link className="text-link auth-link" to="/login">Entrar em conta existente</Link>
    </form>
  </AuthLayout>;
}

export function LoginPage() {
  const [values, setValues] = useState({ email: '', password: '' });
  const { errors, busy, run } = useFormAction();
  const navigate = useNavigate();
  return <AuthLayout title="Entre na sua conta" variant="login">
    <form noValidate onSubmit={(event) => { event.preventDefault(); run(async () => {
      await authService.login(values); setValues({ ...values, password: '' }); navigate('/home', { replace: true });
    }); }}>
      <div className="auth-fields">
        <FloatingInput label="Insira seu email" name="email" type="email" autoComplete="email" value={values.email} error={errors.email} onChange={(event) => setValues({ ...values, email: event.target.value })} required />
        <FloatingInput label="Insira sua senha" name="password" type="password" autoComplete="current-password" value={values.password} error={errors.password} onChange={(event) => setValues({ ...values, password: event.target.value })} required />
      </div>
      <Link className="text-link forgot-link" to="/forgot-password">Esqueceu sua senha?</Link>
      <FormError errors={errors} />
      <Button type="submit" variant="filled" className="auth-submit" disabled={busy}>Entrar</Button>
      <Link className="text-link auth-link" to="/register">Cadastre-se</Link>
      <p className="login-hint">Demonstração: qualquer e-mail válido e uma senha de 8 caracteres.</p>
    </form>
  </AuthLayout>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState(authService.getRecovery()?.email || '');
  const { errors, busy, run } = useFormAction();
  const navigate = useNavigate();
  return <AuthLayout title="Recupere sua senha" variant="forgot">
    <form noValidate onSubmit={(event) => { event.preventDefault(); run(async () => {
      assertValid(isEmail(email) ? {} : { email: 'Informe um e-mail válido.' });
      await authService.startRecovery(email); navigate('/verify-code');
    }); }}>
      <div className="auth-fields"><FloatingInput label="Insira seu email" name="email" type="email" autoComplete="email" value={email} error={errors.email} required onChange={(event) => setEmail(event.target.value)} /></div>
      <FormError errors={errors} />
      <Button type="submit" variant="filled" className="auth-submit" disabled={busy}>Enviar</Button>
      <Link className="text-link auth-link" to="/login">Voltar</Link>
    </form>
  </AuthLayout>;
}

export function VerifyCodePage() {
  const [digits, setDigits] = useState(Array(5).fill(''));
  const refs = useRef([]);
  const { errors, busy, run } = useFormAction();
  const navigate = useNavigate();
  const notify = useFeedback();
  if (!authService.getRecovery()) return <Navigate to="/forgot-password" replace />;
  const insert = (text, index) => {
    const incoming = text.replace(/\D/g, '').slice(0, 5 - index).split('');
    const next = [...digits];
    if (!incoming.length) next[index] = '';
    incoming.forEach((digit, offset) => { next[index + offset] = digit; });
    setDigits(next);
    refs.current[Math.min(index + incoming.length, 4)]?.focus();
  };
  return <AuthLayout title="Recupere sua senha" variant="verify">
    <form noValidate onSubmit={(event) => { event.preventDefault(); run(async () => { await authService.verifyCode(digits.join('')); navigate('/reset-password'); }); }}>
      <fieldset className="code-field"><legend>Insira o código</legend>
        <div className="code-inputs" onPaste={(event) => { event.preventDefault(); insert(event.clipboardData.getData('text'), 0); }}>
          {digits.map((digit, index) => <input key={index} ref={(element) => { refs.current[index] = element; }} aria-label={`Dígito ${index + 1} do código`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={index === 0 ? 'one-time-code' : 'off'}
            value={digit} maxLength={5} onFocus={(event) => event.target.select()}
            onChange={(event) => insert(event.target.value, index)}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault();
                const at = digits[index] ? index : Math.max(0, index - 1);
                setDigits((previous) => previous.map((value, i) => i === at ? '' : value));
                refs.current[at]?.focus();
              }
              if (event.key === 'ArrowLeft') refs.current[Math.max(0, index - 1)]?.focus();
              if (event.key === 'ArrowRight') refs.current[Math.min(4, index + 1)]?.focus();
            }} />)}
        </div>
      </fieldset>
      <button className="text-link resend-link" type="button" onClick={() => run(async () => { await authService.resendCode(); setDigits(Array(5).fill('')); refs.current[0]?.focus(); notify(`Demonstração: use ${DEMO_CODE}. Nenhum e-mail foi enviado.`); })}>Reenviar código</button>
      <p className="code-hint">Código de demonstração: {DEMO_CODE}.<br />Nenhum e-mail é enviado.</p>
      <FormError errors={errors} />
      <Button type="submit" variant="filled" className="auth-submit" disabled={busy}>Recuperar</Button>
      <Link className="text-link auth-link" to="/forgot-password">Voltar</Link>
    </form>
  </AuthLayout>;
}

export function ResetPasswordPage() {
  const [values, setValues] = useState({ password: '', confirmPassword: '' });
  const { errors, busy, run } = useFormAction();
  const navigate = useNavigate();
  const notify = useFeedback();
  if (!authService.getRecovery()?.verified) return <Navigate to="/forgot-password" replace />;
  return <AuthLayout title="Recupere sua senha" variant="reset">
    <form noValidate onSubmit={(event) => { event.preventDefault(); run(async () => {
      await authService.resetPassword(values); setValues({ password: '', confirmPassword: '' });
      notify('Redefinição simulada. Nenhuma senha foi armazenada.'); navigate('/login', { replace: true });
    }); }}>
      <div className="auth-fields">
        <FloatingInput label="Insira a nova senha" name="password" type="password" autoComplete="new-password" value={values.password} error={errors.password} required onChange={(event) => setValues({ ...values, password: event.target.value })} />
        <FloatingInput label="Repita a nova senha" name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} error={errors.confirmPassword} required onChange={(event) => setValues({ ...values, confirmPassword: event.target.value })} />
      </div>
      <FormError errors={errors} />
      <Button type="submit" variant="filled" className="auth-submit" disabled={busy}>Confirmar</Button>
      <Link className="text-link auth-link" to="/verify-code">Voltar</Link>
    </form>
  </AuthLayout>;
}
