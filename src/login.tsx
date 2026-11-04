import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Lock,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  User,
  UserPlus,
  Key,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Server,
  FileText,
  BadgeCheck,
} from 'lucide-react';
import { persistentVault, hashPassword } from './utils/persistentVault';
import './styles/admin.css';

// Utilitários de Segurança e Sanitização contra Injeção e XSS
const sanitizeInput = (val: string): string => {
  if (!val) return '';
  return val.replace(/[<>"'/`]/g, '').trim();
};

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,32}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60000; // 60 segundos de bloqueio

// Proteção BFCache e Route Guard da Página de Login
if (typeof window !== 'undefined') {
  const isAuth =
    sessionStorage.getItem('bitx_admin_session') === 'active' ||
    sessionStorage.getItem('bitx_admin_auth') === 'true';

  if (isAuth && !window.location.pathname.endsWith('index.html')) {
    window.location.replace('index.html');
  }

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      const active =
        sessionStorage.getItem('bitx_admin_session') === 'active' ||
        sessionStorage.getItem('bitx_admin_auth') === 'true';
      if (active) {
        window.location.replace('index.html');
      }
    }
  });
}

type AuthTab = 'login' | 'register_admin';
type SubTab = 'all' | 'personal' | 'credentials';

export const LoginPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [subTab, setSubTab] = useState<SubTab>('all');

  // Metadados do cofre local
  const [vaultMeta, setVaultMeta] = useState(() => persistentVault.getVaultMetadata());
  const [isReady, setIsReady] = useState(false);

  // Campos de Login — Vazios, sem preenchimento estático, 100% editáveis
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Campos de Cadastro — Vazios, sem preenchimento estático, 100% editáveis
  const [regName, setRegName] = useState('');
  const [regDoc, setRegDoc] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPassConfirm, setRegPassConfirm] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // Campo de Autorização Mestre quando já existe admin registrado (Proteção BOLA/IDOR)
  const [currentAdminAuthPass, setCurrentAdminAuthPass] = useState('');
  const [showCurrentAdminPass, setShowCurrentAdminPass] = useState(false);

  // Estados de Rate Limiting e Lockout por Força Bruta
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      return parseInt(sessionStorage.getItem('bitx_sec_fails') || '0', 10);
    } catch {
      return 0;
    }
  });
  const [lockoutUntil, setLockoutUntil] = useState<number>(() => {
    try {
      return parseInt(sessionStorage.getItem('bitx_sec_lockout') || '0', 10);
    } catch {
      return 0;
    }
  });
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Estados de erro, sucesso e carregamento
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Efeito de contagem regressiva para Lockout
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      if (lockoutUntil > now) {
        setLockoutRemaining(Math.ceil((lockoutUntil - now) / 1000));
      } else {
        setLockoutRemaining(0);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  useEffect(() => {
    persistentVault.ready().then(() => {
      const meta = persistentVault.getVaultMetadata();
      setVaultMeta(meta);
      setIsReady(true);
      if (meta.adminCount === 0) {
        setActiveTab('register_admin');
      }
    });
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. Verificação de Trava contra Força Bruta (Rate Limiting)
    const now = Date.now();
    if (lockoutUntil > now) {
      const remainingSecs = Math.ceil((lockoutUntil - now) / 1000);
      setErrorMsg(`Acesso suspenso por segurança devido ao excesso de tentativas. Aguarde ${remainingSecs}s.`);
      return;
    }

    // 2. Sanitização estrita contra XSS e injeção
    const u = sanitizeInput(loginUser);
    const p = loginPass;

    if (!u) {
      setErrorMsg('Informe o usuário ou e-mail do Administrador Geral.');
      return;
    }
    if (!p) {
      setErrorMsg('Informe a senha de autenticação.');
      return;
    }

    setIsSubmitting(true);
    // Delay computacional proposital (400ms) para amortecer ataques de timing e automação
    await new Promise((resolve) => setTimeout(resolve, 400));

    try {
      // 1. Validar contra o cofre desktop do Administrador Geral
      const vaultRes = await persistentVault.validateAdminLogin(u, p);
      if (vaultRes.valid) {
        // Sucesso: zerar contadores de Rate Limiting
        sessionStorage.removeItem('bitx_sec_fails');
        sessionStorage.removeItem('bitx_sec_lockout');
        setFailedAttempts(0);
        setLockoutUntil(0);

        setSuccessMsg('Autenticação autorizada! Redirecionando para o painel...');
        sessionStorage.setItem('bitx_admin_session', 'active');
        sessionStorage.setItem('bitx_admin_auth', 'true');
        sessionStorage.setItem('bitx_admin_user', u);
        sessionStorage.setItem(
          'bitx_operator_session',
          JSON.stringify({
            name: vaultRes.admin?.name || u,
            username: u,
            role: 'Super Admin',
            authenticatedAt: new Date().toISOString(),
            sessionNonce: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
          })
        );

        setTimeout(() => {
          window.location.replace('index.html');
        }, 350);
        return;
      }

      // 2. Validar contra usuários locais de contingência com hash SHA-256
      let localUsers: Record<string, string> = {};
      try {
        const stored = localStorage.getItem('bitx_users');
        if (stored) localUsers = JSON.parse(stored);
      } catch (_) {}

      const inputHash = hashPassword(p);
      if (localUsers[u] && (localUsers[u] === inputHash || localUsers[u] === p)) {
        // Se ainda estiver com texto legado, atualiza para hash SHA-256 seguro
        if (localUsers[u] === p) {
          localUsers[u] = inputHash;
          try {
            localStorage.setItem('bitx_users', JSON.stringify(localUsers));
          } catch (_) {}
        }

        sessionStorage.removeItem('bitx_sec_fails');
        sessionStorage.removeItem('bitx_sec_lockout');
        setFailedAttempts(0);
        setLockoutUntil(0);

        setSuccessMsg('Autenticação autorizada! Redirecionando para o painel...');
        sessionStorage.setItem('bitx_admin_session', 'active');
        sessionStorage.setItem('bitx_admin_auth', 'true');
        sessionStorage.setItem('bitx_admin_user', u);
        sessionStorage.setItem(
          'bitx_operator_session',
          JSON.stringify({
            name: u,
            username: u,
            role: 'Super Admin',
            authenticatedAt: new Date().toISOString(),
            sessionNonce: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
          })
        );

        setTimeout(() => {
          window.location.replace('index.html');
        }, 350);
        return;
      }

      // Falha de login: aciona Rate Limiting progressivo
      const newFails = failedAttempts + 1;
      setFailedAttempts(newFails);
      sessionStorage.setItem('bitx_sec_fails', String(newFails));

      if (newFails >= MAX_FAILED_ATTEMPTS) {
        const lock = Date.now() + LOCKOUT_DURATION_MS;
        setLockoutUntil(lock);
        sessionStorage.setItem('bitx_sec_lockout', String(lock));
        setErrorMsg(`Limite de ${MAX_FAILED_ATTEMPTS} tentativas consecutivas excedido. Acesso suspenso por 60 segundos.`);
      } else {
        setErrorMsg(
          `${vaultRes.reason || 'Credenciais inválidas. Verifique os dados digitados.'} (${MAX_FAILED_ATTEMPTS - newFails} tentativas restantes)`
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha na validação de credenciais.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Sanitização rigorosa contra XSS
    const name = sanitizeInput(regName);
    const doc = sanitizeInput(regDoc);
    const email = regEmail.trim().toLowerCase();
    const username = sanitizeInput(regUsername).toLowerCase();
    const password = regPass;
    const confirm = regPassConfirm;

    if (!name || name.length < 3) {
      setSubTab('personal');
      setErrorMsg('Informe o nome completo do Administrador Geral (mínimo 3 caracteres).');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setSubTab('personal');
      setErrorMsg('Informe um endereço de e-mail institucional válido.');
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      setSubTab('credentials');
      setErrorMsg('O nome de usuário deve conter de 3 a 32 caracteres alfanuméricos (letras, números, . ou _).');
      return;
    }
    if (!password || password.length < 8) {
      setSubTab('credentials');
      setErrorMsg('A senha mestre deve conter no mínimo 8 caracteres para proteção criptográfica.');
      return;
    }
    if (password !== confirm) {
      setSubTab('credentials');
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }

    // TRAVA DE AUTORIZAÇÃO (BOLA/IDOR): Se já houver admin registrado no cofre
    const hasAdmin = vaultMeta.adminCount > 0;
    const isCurrentAdminLogged = sessionStorage.getItem('bitx_admin_session') === 'active';

    if (hasAdmin && !isCurrentAdminLogged) {
      if (!currentAdminAuthPass) {
        setErrorMsg('Autorização obrigatória: Um Administrador Geral já está cadastrado. Informe a Senha do Administrador Atual para autorizar este cadastro.');
        return;
      }
      // Validar senha do administrador atual no cofre
      const activeAdmin = persistentVault.getGeneralAdmin();
      const authValidation = await persistentVault.validateAdminLogin(
        activeAdmin?.username || 'bitx_mainnet_admin',
        currentAdminAuthPass
      );
      if (!authValidation.valid) {
        setErrorMsg('Autorização negada: Senha do Administrador Atual incorreta.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await persistentVault.saveGeneralAdmin({
        name,
        document: doc,
        email,
        username,
        password,
      });

      // Salva no registro de usuários apenas o hash SHA-256 (NUNCA senha em texto puro)
      try {
        const stored = localStorage.getItem('bitx_users');
        const current = stored ? JSON.parse(stored) : {};
        current[username] = hashPassword(password);
        localStorage.setItem('bitx_users', JSON.stringify(current));
      } catch (_) {}

      // Atualiza metadados do cofre
      setVaultMeta(persistentVault.getVaultMetadata());

      setSuccessMsg('Administrador Geral registrado com segurança! Inicializando sessão...');
      sessionStorage.setItem('bitx_admin_session', 'active');
      sessionStorage.setItem('bitx_admin_auth', 'true');
      sessionStorage.setItem('bitx_admin_user', username);
      sessionStorage.setItem(
        'bitx_operator_session',
        JSON.stringify({
          name,
          username,
          role: 'Super Admin',
          authenticatedAt: new Date().toISOString(),
          sessionNonce: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        })
      );

      setTimeout(() => {
        window.location.replace('index.html');
      }, 500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao registrar Administrador Geral no cofre.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#070b10',
        color: '#f8fafc',
        fontFamily: "'Manrope', system-ui, -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
      }}
    >
      {/* Top Banner de Status */}
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          fontSize: '12px',
          fontFamily: "'DM Mono', monospace",
          color: '#94a3b8',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
            }}
          />
          <span style={{ color: '#e2e8f0', fontWeight: 700 }}>REDE PRINCIPAL (MAINNET)</span>
          <span>·</span>
          <span>ROUTE GUARD ATIVO</span>
        </div>
        <span style={{ color: '#f97316', fontWeight: 600 }}>v3.4 Production</span>
      </div>

      {/* Card Principal */}
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#0c1322',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          boxShadow: '0 20px 45px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header do Card */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #1e293b',
            background: 'linear-gradient(180deg, #111a2e 0%, #0c1322 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#f97316',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '18px',
                boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
              }}
            >
              BX
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                BitX Core <span style={{ color: '#f97316' }}>BTXC</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#1e293b',
                    color: '#38bdf8',
                    border: '1px solid #0284c7',
                  }}
                >
                  AUTENTICAÇÃO SEGURA
                </span>
              </h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Gateway Administrativo da Rede BitX Core & Global Exchange
              </p>
            </div>
          </div>
        </div>

        {/* Abas Principais (Totalmente limpas, sem pano de fundo) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderBottom: '1px solid #1e293b',
            background: 'transparent',
            backgroundColor: 'transparent',
            backgroundImage: 'none',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'login' ? '2px solid #f97316' : '2px solid transparent',
              background: 'transparent',
              backgroundColor: 'transparent',
              backgroundImage: 'none',
              color: activeTab === 'login' ? '#f8fafc' : '#94a3b8',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <Lock size={15} color={activeTab === 'login' ? '#f97316' : '#64748b'} />
            <span>Acessar Painel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('register_admin');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'register_admin' ? '2px solid #10b981' : '2px solid transparent',
              background: 'transparent',
              backgroundColor: 'transparent',
              backgroundImage: 'none',
              color: activeTab === 'register_admin' ? '#f8fafc' : '#94a3b8',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <UserPlus size={15} color={activeTab === 'register_admin' ? '#10b981' : '#64748b'} />
            <span>Cadastrar Administrador Geral</span>
          </button>
        </div>

        {/* Mensagens de Feedback */}
        {errorMsg && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '10px 14px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '10px 14px',
              borderRadius: '6px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid #22c55e',
              color: '#86efac',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} color="#22c55e" style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Corpo: Aba de Login (Acessar Painel) */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} style={{ padding: '24px', background: 'transparent' }}>
            <div style={{ marginBottom: '18px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#cbd5e1',
                  marginBottom: '6px',
                  background: 'transparent',
                }}
              >
                E-mail ou Usuário Administrador:
              </label>
              <div style={{ position: 'relative', background: 'transparent' }}>
                <input
                  type="text"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  autoComplete="off"
                  placeholder=""
                  required
                  className="auth-input-clean"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid #334155',
                    background: 'transparent',
                    backgroundColor: 'transparent',
                    backgroundImage: 'none',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    textShadow: 'none',
                    boxShadow: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', background: 'transparent' }}>
                  Senha de Acesso:
                </label>
              </div>
              <div style={{ position: 'relative', background: 'transparent' }}>
                <input
                  type={showLoginPass ? 'text' : 'password'}
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  autoComplete="new-password"
                  placeholder=""
                  required
                  className="auth-input-clean"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 42px 10px 14px',
                    borderRadius: '6px',
                    border: '1px solid #334155',
                    background: 'transparent',
                    backgroundColor: 'transparent',
                    backgroundImage: 'none',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    textShadow: 'none',
                    boxShadow: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPass(!showLoginPass)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  {showLoginPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || lockoutRemaining > 0}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '6px',
                border: 'none',
                background: lockoutRemaining > 0 ? '#475569' : '#f97316',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: isSubmitting || lockoutRemaining > 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: lockoutRemaining > 0 ? 'none' : '0 4px 14px rgba(249, 115, 22, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {lockoutRemaining > 0 ? (
                <>
                  <Lock size={16} />
                  <span>Acesso Suspenso por Força Bruta ({lockoutRemaining}s)</span>
                </>
              ) : isSubmitting ? (
                <span>Verificando credenciais com segurança...</span>
              ) : (
                <>
                  <span>Acessar Painel BitX Core</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Link para cadastro se cofre vazio */}
            {vaultMeta.adminCount === 0 && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '10px 12px',
                  background: 'rgba(249, 115, 22, 0.08)',
                  border: '1px dashed #f97316',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#fdba74',
                  textAlign: 'center',
                }}
              >
                Primeiro acesso detectado. Clique na aba{' '}
                <strong
                  onClick={() => setActiveTab('register_admin')}
                  style={{ textDecoration: 'underline', cursor: 'pointer', color: '#ffedd5' }}
                >
                  Cadastrar Administrador Geral
                </strong>{' '}
                para configurar o acesso mestre.
              </div>
            )}
          </form>
        )}

        {/* Corpo: Aba de Cadastro de Administrador Geral */}
        {activeTab === 'register_admin' && (
          <form onSubmit={handleRegisterSubmit} style={{ padding: '24px' }}>
            {/* Sub-abas (Totalmente limpas, sem fundo) */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '18px',
                borderBottom: '1px solid #1e293b',
                paddingBottom: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setSubTab('all')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: subTab === 'all' ? '#10b981' : '#334155',
                  background: subTab === 'all' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: subTab === 'all' ? '#10b981' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                Todos os Campos
              </button>
              <button
                type="button"
                onClick={() => setSubTab('personal')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: subTab === 'personal' ? '#10b981' : '#334155',
                  background: subTab === 'personal' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: subTab === 'personal' ? '#10b981' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                Dados Pessoais
              </button>
              <button
                type="button"
                onClick={() => setSubTab('credentials')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: subTab === 'credentials' ? '#10b981' : '#334155',
                  background: subTab === 'credentials' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: subTab === 'credentials' ? '#10b981' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                Credenciais de Acesso
              </button>
            </div>

            {/* Seção 1: Dados Pessoais */}
            {(subTab === 'all' || subTab === 'personal') && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Nome Completo do Administrador Geral:
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    autoComplete="off"
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #334155',
                      background: '#090f1b',
                      color: '#f8fafc',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                      CPF ou Documento Oficial:
                    </label>
                    <input
                      type="text"
                      value={regDoc}
                      onChange={(e) => setRegDoc(e.target.value)}
                      autoComplete="off"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #334155',
                        background: '#090f1b',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                      E-mail Institucional:
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      autoComplete="off"
                      required
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #334155',
                        background: '#090f1b',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Seção 2: Credenciais */}
            {(subTab === 'all' || subTab === 'credentials') && (
              <div style={{ marginBottom: '18px' }}>
                {/* Trava de Autorização contra Quebra de Acesso (IDOR/BOLA) */}
                {vaultMeta.adminCount > 0 && typeof window !== 'undefined' && sessionStorage.getItem('bitx_admin_session') !== 'active' && (
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '12px 14px',
                      borderRadius: '6px',
                      background: 'rgba(234, 179, 8, 0.08)',
                      border: '1px solid rgba(234, 179, 8, 0.35)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Shield size={15} color="#eab308" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#fef08a' }}>
                        Autorização Mestre Obrigatória
                      </span>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#fef9c3', lineHeight: 1.4 }}>
                      Já existe um Administrador Geral cadastrado. Para registrar ou transferir a titularidade, informe a Senha Mestre Atual:
                    </p>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCurrentAdminPass ? 'text' : 'password'}
                        value={currentAdminAuthPass}
                        onChange={(e) => setCurrentAdminAuthPass(e.target.value)}
                        autoComplete="current-password"
                        placeholder="Digite a Senha Mestre do Administrador Atual"
                        required
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '8px 34px 8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #eab308',
                          background: '#090f1b',
                          color: '#f8fafc',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentAdminPass(!showCurrentAdminPass)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#eab308',
                          cursor: 'pointer',
                        }}
                      >
                        {showCurrentAdminPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Nome de Usuário (Login):
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    autoComplete="off"
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #334155',
                      background: '#090f1b',
                      color: '#f8fafc',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                      Senha Mestre:
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showRegPass ? 'text' : 'password'}
                        value={regPass}
                        onChange={(e) => setRegPass(e.target.value)}
                        autoComplete="new-password"
                        required
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '8px 34px 8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #334155',
                          background: '#090f1b',
                          color: '#f8fafc',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPass(!showRegPass)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                        }}
                      >
                        {showRegPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                      Confirmar Senha:
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showRegConfirm ? 'text' : 'password'}
                        value={regPassConfirm}
                        onChange={(e) => setRegPassConfirm(e.target.value)}
                        autoComplete="new-password"
                        required
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '8px 34px 8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #334155',
                          background: '#090f1b',
                          color: '#f8fafc',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirm(!showRegConfirm)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                        }}
                      >
                        {showRegConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '6px',
                border: 'none',
                background: '#10b981',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldCheck size={16} />
              <span>{isSubmitting ? 'Gravando no cofre...' : 'Salvar e Ativar Administrador Geral'}</span>
            </button>
          </form>
        )}

        {/* Rodapé com Informações de Segurança do Cofre */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #1e293b',
            background: '#070b10',
            fontSize: '11px',
            color: '#64748b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: "'DM Mono', monospace",
          }}
        >
          <div>
            Cofre Seguro: <span style={{ color: '#94a3b8' }}>{vaultMeta.engine}</span>
          </div>
          <div>
            Admins Registrados: <span style={{ color: '#10b981' }}>{vaultMeta.adminCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const rootEl = document.getElementById('login-root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <LoginPage />
    </React.StrictMode>
  );
}
export default LoginPage;
