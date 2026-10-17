import React, { useState, useEffect } from 'react';
import '../styles/admin.css';

interface AdminPanelProps {
  onNavigateToSite: () => void;
  onNavigateToWallet: () => void;
  onOpenPolicy: (policy: 'privacidade' | 'termos' | 'cookies') => void;
}

interface Transaction {
  txid: string;
  amount: number;
  to: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onNavigateToSite,
  onNavigateToWallet,
  onOpenPolicy,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('bitx_admin_session') === 'active';
  });

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('bitx123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Ticker state
  const [price, setPrice] = useState(420.5);
  const [change, setChange] = useState(0.0);

  // Transfer state
  const [txTo, setTxTo] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txAlert, setTxAlert] = useState<{ visible: boolean; message: string; success: boolean }>({
    visible: false,
    message: '',
    success: true,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Users state
  const [users, setUsers] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('bitx_users');
      if (stored) return JSON.parse(stored);
    } catch {}
    return { admin: 'bitx123' };
  });
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      setPrice((prev) => {
        const delta = (Math.random() - 0.48) * 0.45;
        const next = Math.max(10, prev + delta);
        const pct = (delta / next) * 100;
        setChange(pct);
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    const p = password;

    if ((users[u] && users[u] === p) || (u === 'admin' && (p === 'bitx123' || p === 'admin'))) {
      setErrorMessage('');
      sessionStorage.setItem('bitx_admin_session', 'active');
      sessionStorage.setItem('bitx_admin_user', u);
      setIsAuthenticated(true);
    } else {
      setErrorMessage('Usuário ou senha incorretos.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('bitx_admin_session');
    sessionStorage.removeItem('bitx_admin_user');
    setIsAuthenticated(false);
  };

  const handleSendTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txTo.trim() || !txAmount) return;

    const amountNum = parseFloat(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const txid = 'tx_' + Math.random().toString(16).substring(2, 10);
    setTxAlert({
      visible: true,
      message: `Transferência Concluída! ID: ${txid}`,
      success: true,
    });

    setTransactions((prev) => [
      {
        txid,
        amount: amountNum,
        to: txTo.trim(),
      },
      ...prev,
    ]);

    setTxTo('');
    setTxAmount('');
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const u = newUser.trim();
    const p = newPass;
    if (!u || !p) return;

    const updated = { ...users, [u]: p };
    setUsers(updated);
    try {
      localStorage.setItem('bitx_users', JSON.stringify(updated));
    } catch {}

    setNewUser('');
    setNewPass('');
  };

  const handleDeleteUser = (u: string) => {
    if (u === 'admin') {
      alert('O usuário administrador principal não pode ser removido.');
      return;
    }
    if (!confirm(`Deseja remover o usuário "${u}"?`)) return;

    const updated = { ...users };
    delete updated[u];
    setUsers(updated);
    try {
      localStorage.setItem('bitx_users', JSON.stringify(updated));
    } catch {}
  };

  return (
    <div className="admin-theme">
      <main className="admin-page-main">
        <div className="admin-container">
          <div className="admin-quick-nav">
            <button
              type="button"
              className="admin-nav-link admin-nav-link-site"
              onClick={onNavigateToSite}
            >
              &larr; Ir para o Site Institucional
            </button>
            <button
              type="button"
              className="admin-nav-link admin-nav-link-wallet"
              onClick={onNavigateToWallet}
            >
              Acessar Carteira Web &rarr;
            </button>
          </div>

          {!isAuthenticated ? (
            <div id="loginContainer">
              <h1>BitX Core (BTXC)</h1>
              <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>
                Painel de Acesso à Configuração
              </p>

              <div
                style={{
                  background: '#1f2937',
                  borderLeft: '3px solid #f97316',
                  padding: '10px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#d1d5db',
                }}
              >
                <div style={{ marginBottom: '4px' }}>
                  <strong>Fornecimento Máximo:</strong> 1.500.000.000 BTXC
                </div>
                <div>
                  <strong>Rede:</strong> Principal de Produção (Mainnet) &bull; Global Exchange
                </div>
              </div>

              <form onSubmit={handleLogin}>
                <div className="admin-form-group">
                  <label htmlFor="username">Usuário Administrador</label>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="password">Senha de Segurança</label>
                  <div className="admin-password-field-group">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="admin-toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar Senha' : 'Mostrar Senha'}
                      title={showPassword ? 'Ocultar Senha' : 'Mostrar Senha'}
                    >
                      {showPassword ? (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      ) : (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <button type="submit" className="admin-btn">
                  Conectar à Rede
                </button>
                {errorMessage && <div className="admin-error">{errorMessage}</div>}
              </form>
            </div>
          ) : (
            <div id="dashboardContainer">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #1f2937',
                  paddingBottom: '12px',
                  marginBottom: '20px',
                }}
              >
                <h1 style={{ border: 'none', margin: 0, padding: 0 }}>Painel de Controle</h1>
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  Desconectar
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>COTAÇÃO BTXC</div>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 'bold',
                      marginTop: '4px',
                      color: '#10b981',
                    }}
                  >
                    R$ {price.toFixed(4)}
                  </div>
                </div>
                <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>VARIAÇÃO 24H</div>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 'bold',
                      marginTop: '4px',
                      color: change >= 0 ? '#10b981' : '#ef4444',
                    }}
                  >
                    {change >= 0 ? '+ ' : ''}
                    {change.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: '#1f2937',
                  padding: '16px',
                  borderRadius: '6px',
                  marginBottom: '20px',
                }}
              >
                <h3 style={{ marginTop: 0, fontSize: '14px', marginBottom: '12px' }}>
                  Transferência Rápida
                </h3>
                <form onSubmit={handleSendTransfer}>
                  <div className="admin-form-group">
                    <input
                      type="text"
                      placeholder="Endereço de Destino (ex: btxc1q...)"
                      value={txTo}
                      onChange={(e) => setTxTo(e.target.value)}
                      style={{ marginBottom: '8px' }}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Quantidade (BTXC)"
                      step="0.00000001"
                      min="0.00000001"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      required
                    />
                  </div>
                  <button className="admin-btn" type="submit">
                    Enviar BTXC
                  </button>
                </form>

                {txAlert.visible && (
                  <div
                    style={{
                      fontSize: '12px',
                      marginTop: '8px',
                      color: txAlert.success ? '#10b981' : '#ef4444',
                    }}
                  >
                    {txAlert.message}
                  </div>
                )}

                <div style={{ marginTop: '14px', fontSize: '12px', color: '#9ca3af' }}>
                  Últimas Transações:
                </div>
                <div style={{ marginTop: '6px', fontSize: '11px' }}>
                  {transactions.length === 0 ? (
                    <div style={{ color: '#6b7280', padding: '4px 0' }}>
                      Nenhuma transação efetuada nesta sessão.
                    </div>
                  ) : (
                    transactions.map((tx) => (
                      <div
                        key={tx.txid}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          borderBottom: '1px solid #374151',
                        }}
                      >
                        <span title={tx.to}>
                          {tx.txid}...{tx.txid.slice(-4)}
                        </span>
                        <span style={{ color: '#10b981' }}>+ {tx.amount.toFixed(8)} BTXC</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 style={{ marginTop: 0, fontSize: '14px', marginBottom: '8px' }}>
                  Gerenciar Acessos
                </h3>
                <div style={{ marginBottom: '12px' }}>
                  {Object.keys(users).map((u) => (
                    <div key={u} className="admin-user-item">
                      <span>{u}</span>
                      <button
                        type="button"
                        className="admin-btn-del"
                        onClick={() => handleDeleteUser(u)}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSaveUser}>
                  <div className="admin-form-group">
                    <input
                      type="text"
                      placeholder="Novo usuário"
                      value={newUser}
                      onChange={(e) => setNewUser(e.target.value)}
                      style={{ marginBottom: '6px' }}
                      required
                    />
                    <div className="admin-password-field-group">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        placeholder="Senha do novo usuário"
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="admin-toggle-password"
                        onClick={() => setShowNewPass(!showNewPass)}
                        aria-label={showNewPass ? 'Ocultar Senha' : 'Mostrar Senha'}
                        title={showNewPass ? 'Ocultar Senha' : 'Mostrar Senha'}
                      >
                        {showNewPass ? (
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <button className="admin-btn admin-btn-secondary" type="submit">
                    Adicionar Novo Usuário
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="admin-page-footer">
        <div className="admin-footer-brand">BitX Core &bull; Rede Regtest</div>
        <nav className="admin-footer-policies" aria-label="Políticas e termos">
          <button type="button" onClick={() => onOpenPolicy('privacidade')}>
            Política de Privacidade
          </button>
          <button type="button" onClick={() => onOpenPolicy('termos')}>
            Termos de Uso
          </button>
          <button type="button" onClick={() => onOpenPolicy('cookies')}>
            Política de Cookies
          </button>
        </nav>
      </footer>
    </div>
  );
};
