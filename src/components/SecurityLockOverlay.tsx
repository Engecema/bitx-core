import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  RefreshCw,
  Lock,
  CheckCircle2,
  Terminal,
  KeyRound,
  User,
  UserPlus,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
  Fingerprint,
  HardDrive,
  FileCode,
  Edit3,
} from 'lucide-react';
import { securityGuard, SecurityStatus } from '../utils/securityGuard';
import { persistentVault, GeneralAdminRecord } from '../utils/persistentVault';

interface SecurityLockOverlayProps {
  status: SecurityStatus;
  onReinitialize: () => void;
}

type OverlayScreen = 'locked_summary' | 'auth_tree';
type AuthTab = 'login' | 'register_admin';

export const SecurityLockOverlay: React.FC<SecurityLockOverlayProps> = ({
  status,
  onReinitialize,
}) => {
  // Controle de tela e montagem limpa da árvore de componentes
  const [screen, setScreen] = useState<OverlayScreen>('locked_summary');
  const [treeInstanceKey, setTreeInstanceKey] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  // Estado do cofre persistente desktop / Electron
  const [vaultAdmin, setVaultAdmin] = useState<GeneralAdminRecord | null>(null);
  const [vaultInitialized, setVaultInitialized] = useState(false);

  // Provedor e modo de rede
  const [providerMode, setProviderMode] = useState<'mainnet' | 'local_rpc'>('mainnet');
  const [customRpcUrl, setCustomRpcUrl] = useState('http://127.0.0.1:8332');

  // Estado da aba 'Acessar Painel' (Login/Senha) — Limpo, editável e SEM credenciais hardcoded
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Estado da aba 'Cadastrar Administrador Geral' (Pessoal) — Totalmente editável
  const [regFullName, setRegFullName] = useState('');
  const [regDocument, setRegDocument] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  // Estados de feedback de validação e carregamento
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sincronizar dados do cofre ao carregar
  useEffect(() => {
    let isMounted = true;
    persistentVault.ready().then(() => {
      if (!isMounted) return;
      const admin = persistentVault.getGeneralAdmin();
      setVaultAdmin(admin);
      setVaultInitialized(true);

      // Se já houver um admin cadastrado, preenche os campos de cadastro para facilitar a edição
      if (admin) {
        setRegFullName(admin.name);
        setRegDocument(admin.document);
        setRegEmail(admin.email);
        setRegUsername(admin.username);
        setIsEditingExisting(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [treeInstanceKey]);

  /**
   * Disparado quando o operador clica em:
   * "Re-inicializar Sessão e Desbloquear Painel BitX Core"
   * Monta a árvore de autenticação do zero com chave limpa e estado volátil isolado.
   */
  const handleStartReinitialization = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setTreeInstanceKey((prev) => prev + 1);
      setAuthError(null);
      setAuthSuccess(null);
      setScreen('auth_tree');

      // Se não há admin registrado no cofre, direciona inteligentemente para o cadastro
      const currentAdmin = persistentVault.getGeneralAdmin();
      if (!currentAdmin) {
        setActiveTab('register_admin');
      } else {
        setActiveTab('login');
      }

      setIsProcessing(false);
    }, 400);
  };

  /**
   * Conclui a autenticação, registra sessão e desbloqueia o painel
   */
  const finalizeUnlock = (operatorName: string, username: string, role: string) => {
    try {
      if (providerMode === 'local_rpc' && customRpcUrl) {
        sessionStorage.setItem('bitx_ephemeral_rpc', customRpcUrl);
      }
      sessionStorage.setItem('bitx_admin_session', 'active');
      sessionStorage.setItem(
        'bitx_operator_session',
        JSON.stringify({
          name: operatorName,
          username,
          role,
          provider: providerMode,
          authenticatedAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.warn('[BitX Auth] Armazenamento de sessão volátil:', e);
    }

    securityGuard.unlock();
    onReinitialize();
  };

  /**
   * Submissão da Aba "Acessar Painel" (Login/Senha)
   * Valida estritamente contra o cofre desktop persistido (IndexedDB / Electron JSON)
   */
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const userClean = loginUsername.trim();
    const passClean = loginPassword;

    if (!userClean || !passClean) {
      setAuthError('Informe o usuário e a senha para autenticação do operador.');
      return;
    }

    setIsProcessing(true);

    try {
      // Validação estrita contra o cofre persistido
      const validation = await persistentVault.validateAdminLogin(userClean, passClean);

      if (validation.valid && validation.admin) {
        const admin = validation.admin;
        setAuthSuccess(`Autenticação confirmada para ${admin.name} (Administrador Geral). Desbloqueando...`);
        setTimeout(() => {
          finalizeUnlock(admin.name, admin.username, admin.role);
        }, 500);
      } else {
        setIsProcessing(false);
        setAuthError(
          validation.reason ||
            'Credenciais inválidas. Verifique o usuário e senha ou cadastre um Administrador Geral.'
        );
      }
    } catch (err: any) {
      setIsProcessing(false);
      setAuthError('Falha ao comunicar com o cofre desktop de credenciais.');
    }
  };

  /**
   * Submissão da Aba "Cadastrar Administrador Geral" (Pessoal)
   * Salva e persiste os dados de forma permanente no ambiente desktop (Electron / IndexedDB)
   */
  const handleRegisterAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const name = regFullName.trim();
    const doc = regDocument.trim();
    const email = regEmail.trim();
    const user = regUsername.trim();
    const pass = regPassword.trim();
    const passConfirm = regPasswordConfirm.trim();

    if (!name || !email || !user) {
      setAuthError('Nome Completo, E-mail e Usuário são obrigatórios.');
      return;
    }

    // Se estiver criando novo ou alterando senha
    if (!isEditingExisting || pass.length > 0) {
      if (pass.length < 6) {
        setAuthError('A senha do Administrador Geral deve conter no mínimo 6 caracteres.');
        return;
      }

      if (pass !== passConfirm) {
        setAuthError('A confirmação de senha não coincide com a senha mestra informada.');
        return;
      }
    }

    setIsProcessing(true);

    try {
      const savedRecord = await persistentVault.saveGeneralAdmin({
        name,
        username: user,
        email,
        document: doc || 'Identificação Pessoal / Oficial',
        password: pass || undefined,
      });

      setVaultAdmin(savedRecord);
      setIsEditingExisting(true);

      setAuthSuccess(
        `Administrador Geral "${savedRecord.name}" gravado com sucesso no arquivo seguro do app! Desbloqueando painel...`
      );

      setTimeout(() => {
        finalizeUnlock(savedRecord.name, savedRecord.username, savedRecord.role);
      }, 600);
    } catch (err: any) {
      setIsProcessing(false);
      setAuthError(err.message || 'Erro ao persistir o Administrador Geral no cofre desktop.');
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: '#111111',
        backgroundImage: 'radial-gradient(circle at 50% 20%, #222222 0%, #111111 80%)',
        color: '#f1f5f9',
        fontFamily: "'DM Mono', monospace, -apple-system, sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflowY: 'auto',
      }}
    >
      {/* TELA 1: Resumo do Bloqueio e Gatilho de Re-inicialização */}
      {screen === 'locked_summary' && (
        <div
          style={{
            width: '100%',
            maxWidth: '680px',
            background: '#111111',
            border: '1px solid #222222',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95), 0 0 40px rgba(239, 68, 68, 0.15)',
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
          <div style={{ padding: '24px 28px', background: '#111111' }}>
            {/* Reason Alert */}
            <div
              style={{
                background: '#222222',
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
                <div
                  style={{
                    fontSize: '12px',
                    color: '#fca5a5',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
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

            {/* Status do Cofre Persistente Desktop */}
            <div
              style={{
                background: '#222222',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <HardDrive size={18} color="#22c55e" />
                <div>
                  <div style={{ color: '#ffffff', fontWeight: 600 }}>
                    Cofre Desktop Local (admin_general.json)
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                    {vaultAdmin
                      ? `Administrador Geral ativo: ${vaultAdmin.name} (@${vaultAdmin.username})`
                      : 'Nenhum administrador registrado ainda (configure na re-inicialização)'}
                  </div>
                </div>
              </div>
              <div
                style={{
                  background: vaultAdmin ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                  color: vaultAdmin ? '#22c55e' : '#eab308',
                  border: `1px solid ${vaultAdmin ? '#22c55e' : '#eab308'}`,
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontWeight: 600,
                }}
              >
                {vaultAdmin ? 'COFRE PERSISTIDO' : 'AGUARDANDO CADASTRO'}
              </div>
            </div>

            {/* Checklist de Preservação */}
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
                Protocolo de Purga Volátil & Preservação do Cofre
              </div>
              <div
                style={{
                  background: '#222222',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12px',
                    color: '#cbd5e1',
                  }}
                >
                  <CheckCircle2 size={16} color="#22c55e" />
                  <span>
                    <strong>Cofre do Administrador Geral:</strong> Persistência em arquivo desktop JSON
                    / IndexedDB protegida contra limpeza de storage e unmount.
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12px',
                    color: '#cbd5e1',
                  }}
                >
                  <CheckCircle2 size={16} color="#22c55e" />
                  <span>
                    <strong>Sessões & Chaves Privadas Voláteis:</strong> Destruídas imediatamente da
                    memória (Zero-State Purge).
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12px',
                    color: '#cbd5e1',
                  }}
                >
                  <CheckCircle2 size={16} color="#22c55e" />
                  <span>
                    <strong>Autenticação Limpa:</strong> Sem credenciais hardcoded. Login valida
                    diretamente contra o registro persistido.
                  </span>
                </div>
              </div>
            </div>

            {/* Botão Principal de Ação que dispara a montagem da árvore de autenticação do zero */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={handleStartReinitialization}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  background: isProcessing
                    ? '#334155'
                    : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '14px 20px',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 14px rgba(234, 88, 12, 0.4)',
                }}
              >
                <RefreshCw size={18} className={isProcessing ? 'animate-spin' : ''} />
                <span>
                  {isProcessing
                    ? 'Preparando Ambiente & Montando Árvore Limpa...'
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
                Monta a árvore de autenticação do zero conectada ao arquivo seguro de credenciais
                do app.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TELA 2: ÁRVORE DE AUTENTICAÇÃO MONTADA DO ZERO (FUNDO #111 E #222) */}
      {screen === 'auth_tree' && (
        <div
          key={`bitx-auth-tree-instance-${treeInstanceKey}`}
          style={{
            width: '100%',
            maxWidth: '660px',
            background: '#111111',
            border: '1px solid #222222',
            borderRadius: '12px',
            boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.95), 0 0 35px rgba(249, 115, 22, 0.12)',
            overflow: 'hidden',
          }}
        >
          {/* Header Superior da Interface de Autenticação */}
          <div
            style={{
              background: '#222222',
              borderBottom: '1px solid #2f2f2f',
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  background: '#f97316',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 0 12px rgba(249, 115, 22, 0.4)',
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}
                >
                  BitX Core — Autenticação de Operador
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: '11px',
                    color: '#94a3b8',
                  }}
                >
                  Cofre Desktop: <code>~/.bitx/vault/admin_general.json</code> • Sistema Limpo & Editável
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setScreen('locked_summary')}
              title="Voltar ao relatório de purga"
              style={{
                background: '#111111',
                border: '1px solid #2f2f2f',
                color: '#94a3b8',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ArrowLeft size={13} />
              <span>Voltar</span>
            </button>
          </div>

          {/* Abas Internas Dinâmicas (#111 e #222) */}
          <div
            style={{
              background: '#111111',
              borderBottom: '1px solid #222222',
              padding: '8px 24px 0 24px',
              display: 'flex',
              gap: '10px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setAuthError(null);
                setAuthSuccess(null);
              }}
              style={{
                flex: 1,
                background: activeTab === 'login' ? '#222222' : 'transparent',
                color: activeTab === 'login' ? '#f97316' : '#94a3b8',
                border: '1px solid',
                borderColor: activeTab === 'login' ? '#333333 #333333 #222222 #333333' : 'transparent',
                borderBottom: activeTab === 'login' ? '2px solid #f97316' : '1px solid transparent',
                borderRadius: '8px 8px 0 0',
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <User size={16} />
              <span>Acessar Painel (Login/Senha)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('register_admin');
                setAuthError(null);
                setAuthSuccess(null);
              }}
              style={{
                flex: 1,
                background: activeTab === 'register_admin' ? '#222222' : 'transparent',
                color: activeTab === 'register_admin' ? '#f97316' : '#94a3b8',
                border: '1px solid',
                borderColor:
                  activeTab === 'register_admin' ? '#333333 #333333 #222222 #333333' : 'transparent',
                borderBottom:
                  activeTab === 'register_admin' ? '2px solid #f97316' : '1px solid transparent',
                borderRadius: '8px 8px 0 0',
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              {isEditingExisting ? <Edit3 size={16} /> : <UserPlus size={16} />}
              <span>
                {isEditingExisting
                  ? 'Editar Administrador Geral (Pessoal)'
                  : 'Cadastrar Administrador Geral (Pessoal)'}
              </span>
            </button>
          </div>

          {/* Corpo do Formulário com Fundo Escuro #111 e #222 */}
          <div style={{ padding: '24px 28px', background: '#111111' }}>
            {/* Mensagem de Erro Inline */}
            {authError && (
              <div
                style={{
                  background: '#222222',
                  border: '1px solid #ef4444',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  color: '#fca5a5',
                  fontSize: '12px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{authError}</span>
              </div>
            )}

            {/* Mensagem de Sucesso Inline */}
            {authSuccess && (
              <div
                style={{
                  background: '#222222',
                  border: '1px solid #22c55e',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  color: '#86efac',
                  fontSize: '12px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <CheckCircle2 size={16} color="#22c55e" style={{ flexShrink: 0 }} />
                <span>{authSuccess}</span>
              </div>
            )}

            {/* ABA 1: ACESSAR PAINEL (LOGIN/SENHA) */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} autoComplete="off">
                {/* Dica informativa se o cofre estiver vazio */}
                {!vaultAdmin && (
                  <div
                    style={{
                      background: '#222222',
                      border: '1px solid #eab308',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      marginBottom: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <AlertCircle size={18} color="#eab308" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '11px', color: '#fef08a' }}>
                      Nenhum Administrador Geral encontrado no cofre persistente local. Clique na aba{' '}
                      <strong>"Cadastrar Administrador Geral (Pessoal)"</strong> para definir a
                      credencial mestre do sistema.
                    </div>
                  </div>
                )}

                {/* Indicação de credencial registrada no cofre */}
                {vaultAdmin && (
                  <div
                    style={{
                      background: '#222222',
                      border: '1px solid #2a2a2a',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                      <HardDrive size={14} color="#f97316" />
                      <span>
                        Administrador no cofre: <strong style={{ color: '#ffffff' }}>{vaultAdmin.name}</strong> (@{vaultAdmin.username})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLoginUsername(vaultAdmin.username)}
                      style={{
                        background: '#111111',
                        border: '1px solid #333333',
                        color: '#f97316',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      Preencher Usuário
                    </button>
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label
                    htmlFor="bitx-login-user"
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      color: '#cbd5e1',
                      fontWeight: 600,
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Usuário / Operador
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="bitx-login-user"
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Informe o usuário cadastrado no cofre"
                      autoComplete="off"
                      spellCheck={false}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: '#222222',
                        border: '1px solid #333333',
                        borderRadius: '6px',
                        padding: '12px 14px 12px 38px',
                        color: '#ffffff',
                        fontSize: '13px',
                        outline: 'none',
                        fontFamily: "'DM Mono', monospace, sans-serif",
                      }}
                    />
                    <User
                      size={16}
                      color="#94a3b8"
                      style={{ position: 'absolute', left: '12px', top: '13px' }}
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Validação em tempo real contra o arquivo local <code>admin_general.json</code>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label
                    htmlFor="bitx-login-pass"
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      color: '#cbd5e1',
                      fontWeight: 600,
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Senha de Acesso Mestra
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="bitx-login-pass"
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Informe sua senha cadastrada"
                      autoComplete="off"
                      spellCheck={false}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: '#222222',
                        border: '1px solid #333333',
                        borderRadius: '6px',
                        padding: '12px 42px 12px 38px',
                        color: '#ffffff',
                        fontSize: '13px',
                        outline: 'none',
                        fontFamily: "'DM Mono', monospace, sans-serif",
                      }}
                    />
                    <KeyRound
                      size={16}
                      color="#94a3b8"
                      style={{ position: 'absolute', left: '12px', top: '13px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '10px',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title={showLoginPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Seleção de Conexão Blockchain */}
                <div
                  style={{
                    background: '#222222',
                    border: '1px solid #2a2a2a',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    marginBottom: '20px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#94a3b8',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      marginBottom: '8px',
                    }}
                  >
                    Canal de Provedor Blockchain
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setProviderMode('mainnet')}
                      style={{
                        background: providerMode === 'mainnet' ? '#111111' : '#222222',
                        border: `1px solid ${providerMode === 'mainnet' ? '#f97316' : '#333333'}`,
                        borderRadius: '6px',
                        padding: '8px 10px',
                        color: providerMode === 'mainnet' ? '#f97316' : '#94a3b8',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <KeyRound size={13} />
                      <span>BTXC Mainnet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProviderMode('local_rpc')}
                      style={{
                        background: providerMode === 'local_rpc' ? '#111111' : '#222222',
                        border: `1px solid ${providerMode === 'local_rpc' ? '#38bdf8' : '#333333'}`,
                        borderRadius: '6px',
                        padding: '8px 10px',
                        color: providerMode === 'local_rpc' ? '#38bdf8' : '#94a3b8',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Terminal size={13} />
                      <span>Daemon RPC Local</span>
                    </button>
                  </div>
                  {providerMode === 'local_rpc' && (
                    <input
                      type="text"
                      value={customRpcUrl}
                      onChange={(e) => setCustomRpcUrl(e.target.value)}
                      placeholder="http://127.0.0.1:8332"
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        boxSizing: 'border-box',
                        background: '#111111',
                        border: '1px solid #333333',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        color: '#f8fafc',
                        fontSize: '11px',
                        fontFamily: "'DM Mono', monospace, sans-serif",
                      }}
                    />
                  )}
                </div>

                {/* Botão de Envio Login */}
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    width: '100%',
                    background: isProcessing
                      ? '#334155'
                      : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '13px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)',
                  }}
                >
                  <Lock size={16} />
                  <span>
                    {isProcessing ? 'Validando no Cofre Desktop...' : 'Autenticar e Entrar no Painel'}
                  </span>
                </button>
              </form>
            )}

            {/* ABA 2: CADASTRAR / EDITAR ADMINISTRADOR GERAL (PESSOAL) */}
            {activeTab === 'register_admin' && (
              <form onSubmit={handleRegisterAdminSubmit} autoComplete="off">
                <div
                  style={{
                    background: '#222222',
                    border: '1px solid #2a2a2a',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Fingerprint size={20} color="#f97316" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                      {isEditingExisting ? (
                        <span>
                          Editando registro persistido de <strong>Administrador Geral</strong> (salvo
                          em <code>admin_general.json</code>).
                        </span>
                      ) : (
                        <span>
                          Cadastro mestre de <strong>Administrador Geral (Pessoal)</strong> com autoridade
                          root e persistência resiliente.
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#22c55e',
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid #22c55e',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    COFRE LOCAL ATIVO
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <label
                      htmlFor="bitx-reg-name"
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        color: '#94a3b8',
                        fontWeight: 600,
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Nome Completo (Pessoal) *
                    </label>
                    <input
                      id="bitx-reg-name"
                      type="text"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="Nome do Administrador Geral"
                      autoComplete="off"
                      spellCheck={false}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: '#222222',
                        border: '1px solid #333333',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontFamily: "'DM Mono', monospace, sans-serif",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="bitx-reg-doc"
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        color: '#94a3b8',
                        fontWeight: 600,
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Documento / CPF / Matrícula
                    </label>
                    <input
                      id="bitx-reg-doc"
                      type="text"
                      value={regDocument}
                      onChange={(e) => setRegDocument(e.target.value)}
                      placeholder="CPF ou Matrícula Pessoal"
                      autoComplete="off"
                      spellCheck={false}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: '#222222',
                        border: '1px solid #333333',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontFamily: "'DM Mono', monospace, sans-serif",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <label
                      htmlFor="bitx-reg-email"
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        color: '#94a3b8',
                        fontWeight: 600,
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      E-mail Institucional / Pessoal *
                    </label>
                    <input
                      id="bitx-reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="email@dominio.com"
                      autoComplete="off"
                      spellCheck={false}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: '#222222',
                        border: '1px solid #333333',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontFamily: "'DM Mono', monospace, sans-serif",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="bitx-reg-username"
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        color: '#94a3b8',
                        fontWeight: 600,
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Usuário de Acesso Operacional *
                    </label>
                    <input
                      id="bitx-reg-username"
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="ex: operador_mestre"
                      autoComplete="off"
                      spellCheck={false}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: '#222222',
                        border: '1px solid #333333',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontFamily: "'DM Mono', monospace, sans-serif",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '20px',
                  }}
                >
                  <div>
                    <label
                      htmlFor="bitx-reg-password"
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        color: '#94a3b8',
                        fontWeight: 600,
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isEditingExisting ? 'Nova Senha Mestra (Deixe em branco para manter)' : 'Senha Mestra (Mín. 6 caracteres) *'}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="bitx-reg-password"
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder={isEditingExisting ? 'Manter senha atual' : '••••••••'}
                        autoComplete="off"
                        spellCheck={false}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          background: '#222222',
                          border: '1px solid #333333',
                          borderRadius: '6px',
                          padding: '10px 36px 10px 12px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontFamily: "'DM Mono', monospace, sans-serif",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword((prev) => !prev)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '8px',
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '2px',
                        }}
                        title={showRegPassword ? 'Ocultar' : 'Exibir'}
                      >
                        {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="bitx-reg-confirm"
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        color: '#94a3b8',
                        fontWeight: 600,
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Confirmar Senha
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="bitx-reg-confirm"
                        type={showRegConfirm ? 'text' : 'password'}
                        value={regPasswordConfirm}
                        onChange={(e) => setRegPasswordConfirm(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="off"
                        spellCheck={false}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          background: '#222222',
                          border: '1px solid #333333',
                          borderRadius: '6px',
                          padding: '10px 36px 10px 12px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontFamily: "'DM Mono', monospace, sans-serif",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirm((prev) => !prev)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '8px',
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '2px',
                        }}
                        title={showRegConfirm ? 'Ocultar' : 'Exibir'}
                      >
                        {showRegConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Botão de Envio Cadastro */}
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    width: '100%',
                    background: isProcessing
                      ? '#334155'
                      : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '13px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                  }}
                >
                  <UserPlus size={16} />
                  <span>
                    {isProcessing
                      ? 'Persistindo no Arquivo do App...'
                      : isEditingExisting
                      ? 'Salvar Alterações e Inicializar Painel'
                      : 'Cadastrar Administrador Geral e Inicializar Painel'}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
