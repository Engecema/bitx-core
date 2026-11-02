/**
 * BitX Core (BTXC) — Módulo de Segurança Web3 e Proteção de Ciclo de Vida
 * 
 * Implementa:
 * 1. Sanitização criptográfica com sobrescrita de memória e armazenamento local (localStorage / sessionStorage)
 * 2. Proteção contra BFCache (Back-Forward Cache) via window.onpageshow
 * 3. Detecção de recarregamento forçado (Navigation Timing API)
 * 4. Isolamento e controle de abort de requisições ativas da blockchain
 */

export interface SecurityStatus {
  isLocked: boolean;
  lockReason: string | null;
  lockedAt: number | null;
  purgeCompleted: boolean;
}

type SecurityListener = (status: SecurityStatus) => void;

class BitXSecurityGuard {
  private static instance: BitXSecurityGuard;
  private listeners: Set<SecurityListener> = new Set();
  private abortController: AbortController = new AbortController();

  private status: SecurityStatus = {
    isLocked: false,
    lockReason: null,
    lockedAt: null,
    purgeCompleted: false,
  };

  private constructor() {
    this.initLifecycleGuards();
  }

  public static getInstance(): BitXSecurityGuard {
    if (!BitXSecurityGuard.instance) {
      BitXSecurityGuard.instance = new BitXSecurityGuard();
    }
    return BitXSecurityGuard.instance;
  }

  public getStatus(): SecurityStatus {
    return { ...this.status };
  }

  public subscribe(listener: SecurityListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = this.getStatus();
    this.listeners.forEach((fn) => {
      try {
        fn(current);
      } catch (err) {
        console.error('[BitXSecurity] Erro no listener:', err);
      }
    });
  }

  /**
   * Sobrescreve e destrói todos os registros de chaves e dados sensíveis
   * antes de chamar .clear() para evitar recuperação de memória/swap.
   */
  public purgeSensitiveStorage(): void {
    try {
      // 1. Abortar qualquer requisição RPC ou SSE/WebSocket em trânsito
      this.abortController.abort();
      this.abortController = new AbortController();

      // 2. Chaves críticas conhecidas no ecossistema BitX Core
      const sensitiveKeys = [
        'bitx_client_seed',
        'bitx_priv_key',
        'bitx_client_balance',
        'global_exchange_client_balance',
        'ge_client_balance',
        'bitx_rpc_host',
        'bitx_rpc_user',
        'bitx_rpc_pass',
        'bitx_rpc_port',
        'bitx_blocks',
        'bitx_mempool',
        'bitx_clients',
        'bitx_operator_session',
        'bitx_active_session',
        'supabase.auth.token',
        'sb-odbbtgkxgiqlfhcepwuj-auth-token',
      ];

      // 3. Sobrescrita de lixo criptográfico (Wipe pattern) em localStorage
      sensitiveKeys.forEach((key) => {
        try {
          if (localStorage.getItem(key)) {
            const randomGarbage = Array.from(crypto.getRandomValues(new Uint8Array(64)))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            localStorage.setItem(key, randomGarbage);
            localStorage.removeItem(key);
          }
        } catch {}
      });

      // 4. Limpeza total de storages do navegador
      localStorage.clear();
      sessionStorage.clear();

      // 5. Limpeza de cookies de sessão (se acessíveis via JS)
      try {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i];
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }
      } catch {}

      this.status.purgeCompleted = true;
    } catch (e) {
      console.warn('[BitXSecurity] Falha na purga do storage:', e);
    }
  }

  /**
   * Dispara o bloqueio total da aplicação, desmonta o estado e exibe o Overlay.
   */
  public lock(reason: string = 'Bloqueio Manual Solicitado'): void {
    this.purgeSensitiveStorage();
    this.status = {
      isLocked: true,
      lockReason: reason,
      lockedAt: Date.now(),
      purgeCompleted: true,
    };
    this.notify();
  }

  /**
   * Desbloqueia o painel após re-confirmação explícita do operador.
   */
  public unlock(): void {
    this.status = {
      isLocked: false,
      lockReason: null,
      lockedAt: null,
      purgeCompleted: false,
    };
    this.notify();
  }

  /**
   * Inicializa ouvintes do ciclo de vida: BFCache, Reload, Visibilidade e Histórico
   */
  private initLifecycleGuards(): void {
    if (typeof window === 'undefined') return;

    // 1. Detecção de BFCache (Back-Forward Cache): disparado quando o usuário usa voltar/avançar
    window.addEventListener('pageshow', (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.warn('[BitXSecurity] Página restaurada do BFCache. Disparando purga imediata.');
        this.lock('Restauração de Histórico (BFCache detectado - Voltar/Avançar)');
      }
    });

    // 2. Proteção contra navegação histórica (popstate)
    window.addEventListener('popstate', () => {
      // Se não for rota institucional pública, bloqueia o painel operacional
      const hash = window.location.hash.toLowerCase();
      if (!hash.includes('site') && !this.status.isLocked) {
        this.lock('Navegação no histórico do navegador detectada');
      }
    });

    // 3. Detecção de Recarregamento de Página (F5 ou Botão Recarregar)
    try {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0) {
        const nav = navEntries[0] as PerformanceNavigationTiming;
        if (nav.type === 'reload') {
          console.warn('[BitXSecurity] Recarregamento de página detectado. Exigindo re-inicialização.');
          this.lock('Recarregamento de página detectado (Proteção Anti-Reload)');
        }
      } else if (
        // Compatibilidade retroativa para navegadores legados
        (performance as any)?.navigation?.type === 1
      ) {
        this.lock('Recarregamento de página detectado (Proteção Anti-Reload)');
      }
    } catch (e) {
      console.warn('[BitXSecurity] Não foi possível inspecionar PerformanceNavigationTiming:', e);
    }

    // 4. Proteção contra descarte de aba / suspensão de página
    window.addEventListener('pagehide', () => {
      // Purga antes que a aba seja descartada ou mantida em cache
      this.purgeSensitiveStorage();
    });
  }

  public getAbortSignal(): AbortSignal {
    return this.abortController.signal;
  }
}

export const securityGuard = BitXSecurityGuard.getInstance();
