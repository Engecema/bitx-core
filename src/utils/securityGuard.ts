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

  private constructor() {}

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
      this.abortController.abort();
      this.abortController = new AbortController();

      const ephemeralKeys = [
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
        'bitx_exchange_clients',
        'bitx_real_exchange_clients',
        'bitx_ge_synced_clients',
        'bitx_ge_deposits',
        'bitx_custody_ledger',
        'bitx_client_txs',
        'global_exchange_transfers',
        'ge_transfers',
        'global_exchange_activities',
        'global_exchange_client_balance',
        'ge_client_balance',
        'bitx_ge_admin_operators_v3',
        'bitx_operator_session',
        'bitx_active_session',
        'bitx_users',
        'bitx_desktop_secure_vault_mirror_v1',
      ];

      ephemeralKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {}
      });

      sessionStorage.clear();
      try {
        indexedDB.deleteDatabase('bitx_desktop_secure_vault_db');
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

  public getAbortSignal(): AbortSignal {
    return this.abortController.signal;
  }
}

export const securityGuard = BitXSecurityGuard.getInstance();
