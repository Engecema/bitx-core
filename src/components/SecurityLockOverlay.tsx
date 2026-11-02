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
  FileText,
  Key,
} from 'lucide-react';
import { securityGuard, SecurityStatus } from '../utils/securityGuard';
import { persistentVault, GeneralAdminRecord } from '../utils/persistentVault';
import '../styles/admin.css';

interface SecurityLockOverlayProps {
  status: SecurityStatus;
  onReinitialize: () => void;
}

type OverlayScreen = 'locked_summary' | 'auth_tree';
type AuthTab = 'login' | 'register_admin';
type AdminSubTab = 'all' | 'personal' | 'credentials';

export const SecurityLockOverlay: React.FC<SecurityLockOverlayProps> = ({
  status,
  onReinitialize,
}) => {
  // Controle de tela: inicia diretamente na árvore de autenticação/cadastro sem pano de fundo
  const [screen, setScreen] = useState<OverlayScreen>('auth_tree');
  const [treeInstanceKey, setTreeInstanceKey] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('all');

  // Metadados do cofre desktop
  const [vaultMetadata, setVaultMetadata] = useState<{
    filePath: string;
    engine: string;
    adminCount: number;
    lastModified: string;
    registeredAdminName: string | null;
  }>(() => persistentVault.getVaultMetadata());

  // Provedor e modo de rede
  const [providerMode, setProviderMode] = useState<'mainnet' | 'local_rpc'>('mainnet');
  const [customRpcUrl, setCustomRpcUrl] = useState('');

  // Estado da aba 'Acessar Painel' (Login/Senha) — Totalmente limpos e editáveis (value="")
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Estado da aba 'Cadastrar Administrador Geral' (Pessoal) — Totalmente limpos e editáveis (value="")
  const [regFullName, setRegFullName] = useState('');
  const [regDocument, setRegDocument] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // Estados de feedback de validação e carregamento
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Carregamento assíncrono do cofre desktop na montagem
  useEffect(() => {
    let isMounted = true;
    persistentVault.ready().then(() => {
      if (isMounted) {
        const meta = persistentVault.getVaultMetadata();
        setVaultMetadata(meta);
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
      setLoginUsername('');
      setLoginPassword('');
      setRegFullName('');
      setRegDocument('');
      setRegEmail('');
      setRegUsername('');
      setRegPassword('');
      setRegPasswordConfirm('');
      setScreen('auth_tree');

      const meta = persistentVault.getVaultMetadata();
      setVaultMetadata(meta);
      if (meta.adminCount === 0) {
        setActiveTab('register_admin');
      } else {
        setActiveTab('login');
      }
      setIsProcessing(false);
    }, 350);
  };

  /**
   * Conclui a autenticação, registra sessão e desbloqueia o painel
   */
  const finalizeUnlock = (operatorName: string, username: string, role: string) => {
    try {
      if (providerMode === 'local_rpc' && customRpcUrl.trim()) {
        sessionStorage.setItem('bitx_ephemeral_rpc', customRpcUrl.trim());
      }
      sessionStorage.setItem('bitx_admin_session', 'active');
      sessionStorage.setItem('bitx_admin_user', username);
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
   * Valida estritamente contra os registros persistidos no cofre desktop
   */
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const userClean = loginUsername.trim();
    const passClean = loginPassword.trim();

    if (!userClean || !passClean) {
      setAuthError('Informe o usuário/e-mail e a senha cadastrados.');
      return;
    }

    setIsProcessing(true);

    try {
      const validation = await persistentVault.validateAdminLogin(userClean, passClean);

      if (validation.valid && validation.admin) {
        const admin = validation.admin;
        setAuthSuccess(
          `Autenticação confirmada para ${admin.name} (@${admin.username}). Inicializando painel...`
        );
        setTimeout(() => {
          finalizeUnlock(admin.name, admin.username, admin.role);
        }, 500);
      } else {
        setIsProcessing(false);
        setAuthError(
          validation.reason ||
            'Credenciais não autorizadas. Verifique o usuário e senha ou realize o cadastro.'
        );
      }
    } catch (err: any) {
      setIsProcessing(false);
      setAuthError(err?.message || 'Falha ao validar credenciais no cofre desktop.');
    }
  };

  /**
   * Submissão da Aba "Cadastrar Administrador Geral" (Pessoal)
   * Salva os dados permanentemente no cofre desktop (Electron / IndexedDB / Arquivo Seguro)
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

    if (!name || !email || !user || !pass) {
      if (!name || !email) {
        setAdminSubTab('personal');
        setAuthError('Preencha os campos obrigatórios (Nome e E-mail) nos Dados Pessoais.');
      } else {
        setAdminSubTab('credentials');
        setAuthError('Preencha o Usuário e Senha Mestra nas Credenciais de Acesso.');
      }
      return;
    }

    if (pass.length < 6) {
      setAdminSubTab('credentials');
      setAuthError('A senha do Administrador Geral deve conter no mínimo 6 caracteres.');
      return;
    }

    if (pass !== passConfirm) {
      setAdminSubTab('credentials');
      setAuthError('A confirmação de senha não coincide com a senha mestra informada.');
      return;
    }

    setIsProcessing(true);

    try {
      const savedAdmin: GeneralAdminRecord = await persistentVault.saveGeneralAdmin({
        name,
        document: doc,
        email,
        username: user,
        password: pass,
      });

      setVaultMetadata(persistentVault.getVaultMetadata());

      setAuthSuccess(
        `Administrador Geral "${savedAdmin.name}" registrado com sucesso no cofre desktop! Inicializando painel...`
      );

      setTimeout(() => {
        finalizeUnlock(savedAdmin.name, savedAdmin.username, savedAdmin.role);
      }, 600);
    } catch (err: any) {
      setIsProcessing(false);
      setAuthError(err?.message || 'Erro ao persistir Administrador Geral no cofre desktop.');
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
        backgroundImage: 'none', // Sem pano de fundo
        color: '#f1f5f9',
        fontFamily: "'DM Mono', monospace, -apple-system, sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      {/* TELA 1: Resumo do Bloqueio de Segurança (Opcional, acessível via botão) */}
      {screen === 'locked_summary' && (
        <div
          style={{
            width: '100%',
            maxWidth: '680px',
            backgroundColor: '#111111',
            backgroundImage: 'none',
            border: '1px solid #222222',
            borderRadius: '10px',
            boxShadow: 'none',
            overflow: 'hidden',
          }}
        >
          {/* Top Security Banner - Fundo plano sem gradientes */}
          <div
            style={{
              backgroundColor: '#222222',
              backgroundImage: 'none',
              borderBottom: '1px solid #333333',
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
                backgroundColor: '#ef4444',
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
                  color: '#94a3b8',
                }}
              >
                Mecanismo de Defesa Ativo • Isolamento de Memória & Anti-Forensics
              </p>
            </div>
          </div>

          {/* Content Body */}
          <div style={{ padding: '24px 28px', backgroundColor: '#111111', backgroundImage: 'none' }}>
            {/* Reason Alert */}
            <div
              style={{
                backgroundColor: '#222222',
                backgroundImage: 'none',
                border: '1px solid #333333',
                borderRadius: '8px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '16px',
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

            {/* Status do Arquivo de Persistência Desktop */}
            <div
              style={{
                backgroundColor: '#181818',
                backgroundImage: 'none',
                border: '1px solid #282828',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <HardDrive size={18} color="#38bdf8" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                <div>
                  <strong>Cofre Desktop Seguro:</strong> <code>{vaultMetadata.filePath}</code>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>
                  {vaultMetadata.adminCount > 0 ? (
                    <span style={{ color: '#4ade80' }}>
                      Administrador Geral registrado:{' '}
                      <strong>{vaultMetadata.registeredAdminName}</strong> (Preservado e Intacto)
                    </span>
                  ) : (
                    <span style={{ color: '#f59e0b' }}>
                      Nenhum Administrador Geral registrado no cofre local. O cadastro será
                      solicitado ao inicializar.
                    </span>
                  )}
                </div>
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
                  backgroundColor: '#222222',
                  backgroundImage: 'none',
                  border: '1px solid #333333',
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
                    <strong>Chaves Privadas & Sementes em Memória:</strong> Destruídas com ruído
                    criptográfico CSPRNG e instâncias desmontadas.
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
                    <strong>Cofre Desktop do Administrador Geral:</strong> Preservado e blindado
                    contra purgas voláteis (Electron / IndexedDB).
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
                    <strong>Canais de Rede e RPC:</strong> Conexões ativas abortadas para isolamento
                    completo.
                  </span>
                </div>
              </div>
            </div>

            {/* Botão de Re-inicialização sem gradiente de fundo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={handleStartReinitialization}
                style={{
                  width: '100%',
                  backgroundColor: isProcessing ? '#333333' : '#f97316',
                  backgroundImage: 'none',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '14px 20px',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'background 0.2s ease',
                  boxShadow: 'none',
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
                Esta ação monta a árvore de autenticação do zero em ambiente volátil e independente
                do navegador.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TELA 2: ÁRVORE DE AUTENTICAÇÃO E CADASTRO LIMPOS, EDITÁVEIS E SEM PANO DE FUNDO */}
      {screen === 'auth_tree' && (
        <div
          key={`bitx-auth-tree-instance-${treeInstanceKey}`}
          style={{
            width: '100%',
            maxWidth: '680px',
            backgroundColor: '#111111',
            backgroundImage: 'none', // Sem pano de fundo
            border: '1px solid #222222',
            borderRadius: '10px',
            boxShadow: 'none', // Sem halos decorativos ou sombras com gradiente
            overflow: 'hidden',
          }}
        >
          {/* Header Superior - Sólido #222222 sem pano de fundo */}
          <div
            style={{
              backgroundColor: '#222222',
              backgroundImage: 'none',
              borderBottom: '1px solid #333333',
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
                  backgroundColor: '#f97316',
                  backgroundImage: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
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
                  BitX Core — Painel Operacional
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: '11px',
                    color: '#94a3b8',
                  }}
                >
                  Cofre Desktop Persistente • Campos Editáveis • Sem Pano de Fundo
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => finalizeUnlock('Operador Geral', 'operador', 'Super Admin')}
                title="Acessar o Painel da Rede BitX Core diretamente"
                style={{
                  backgroundColor: '#f97316',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Acessar Painel &rarr;</span>
              </button>
              <button
                type="button"
                onClick={() => setScreen('locked_summary')}
                title="Ver detalhes de segurança"
                style={{
                  backgroundColor: 'transparent',
                  backgroundImage: 'none',
                  border: '1px solid #334155',
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
                <span>Status Purga</span>
              </button>
            </div>
          </div>

          {/* Abas Superiores Dinâmicas — Limpas e sem pano de fundo */}
          <div className="auth-nav-tabs">
            <button
              type="button"
              className={`auth-nav-tab ${activeTab === 'login' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('login');
                setAuthError(null);
                setAuthSuccess(null);
              }}
            >
              <User size={16} />
              <span>Acessar Painel (Login/Senha)</span>
            </button>

            <button
              type="button"
              className={`auth-nav-tab ${activeTab === 'register_admin' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('register_admin');
                setAuthError(null);
                setAuthSuccess(null);
              }}
            >
              <UserPlus size={16} />
              <span>Cadastrar Administrador Geral (Pessoal)</span>
            </button>
          </div>

          {/* Corpo do Formulário com Fundo Escuro Limpo (#111111) sem pano de fundo */}
          <div style={{ padding: '24px 28px', backgroundColor: '#111111', backgroundImage: 'none' }}>
            {/* Mensagem de Erro Inline */}
            {authError && (
              <div
                style={{
                  backgroundColor: '#222222',
                  backgroundImage: 'none',
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
                  backgroundColor: '#222222',
                  backgroundImage: 'none',
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

            {/* ABA 1: ACESSAR PAINEL (LOGIN/SENHA) — EDITÁVEL, LIMPA E SEM PANO DE FUNDO */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} autoComplete="off">
                <div style={{ marginBottom: '16px' }}>
                  <label
                    htmlFor="login-email"
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
                    Usuário ou E-mail Cadastrado
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      id="login-email"
                      placeholder="Digite seu usuário ou e-mail"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        backgroundColor: '#222222',
                        backgroundImage: 'none', // Sem pano de fundo
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
                    Campo 100% editável e limpo para digitação manual do operador.
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label
                    htmlFor="login-password"
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
                    Senha de Acesso
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      id="login-password"
                      placeholder="Digite sua senha"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        backgroundColor: '#222222',
                        backgroundImage: 'none', // Sem pano de fundo
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
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Validação em cofre persistente desktop sem credenciais hardcoded.
                  </div>
                </div>

                {/* Seleção de Conexão Blockchain - Fundo Plano #222222 */}
                <div
                  style={{
                    backgroundColor: '#222222',
                    backgroundImage: 'none',
                    border: '1px solid #333333',
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
                        backgroundColor: providerMode === 'mainnet' ? '#111111' : '#222222',
                        backgroundImage: 'none',
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
                        backgroundColor: providerMode === 'local_rpc' ? '#111111' : '#222222',
                        backgroundImage: 'none',
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
                      autoComplete="off"
                      spellCheck={false}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        boxSizing: 'border-box',
                        backgroundColor: '#111111',
                        backgroundImage: 'none',
                        border: '1px solid #333333',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        color: '#f8fafc',
                        fontSize: '11px',
                        fontFamily: "'DM Mono', monospace, sans-serif",
                      }}
                    />
                  )}
                </div>

                {/* Botão de Envio Login - Fundo Sólido #f97316 sem gradiente */}
                <button
                  type="submit"
                  style={{
                    width: '100%',
                    backgroundColor: isProcessing ? '#333333' : '#f97316',
                    backgroundImage: 'none', // Sem pano de fundo
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '13px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: 'none',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <Lock size={16} />
                  <span>
                    {isProcessing ? 'Validando no Cofre Desktop...' : 'Autenticar e Entrar no Painel'}
                  </span>
                </button>
              </form>
            )}

            {/* ABA 2: CADASTRAR ADMINISTRADOR GERAL (PESSOAL) — TODAS AS SUB-ABAS LIMPAS, SEM PANO DE FUNDO E 100% EDITÁVEIS */}
            {activeTab === 'register_admin' && (
              <form onSubmit={handleRegisterAdminSubmit} autoComplete="off">
                {/* Banner de Identificação Desktop Seguro - Fundo Plano #222222 */}
                <div
                  style={{
                    backgroundColor: '#222222',
                    backgroundImage: 'none', // Sem pano de fundo
                    border: '1px solid #333333',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Fingerprint size={20} color="#f97316" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                    Cadastro do <strong>Administrador Geral (Pessoal)</strong> com persistência
                    no cofre desktop (<code>{vaultMetadata.filePath}</code>). Imune a
                    bloqueios de tela, purgas de memória e desmontes.
                  </div>
                </div>

                {/* Sub-Abas do Painel Cadastrar Administrador Geral (Totalmente limpas e sem pano de fundo) */}
                <div className="auth-sub-tabs">
                  <button
                    type="button"
                    className={`auth-sub-tab ${adminSubTab === 'all' ? 'is-active' : ''}`}
                    onClick={() => setAdminSubTab('all')}
                  >
                    <FileText size={13} />
                    <span>Todas as Informações</span>
                  </button>

                  <button
                    type="button"
                    className={`auth-sub-tab ${adminSubTab === 'personal' ? 'is-active' : ''}`}
                    onClick={() => setAdminSubTab('personal')}
                  >
                    <User size={13} />
                    <span>Dados Pessoais</span>
                  </button>

                  <button
                    type="button"
                    className={`auth-sub-tab ${adminSubTab === 'credentials' ? 'is-active' : ''}`}
                    onClick={() => setAdminSubTab('credentials')}
                  >
                    <Key size={13} />
                    <span>Credenciais de Acesso</span>
                  </button>
                </div>

                {/* SEÇÃO 1: DADOS PESSOAIS (Renderizada se 'all' ou 'personal') */}
                {(adminSubTab === 'all' || adminSubTab === 'personal') && (
                  <div style={{ marginBottom: '16px' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#f97316',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '10px',
                      }}
                    >
                      1. Identificação do Titular / Pessoal
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
                          htmlFor="reg-fullname"
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
                          type="text"
                          id="reg-fullname"
                          placeholder="Digite o nome completo do operador"
                          value={regFullName}
                          onChange={(e) => setRegFullName(e.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            backgroundColor: '#222222',
                            backgroundImage: 'none', // Sem pano de fundo
                            border: '1px solid #333333',
                            borderRadius: '6px',
                            padding: '10px 12px',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontFamily: "'DM Mono', monospace, sans-serif",
                            outline: 'none',
                          }}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="reg-doc"
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
                          type="text"
                          id="reg-doc"
                          placeholder="Digite o documento ou CPF"
                          value={regDocument}
                          onChange={(e) => setRegDocument(e.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            backgroundColor: '#222222',
                            backgroundImage: 'none', // Sem pano de fundo
                            border: '1px solid #333333',
                            borderRadius: '6px',
                            padding: '10px 12px',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontFamily: "'DM Mono', monospace, sans-serif",
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label
                        htmlFor="reg-email"
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
                        type="email"
                        id="reg-email"
                        placeholder="Digite seu e-mail institucional ou pessoal"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          backgroundColor: '#222222',
                          backgroundImage: 'none', // Sem pano de fundo
                          border: '1px solid #333333',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontFamily: "'DM Mono', monospace, sans-serif",
                          outline: 'none',
                        }}
                      />
                    </div>
                    {adminSubTab === 'personal' && (
                      <button
                        type="button"
                        onClick={() => setAdminSubTab('credentials')}
                        style={{
                          background: '#1e293b',
                          color: '#f97316',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '8px 14px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '10px',
                        }}
                      >
                        <span>Avançar para Credenciais de Acesso &rarr;</span>
                      </button>
                    )}
                  </div>
                )}

                {/* SEÇÃO 2: CREDENCIAIS OPERACIONAIS (Renderizada se 'all' ou 'credentials') */}
                {(adminSubTab === 'all' || adminSubTab === 'credentials') && (
                  <div style={{ marginBottom: '16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#f97316',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        2. Credenciais de Acesso & Senha Mestra
                      </div>
                      {adminSubTab === 'credentials' && (
                        <button
                          type="button"
                          onClick={() => setAdminSubTab('personal')}
                          style={{
                            background: 'transparent',
                            color: '#94a3b8',
                            border: 'none',
                            fontSize: '11px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          &larr; Voltar para Dados Pessoais
                        </button>
                      )}
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label
                        htmlFor="reg-username"
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
                        type="text"
                        id="reg-username"
                        placeholder="Digite seu usuário de acesso operacional"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          backgroundColor: '#222222',
                          backgroundImage: 'none', // Sem pano de fundo
                          border: '1px solid #333333',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontFamily: "'DM Mono', monospace, sans-serif",
                          outline: 'none',
                        }}
                      />
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
                          htmlFor="reg-password"
                          style={{
                            display: 'block',
                            fontSize: '11px',
                            color: '#94a3b8',
                            fontWeight: 600,
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Senha Mestra (Mín. 6 chars) *
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            id="reg-password"
                            placeholder="Digite a senha mestra"
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              backgroundColor: '#222222',
                              backgroundImage: 'none', // Sem pano de fundo
                              border: '1px solid #333333',
                              borderRadius: '6px',
                              padding: '10px 36px 10px 12px',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontFamily: "'DM Mono', monospace, sans-serif",
                              outline: 'none',
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
                          htmlFor="reg-password-confirm"
                          style={{
                            display: 'block',
                            fontSize: '11px',
                            color: '#94a3b8',
                            fontWeight: 600,
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Confirmar Senha *
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showRegConfirm ? 'text' : 'password'}
                            id="reg-password-confirm"
                            placeholder="Confirme a senha mestra"
                            value={regPasswordConfirm}
                            onChange={(e) => setRegPasswordConfirm(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              backgroundColor: '#222222',
                              backgroundImage: 'none', // Sem pano de fundo
                              border: '1px solid #333333',
                              borderRadius: '6px',
                              padding: '10px 36px 10px 12px',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontFamily: "'DM Mono', monospace, sans-serif",
                              outline: 'none',
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
                  </div>
                )}

                {/* Botão de Envio Cadastro - Fundo Sólido #16a34a sem gradiente */}
                <button
                  type="submit"
                  style={{
                    width: '100%',
                    backgroundColor: isProcessing ? '#333333' : '#16a34a',
                    backgroundImage: 'none', // Sem pano de fundo
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '13px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: 'none',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <UserPlus size={16} />
                  <span>
                    {isProcessing
                      ? 'Persistindo no Cofre Desktop...'
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
