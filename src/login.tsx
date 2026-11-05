import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { LockKeyhole } from 'lucide-react';
import {
  hasAdminSession,
  requestAdminPasswordReset,
  signInAsAdmin,
  updateAdminPassword,
} from './utils/adminAuth';
import './styles/admin.css';

type LoginMode = 'login' | 'request-reset' | 'recovery';

const setAdminSessionMarker = () => {
  sessionStorage.setItem('bitx_admin_session', 'active');
  sessionStorage.setItem('bitx_admin_auth', 'true');
};

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<LoginMode>(() =>
    new URLSearchParams(window.location.search).get('flow') === 'recovery' ? 'recovery' : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let active = true;

    void hasAdminSession()
      .then((isAdmin) => {
        if (!active) return;
        if (mode === 'recovery') {
          if (!isAdmin) {
            setErrorMessage('O link de redefinição expirou ou não é válido. Solicite um novo link.');
            setMode('login');
          }
          setIsCheckingSession(false);
          return;
        }
        if (isAdmin) {
          setAdminSessionMarker();
          window.location.replace('index.html');
          return;
        }
        setIsCheckingSession(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : 'Não foi possível verificar a sessão.');
        setIsCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await signInAsAdmin(email, password);
      setAdminSessionMarker();
      window.location.replace('index.html');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível autenticar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordResetRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      await requestAdminPasswordReset(email);
      setSuccessMessage('Se houver uma conta para esse e-mail, enviaremos um link para redefinir a senha.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível solicitar a redefinição.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (newPassword !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateAdminPassword(newPassword);
      setAdminSessionMarker();
      window.location.replace('index.html');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="admin-theme admin-page-main" style={{ minHeight: '100vh' }}>
      <section className="admin-container" style={{ maxWidth: 440 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <LockKeyhole aria-hidden="true" />
          <div>
            <p style={{ margin: 0 }}>BITX CORE</p>
            <h1 style={{ margin: '4px 0 0' }}>
              {mode === 'recovery' ? 'Redefinir senha' : mode === 'request-reset' ? 'Recuperar acesso' : 'Acesso administrativo'}
            </h1>
          </div>
        </header>

        {isCheckingSession ? (
          <p role="status">Verificando sessão administrativa no Supabase...</p>
        ) : (
          <>
            {mode === 'login' && (
              <form onSubmit={handleSubmit}>
                <div className="admin-form-group">
                  <label htmlFor="admin-email">E-mail</label>
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="admin-password">Senha</label>
                  <input
                    id="admin-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <button className="admin-btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Validando...' : 'Entrar'}
                </button>
                <p style={{ marginBottom: 0 }}>
                  <button
                    className="admin-btn admin-btn-secondary"
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      setSuccessMessage('');
                      setMode('request-reset');
                    }}
                  >
                    Esqueci minha senha
                  </button>
                </p>
              </form>
            )}

            {mode === 'request-reset' && (
              <form onSubmit={handlePasswordResetRequest}>
                <p>Informe o e-mail da conta administrativa para receber o link de redefinição.</p>
                <div className="admin-form-group">
                  <label htmlFor="admin-reset-email">E-mail</label>
                  <input
                    id="admin-reset-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <button className="admin-btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Enviando...' : 'Enviar link de recuperação'}
                </button>
                <p style={{ marginBottom: 0 }}>
                  <button className="admin-btn admin-btn-secondary" type="button" onClick={() => setMode('login')}>
                    Voltar ao login
                  </button>
                </p>
              </form>
            )}

            {mode === 'recovery' && (
              <form onSubmit={handlePasswordUpdate}>
                <div className="admin-form-group">
                  <label htmlFor="admin-new-password">Nova senha</label>
                  <input
                    id="admin-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="admin-confirm-password">Confirme a nova senha</label>
                  <input
                    id="admin-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
                <button className="admin-btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Atualizando...' : 'Atualizar senha'}
                </button>
              </form>
            )}
          </>
        )}

        {errorMessage && (
          <p className="admin-error" role="alert">
            {errorMessage}
          </p>
        )}
        {successMessage && <p role="status">{successMessage}</p>}

        <p style={{ marginTop: 20 }}>
          <a href="index.html#site">Voltar ao site</a>
        </p>
      </section>
    </main>
  );
};

const rootElement = document.getElementById('login-root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <LoginPage />
    </React.StrictMode>
  );
}

export default LoginPage;
