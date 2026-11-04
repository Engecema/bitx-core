import React, { useEffect, useState } from 'react';
import { LockKeyhole, LogOut, ShieldCheck, UserPlus } from 'lucide-react';
import {
  completeAdminInvitation,
  hasAdminSession,
  inviteAdminAccount,
  signInAsAdmin,
  signOutAdmin,
} from './utils/adminAuth';
import './styles/admin.css';

export const SecureLogin: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [isCompletingInvite, setIsCompletingInvite] = useState(
    () => new URLSearchParams(window.location.search).get('invite') === '1'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void hasAdminSession().then((authorized) => {
      if (active) {
        setIsAdmin(authorized);
        if (authorized) setActiveTab('register');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      await signInAsAdmin(email, password);
      setIsAdmin(true);
      setActiveTab('register');
      setPassword('');
    } catch {
      setError('Credenciais inválidas ou conta sem permissão administrativa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      await inviteAdminAccount(inviteEmail, inviteName);
      setSuccess(`Convite administrativo enviado para ${inviteEmail.trim().toLowerCase()}.`);
      setInviteName('');
      setInviteEmail('');
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Falha ao enviar convite.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      await completeAdminInvitation(newPassword);
      window.history.replaceState({}, '', window.location.pathname);
      setIsCompletingInvite(false);
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Senha definida. A conta administrativa está pronta para uso.');
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Falha ao concluir o convite.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOutAdmin();
    setIsAdmin(false);
    setActiveTab('login');
    setSuccess('');
  };

  return (
    <main className="admin-page-main" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <section className="admin-container" style={{ width: 'min(100%, 440px)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LockKeyhole aria-hidden="true" />
            <div>
              <p style={{ margin: 0 }}>BITX CORE</p>
              <h1 style={{ margin: '4px 0 0' }}>Acesso administrativo</h1>
            </div>
          </div>
          {isAdmin && (
            <button type="button" onClick={handleSignOut} title="Sair" aria-label="Sair">
              <LogOut size={16} />
            </button>
          )}
        </header>

        {isAdmin ? (
          <>
            {isCompletingInvite ? (
              <form onSubmit={handleCompleteInvite}>
                <p>Defina sua senha para concluir o convite administrativo.</p>
                <label htmlFor="new-admin-password">Nova senha</label>
                <input
                  id="new-admin-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
                <label htmlFor="confirm-admin-password">Confirmar senha</label>
                <input
                  id="confirm-admin-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Definir senha'}
                </button>
              </form>
            ) : (
              <>
                <nav aria-label="Opções administrativas" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <button type="button" aria-pressed={activeTab === 'register'} onClick={() => setActiveTab('register')}>
                    <UserPlus size={16} /> Convidar administrador
                  </button>
                  <a href="index.html">Abrir painel</a>
                </nav>
                {activeTab === 'register' && (
              <form onSubmit={handleInviteSubmit}>
                <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={16} /> O convite será enviado por e-mail. A role administrativa é atribuída no servidor.
                </p>
                <label htmlFor="invite-admin-name">Nome</label>
                <input
                  id="invite-admin-name"
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  value={inviteName}
                  onChange={(event) => setInviteName(event.target.value)}
                  required
                />
                <label htmlFor="invite-admin-email">E-mail</label>
                <input
                  id="invite-admin-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                />
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Enviando...' : 'Enviar convite'}
                </button>
              </form>
                )}
              </>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="admin-email">E-mail</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="admin-password">Senha</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Validando...' : 'Entrar'}
            </button>
            <p>O primeiro administrador é provisionado no Supabase. Depois do login, administradores podem convidar outros por esta tela.</p>
          </form>
        )}

        {error && <p role="alert">{error}</p>}
        {success && <p role="status">{success}</p>}
        <p><a href="index.html#site">Voltar ao site</a></p>
      </section>
    </main>
  );
};

export default SecureLogin;