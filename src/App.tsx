import React, { useState, useEffect } from 'react';
import { OperationsPortal } from './components/OperationsPortal';
import { InstitutionalSite } from './components/InstitutionalSite';
import { AdminPanel } from './components/AdminPanel';
import { ClientWallet } from './components/ClientWallet';
import { PoliciesView } from './components/PoliciesView';
import { SecurityLockOverlay } from './components/SecurityLockOverlay';
import { securityGuard, SecurityStatus } from './utils/securityGuard';
import { Lock, ShieldCheck, LogOut } from 'lucide-react';

type AppView = 'portal' | 'site' | 'panel' | 'wallet';

export function App() {
  const getInitialView = (): AppView => {
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();

    if (hash === '#site' || search.includes('view=site')) {
      return 'site';
    }
    if (hash === '#carteira' || search.includes('view=carteira')) {
      return 'wallet';
    }
    if (hash === '#painel-antigo' || search.includes('view=painel-antigo')) {
      return 'panel';
    }
    return 'portal';
  };

  const [currentView, setCurrentView] = useState<AppView>(getInitialView);
  const [activePolicy, setActivePolicy] = useState<'privacidade' | 'termos' | 'cookies' | null>(null);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>(securityGuard.getStatus());
  const [sessionKey, setSessionKey] = useState<number>(1);

  useEffect(() => {
    const unsubscribe = securityGuard.subscribe((status) => {
      setSecurityStatus(status);
    });

    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#site') setCurrentView('site');
      else if (hash === '#carteira') setCurrentView('wallet');
      else if (hash === '#painel-antigo') setCurrentView('panel');
      else setCurrentView('portal');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      unsubscribe();
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleManualLock = () => {
    securityGuard.lock('Bloqueio Manual Solicitado pelo Operador (Zero-State Purge)');
  };

  const handleReinitialize = () => {
    setSessionKey((prev) => prev + 1);
  };

  return (
    <>
      {/* Overlay de Bloqueio Ativo — se bloqueado, todo o estado interno é desmontado da memória */}
      {securityStatus.isLocked && (
        <SecurityLockOverlay
          status={securityStatus}
          onReinitialize={handleReinitialize}
        />
      )}

      {/* Barra Global de Status de Segurança e Ação Rápida de Bloqueio */}
      <div
        style={{
          background: '#070b10',
          borderBottom: '1px solid #1e293b',
          padding: '6px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#94a3b8',
          fontFamily: "'DM Mono', monospace, sans-serif",
          zIndex: 9999,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
            }}
          />
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>BITX CORE SECURITY GUARD:</span>
          <span>BFCache Protection Ativa</span>
          <span style={{ color: '#475569' }}>•</span>
          <span>Anti-Reload Hook Ativo</span>
          <span style={{ color: '#475569' }}>•</span>
          <span>Zero-Persistence Mode</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleManualLock}
            title="Purga imediata de memória, chaves privadas, storage e bloqueio de tela"
            style={{
              background: '#991b1b',
              color: '#fee2e2',
              border: '1px solid #ef4444',
              borderRadius: '4px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Lock size={12} />
            <span>Bloquear Painel (Purge)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.clear();
                localStorage.clear();
              } catch (_) {}
              window.location.replace('login.html');
            }}
            title="Encerrar sessão de administrador, limpar armazenamento e redirecionar para login.html"
            style={{
              background: '#7f1d1d',
              color: '#fecaca',
              border: '1px solid #dc2626',
              borderRadius: '4px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <LogOut size={12} />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Conteúdo dinâmico da SPA com chave de re-inicialização limpa */}
      {!securityStatus.isLocked && (
        <div key={`bitx-session-${sessionKey}`}>
          {currentView === 'portal' && (
            <OperationsPortal
              onOpenPolicy={(policy) => setActivePolicy(policy)}
              onOpenSiteModal={() => setCurrentView('site')}
            />
          )}

          {currentView === 'site' && (
            <div>
              <div
                style={{
                  background: '#0f172a',
                  borderBottom: '1px solid #1e293b',
                  padding: '8px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: '#94a3b8',
                }}
              >
                <span>Visualizando Site Institucional da Rede BitX Core</span>
                <button
                  type="button"
                  onClick={() => setCurrentView('portal')}
                  style={{
                    background: '#f97316',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  &larr; Voltar ao Portal de Operações e Mineração
                </button>
              </div>

              <InstitutionalSite
                onNavigateToPanel={() => setCurrentView('portal')}
                onNavigateToWallet={() => setCurrentView('wallet')}
                onOpenPolicy={(policy) => setActivePolicy(policy)}
              />
            </div>
          )}

          {currentView === 'panel' && (
            <AdminPanel
              onNavigateToSite={() => setCurrentView('portal')}
              onNavigateToWallet={() => setCurrentView('wallet')}
              onOpenPolicy={(policy) => setActivePolicy(policy)}
            />
          )}

          {currentView === 'wallet' && (
            <div>
              <div
                style={{
                  background: '#183b2e',
                  borderBottom: '1px solid #2b5743',
                  padding: '8px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: '#d0dbd1',
                }}
              >
                <span>Carteira de Autocustódia BitX Core (Rede Principal · Mainnet)</span>
                <button
                  type="button"
                  onClick={() => setCurrentView('portal')}
                  style={{
                    background: '#c5ed80',
                    color: '#183b2e',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  &larr; Voltar ao Portal de Operações e Mineração
                </button>
              </div>

              <ClientWallet
                onNavigateToSite={() => setCurrentView('site')}
                onNavigateToPanel={() => setCurrentView('portal')}
              />
            </div>
          )}

          {activePolicy && (
            <PoliciesView
              policy={activePolicy}
              onClose={() => setActivePolicy(null)}
            />
          )}
        </div>
      )}
    </>
  );
}

export default App;
