import React, { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { signInAsAdmin } from '../utils/adminAuth';
import { securityGuard, type SecurityStatus } from '../utils/securityGuard';

interface SecurityLockOverlayProps {
  status: SecurityStatus;
  onReinitialize: () => void;
}

export const SecurityLockOverlaySecure: React.FC<SecurityLockOverlayProps> = ({ status, onReinitialize }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signInAsAdmin(email, password);
      securityGuard.unlock();
      onReinitialize();
    } catch {
      setError('Credenciais inválidas ou conta sem permissão administrativa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="lock-title" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', padding: 20, background: '#070b10', color: '#e5edf2' }}>
      <form onSubmit={handleUnlock} style={{ width: 'min(100%, 420px)', display: 'grid', gap: 14 }}>
        <LockKeyhole size={28} aria-hidden="true" />
        <h1 id="lock-title" style={{ margin: 0, fontSize: 22 }}>Painel bloqueado</h1>
        {status.lockReason && <p>{status.lockReason}</p>}
        <label htmlFor="unlock-email">E-mail administrativo</label>
        <input id="unlock-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label htmlFor="unlock-password">Senha</label>
        <input id="unlock-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Validando...' : 'Desbloquear'}</button>
      </form>
    </div>
  );
};