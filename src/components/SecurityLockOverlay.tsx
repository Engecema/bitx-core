import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, Lock, CheckCircle2, Terminal, AlertTriangle, KeyRound } from 'lucide-react';
import { securityGuard, SecurityStatus } from '../utils/securityGuard';

interface SecurityLockOverlayProps {
  status: SecurityStatus;
  onReinitialize: () => void;
}

export const SecurityLockOverlay: React.FC<SecurityLockOverlayProps> = ({ status, onReinitialize }) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [providerMode, setProviderMode] = useState<'mainnet' | 'local_rpc'>('mainnet');
  const [customRpcUrl, setCustomRpcUrl] = useState('http://127.0.0.1:8332');

  const handleUnlock = () => {
    setIsInitializing(true);
    setTimeout(() => {
      // Registrar configuração efêmera se fornecida
      if (providerMode === 'local_rpc' && customRpcUrl) {
        try {
          sessionStorage.setItem('bitx_ephemeral_rpc', customRpcUrl);
        } catch {}
      }
      securityGuard.unlock();
      onReinitialize();
      setIsInitializing(false);
    }, 600);
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: '#05070a',
        backgroundImage: 'radial-gradient(circle at 50% 20%, #111a24 0%, #05070a 80%)',
        color: '#f1f5f9',
        fontFamily: "'DM Mono', monospace, -apple-system, sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          background: '#0b1118',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 40px rgba(239, 68, 68, 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Top Security Banner */}
        <div
          style={{
            background: 'linear-gradient(90deg, #7f1d1d 0%, #450a0a 100%)',
            borderBottom: '1px solid #991b1b',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <Lock size={20} />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: '#fee2e2',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              BitX Core — Painel Desconectado / Bloqueado
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                color: '#fca5a5',
              }}
            >
              Mecanismo de Defesa Ativo • Isolamento de Memória & Anti-Forensics
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px 28px' }}>
          {/* Reason Alert */}
          <div
            style={{
              background: '#181216',
              border: '1px solid #3f1a24',
              borderRadius: '8px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <ShieldAlert size={20} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '12px', color: '#fca5a5', fontWeight: 600, textTransform: 'uppercase' }}>
                Motivo do Disparo de Segurança
              </div>
              <div style={{ fontSize: '13px', color: '#fecaca', marginTop: '3px' }}>
                {status.lockReason || 'Bloqueio Preventivo de Estado'}
              </div>
              {status.lockedAt && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  Timestamp: {new Date(status.lockedAt).toLocaleString('pt-BR')} (UTC-3)
                </div>
              )}
            </div>
          </div>

          {/* Audit Checklist */}
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                fontWeight: 600,
                textTransform: 'uppercase',
                marginBottom: '10px',
                letterSpacing: '0.5px',
              }}
            >
              Protocolo de Purga Executado
            </div>
            <div
              style={{
                background: '#070b10',
                border: '1px solid #162232',
                borderRadius: '8px',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color="#22c55e" />
                <span><strong>LocalStorage & SessionStorage:</strong> Sanitizados com ruído randômico (CSPRNG) e limpos (.clear()).</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color="#22c55e" />
                <span><strong>Chaves Privadas & Seeds em Memória:</strong> Referências destruídas e instâncias React desmontadas.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color="#22c55e" />
                <span><strong>Canais RPC e Sincronização:</strong> Sinais de cancelamento (AbortSignal) disparados para a rede.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#cbd5e1' }}>
                <CheckCircle2 size={16} color="#22c55e" />
                <span><strong>Proteção BFCache & Reload:</strong> Histórico e cache de páginas neutralizados pelo ciclo do navegador.</span>
              </div>
            </div>
          </div>

          {/* Provider Injection Section */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                color: '#94a3b8',
                fontWeight: 600,
                textTransform: 'uppercase',
                marginBottom: '8px',
                letterSpacing: '0.5px',
              }}
            >
              Provedor Blockchain para Re-injeção
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setProviderMode('mainnet')}
                style={{
                  background: providerMode === 'mainnet' ? '#1e293b' : '#070b10',
                  border: `1px solid ${providerMode === 'mainnet' ? '#38bdf8' : '#1e293b'}`,
                  borderRadius: '6px',
                  padding: '10px 14px',
                  color: providerMode === 'mainnet' ? '#38bdf8' : '#94a3b8',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <KeyRound size={16} />
                <span>Rede Principal (BTXC Mainnet)</span>
              </button>

              <button
                type="button"
                onClick={() => setProviderMode('local_rpc')}
                style={{
                  background: providerMode === 'local_rpc' ? '#1e293b' : '#070b10',
                  border: `1px solid ${providerMode === 'local_rpc' ? '#f59e0b' : '#1e293b'}`,
                  borderRadius: '6px',
                  padding: '10px 14px',
                  color: providerMode === 'local_rpc' ? '#f59e0b' : '#94a3b8',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Terminal size={16} />
                <span>Nó RPC Local / Daemon</span>
              </button>
            </div>

            {providerMode === 'local_rpc' && (
              <div style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  value={customRpcUrl}
                  onChange={(e) => setCustomRpcUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8332"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#070b10',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
              </div>
            )}
          </div>

          {/* Action Unlock Button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={handleUnlock}
              disabled={isInitializing}
              style={{
                width: '100%',
                background: isInitializing
                  ? '#334155'
                  : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '14px 20px',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                cursor: isInitializing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)',
              }}
            >
              <RefreshCw size={18} className={isInitializing ? 'animate-spin' : ''} />
              <span>
                {isInitializing
                  ? 'Re-injetando Provedor Blockchain & Inicializando...'
                  : 'Re-inicializar Sessão e Desbloquear Painel BitX Core'}
              </span>
            </button>

            <div
              style={{
                textAlign: 'center',
                fontSize: '11px',
                color: '#64748b',
                marginTop: '4px',
              }}
            >
              Esta ação cria uma sessão volátil isolada e monta a árvore de componentes do zero.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
