import React, { useState, useEffect } from 'react';
import { OperationsPortal } from './components/OperationsPortal';
import { InstitutionalSite } from './components/InstitutionalSite';
import { AdminPanel } from './components/AdminPanel';
import { ClientWallet } from './components/ClientWallet';
import { PoliciesView } from './components/PoliciesView';

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
    // Default directly to the real operations site with Block Mining and Configuration Panel!
    return 'portal';
  };

  const [currentView, setCurrentView] = useState<AppView>(getInitialView);
  const [activePolicy, setActivePolicy] = useState<'privacidade' | 'termos' | 'cookies' | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#site') setCurrentView('site');
      else if (hash === '#carteira') setCurrentView('wallet');
      else if (hash === '#painel-antigo') setCurrentView('panel');
      else setCurrentView('portal');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <>
      {currentView === 'portal' && (
        <OperationsPortal
          onOpenPolicy={(policy) => setActivePolicy(policy)}
          onOpenSiteModal={() => setCurrentView('site')}
        />
      )}

      {currentView === 'site' && (
        <div>
          {/* Quick bar to return to operations portal */}
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
            <span>Carteira de Teste Regtest BitX Core</span>
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
    </>
  );
}

export default App;
