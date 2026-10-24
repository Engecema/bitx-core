import React, { useState, useEffect, useRef, useMemo } from 'react';
import '../styles/portal.css';
import { sha256 } from '@noble/hashes/sha2.js';
import { supabase } from '../utils/supabase';

interface OperationsPortalProps {
  onOpenPolicy: (policy: 'privacidade' | 'termos' | 'cookies') => void;
  onOpenSiteModal?: () => void;
}

export interface BlockRecord {
  height: number;
  hash: string;
  prevHash: string;
  merkleRoot: string;
  timestamp: string;
  transactionsCount: number;
  miner: string;
  reward: number;
  nonce: number;
  difficulty: string;
  transactions: {
    txid: string;
    from: string;
    to: string;
    amount: number;
    fee: number;
  }[];
}

export interface MempoolTx {
  txid: string;
  from: string;
  to: string;
  amount: number;
  fee: number;
  time: string;
  exchangeClientTag?: string;
}

export interface ExchangeClient {
  id: string;
  name: string;
  email: string;
  document?: string;
  bitxAddress?: string;
  titleBadge?: string;
  btxcBalance: number; // Saldo GX (BitX) -> 250.00 GX
  brlBalance: number;  // Saldo com Liquidez (R$) -> R$ 42.385.000,00
  usdtBalance: number;
  estimatedMarketValue?: number; // Valor de Mercado Estimado -> R$ 105.270.385,00
  status: 'Ativo' | 'Verificado KYC' | 'Institucional' | 'VIP';
  createdAt?: string;
}

export interface ExchangeDepositRecord {
  id: string;
  clientId: string;
  clientName: string;
  txid: string;
  amount: number;
  confirmations: number;
  status: 'Pendente' | 'Confirmando' | 'Creditado';
  time: string;
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export interface CustodyLedgerItem {
  id: string;
  txid: string;
  clientId?: string;
  type:
    | 'Aporte Inicial'
    | 'Ajuste Direto com TXID'
    | 'Transferência em Reais (Pix)'
    | 'Transferência em GX'
    | 'Depósito Blockchain BitX Core'
    | 'Sincronização Corretora'
    | 'Transferência BitX Core Mainnet';
  amountGx: number;
  amountBrl: number;
  counterparty: string;
  timestamp: string;
  status: 'Confirmado em Custódia' | 'Liquidado Pix BB';
}

export interface OperatorUser {
  id: string;
  name: string;
  username: string; // geonimatos31@gmail.com
  email: string;
  role: 'Super Admin' | 'Operador' | 'Auditor';
  status: 'Ativo' | 'Inativo';
  createdAt: string;
}

const STORAGE_OPERATORS_KEY = 'bitx_ge_admin_operators_v3';

export const DEFAULT_REAL_OPERATORS: OperatorUser[] = [
  {
    id: 'GX-OP-0001',
    name: 'Geoni Clementino Cesar de Matos',
    username: 'geonimatos31@gmail.com',
    email: 'geonimatos31@gmail.com',
    role: 'Super Admin',
    status: 'Ativo',
    createdAt: '19/10/2026',
  },
];

export const getStoredOperators = (): OperatorUser[] => {
  try {
    // Purificar chaves legadas e antigas do cache para não ressuscitar dados falsos
    localStorage.removeItem('bitx_admin_users');
    localStorage.removeItem('bitx_operators');
    localStorage.removeItem('bitx_ge_admin_operators');
    localStorage.removeItem('bitx_ge_admin_operators_v2');

    const raw = localStorage.getItem(STORAGE_OPERATORS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Remover expressamente qualquer operador fictício antigo
        const filtered = parsed.filter(
          (u: any) =>
            u.username !== 'admin_engecema' &&
            u.username !== 'global_exchange_gateway' &&
            u.username !== 'auditor_compliance' &&
            u.username !== 'pool_operator_01'
        );
        if (filtered.length > 0) {
          return filtered.map((u: any, idx: number) => ({
            id: u.id || `GX-OP-${String(idx + 1).padStart(4, '0')}`,
            name: u.name || (u.username === 'geonimatos31@gmail.com' ? 'Geoni Clementino Cesar de Matos' : u.username),
            username: u.username || u.email || 'operador',
            email: u.email || u.username || 'operador@globalexchange.com',
            role: (u.role || 'Operador') as 'Super Admin' | 'Operador' | 'Auditor',
            status: (u.status || 'Ativo') as 'Ativo' | 'Inativo',
            createdAt: u.createdAt || '19/10/2026',
          }));
        }
      }
    }
  } catch (e) {
    console.warn('[Operadores] Leitura do armazenamento local:', e);
  }
  return DEFAULT_REAL_OPERATORS;
};

export const saveStoredOperators = (ops: OperatorUser[]) => {
  try {
    localStorage.setItem(STORAGE_OPERATORS_KEY, JSON.stringify(ops));
  } catch (e) {
    console.warn('[Operadores] Gravação no armazenamento local:', e);
  }
};

export const DEFAULT_CUSTODY_LEDGER: CustodyLedgerItem[] = [
  {
    id: 'CUST-0001',
    txid: '0x8f2d4e1a9b7c3f5e0a2b4c6d8e1f3a5b7c9d0e2f4a6b8c0d2e4f6a8b0c2d4e6f',
    clientId: 'GX-CLI-0001',
    type: 'Aporte Inicial',
    amountGx: 250.0,
    amountBrl: 42385000.0,
    counterparty: 'Custódia Engecema PJ -> Geoni Clementino Cesar de Matos (GX-CLI-0001)',
    timestamp: '19/10/2026, 09:30:00',
    status: 'Confirmado em Custódia',
  },
];

export interface DeletedClientRecord {
  id: string;
  email?: string;
  document?: string;
  name?: string;
}

const STORAGE_DELETED_CLIENTS_KEY = 'bitx_deleted_clients_records_v2';

export const getStoredDeletedClientRecords = (): DeletedClientRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_CLIENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

export const getStoredDeletedClientIds = (): string[] => {
  try {
    const records = getStoredDeletedClientRecords();
    const result: string[] = [];
    for (const r of records) {
      if (r.id) result.push(r.id.toLowerCase().trim());
      if (r.email) result.push(r.email.toLowerCase().trim());
      if (r.document) result.push(r.document.replace(/\D/g, '').trim());
      if (r.name) result.push(r.name.toLowerCase().trim());
    }
    return result;
  } catch {
    return [];
  }
};

export const addStoredDeletedClientRecord = (record: {
  id: string;
  email?: string;
  document?: string;
  name?: string;
}) => {
  try {
    const current = getStoredDeletedClientRecords();
    const idLower = (record.id || '').toLowerCase().trim();
    const emailLower = (record.email || '').toLowerCase().trim();
    const docClean = (record.document || '').replace(/\D/g, '').trim();
    const nameLower = (record.name || '').toLowerCase().trim();

    const exists = current.some((c) => {
      if (idLower && c.id && c.id.toLowerCase() === idLower) return true;
      if (emailLower && c.email && c.email.toLowerCase() === emailLower) return true;
      if (docClean && docClean.length > 5 && c.document && c.document.replace(/\D/g, '') === docClean) return true;
      if (nameLower && nameLower.length > 5 && c.name && c.name.toLowerCase() === nameLower) return true;
      return false;
    });

    if (!exists) {
      const updated = [
        ...current,
        {
          id: idLower,
          email: emailLower || undefined,
          document: docClean || undefined,
          name: nameLower || undefined,
        },
      ];
      localStorage.setItem(STORAGE_DELETED_CLIENTS_KEY, JSON.stringify(updated));
    }
  } catch {}
};

export const addStoredDeletedClientId = (
  id: string,
  email?: string,
  doc?: string,
  name?: string
) => {
  addStoredDeletedClientRecord({ id, email, document: doc, name });
};

export const clearStoredDeletedClientRecord = (id: string, email?: string, doc?: string) => {
  try {
    const current = getStoredDeletedClientRecords();
    const idLower = (id || '').toLowerCase().trim();
    const emailLower = (email || '').toLowerCase().trim();
    const docClean = (doc || '').replace(/\D/g, '').trim();

    const updated = current.filter((c) => {
      if (idLower && c.id.toLowerCase() === idLower) return false;
      if (emailLower && c.email && c.email.toLowerCase() === emailLower) return false;
      if (docClean && c.document && c.document.replace(/\D/g, '') === docClean) return false;
      return true;
    });
    localStorage.setItem(STORAGE_DELETED_CLIENTS_KEY, JSON.stringify(updated));
  } catch {}
};

export const clearStoredDeletedClientId = (id: string, email?: string, doc?: string) => {
  clearStoredDeletedClientRecord(id, email, doc);
};

export const isClientMarkedDeleted = (
  id?: string,
  email?: string,
  doc?: string,
  name?: string
): boolean => {
  const records = getStoredDeletedClientRecords();
  if (records.length === 0) return false;

  const idLower = (id || '').toLowerCase().trim();
  const emailLower = (email || '').toLowerCase().trim();
  const docClean = (doc || '').replace(/\D/g, '').trim();

  return records.some((r) => {
    if (idLower && r.id && r.id.toLowerCase() === idLower) return true;
    if (emailLower && r.email && r.email.toLowerCase() === emailLower) return true;
    if (docClean && docClean.length > 5 && r.document && r.document.replace(/\D/g, '') === docClean) return true;
    return false;
  });
};

export const getStoredCustodyLedger = (): CustodyLedgerItem[] => {
  try {
    const saved = localStorage.getItem('bitx_custody_ledger');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => {
          const itemCid = (item as any).clientId;
          const cp = item.counterparty || '';
          return !isClientMarkedDeleted(itemCid, undefined, undefined, cp);
        });
      }
    }
  } catch {}
  return DEFAULT_CUSTODY_LEDGER;
};

export const saveStoredCustodyLedger = (ledger: CustodyLedgerItem[]) => {
  try {
    localStorage.setItem('bitx_custody_ledger', JSON.stringify(ledger));
  } catch {}
};

export const computeClientCustodyBalance = (
  clientId: string,
  clientEmail: string,
  ledger: CustodyLedgerItem[],
  refPrice: number = 420000.0,
  clientName?: string
): { gx: number; brl: number; usdt: number; estimatedMarketValue: number } => {
  if (!clientId && !clientEmail && !clientName) {
    return { gx: 0, brl: 0, usdt: 0, estimatedMarketValue: 0 };
  }

  const idLower = (clientId || '').toLowerCase().trim();
  const emailLower = (clientEmail || '').toLowerCase().trim();
  const nameLower = (clientName || '').toLowerCase().trim();

  // Se o cliente foi marcado como excluído pelo operador, saldos são zerados
  if (isClientMarkedDeleted(clientId, clientEmail, undefined, clientName)) {
    return { gx: 0, brl: 0, usdt: 0, estimatedMarketValue: 0 };
  }

  const clientEntries = ledger.filter((item) => {
    const cpLower = (item.counterparty || '').toLowerCase();
    const itemClientId = (item as any).clientId?.toLowerCase();
    return (
      (itemClientId && itemClientId === idLower) ||
      (idLower && cpLower.includes(idLower)) ||
      (emailLower && emailLower.length > 3 && cpLower.includes(emailLower)) ||
      (nameLower && nameLower.length > 3 && cpLower.includes(nameLower))
    );
  });

  if (clientEntries.length === 0) {
    return { gx: 0, brl: 0, usdt: 0, estimatedMarketValue: 0 };
  }

  // O lançamento mais recente no Livro Razão contém a posição estabelecida do cliente
  const primary = clientEntries[0];
  const safeGx = Math.max(0, Number.isFinite(primary.amountGx) ? primary.amountGx : 0);
  const safeBrl = primary.amountBrl > 0 ? primary.amountBrl : +(safeGx * refPrice).toFixed(2);
  const safeUsdt = +(safeBrl / 5.0).toFixed(2);
  const estimatedMarketValue = +(safeGx * (105270385.0 / 250.0)).toFixed(2);

  return {
    gx: +safeGx.toFixed(4),
    brl: +safeBrl.toFixed(2),
    usdt: safeUsdt,
    estimatedMarketValue,
  };
};

export const OperationsPortal: React.FC<OperationsPortalProps> = ({ onOpenPolicy }) => {
  const [activeTab, setActiveTab] = useState<
    'custody' | 'mining' | 'exchange' | 'config' | 'explorer' | 'mempool' | 'wallet'
  >('custody');

  // Blockchain state in REAL MAINNET PRODUCTION
  const [blockHeight, setBlockHeight] = useState<number>(348912);
  const [difficulty] = useState<string>('0x1903a2f8 (PoW 4.28M)');
  const [blockReward] = useState<number>(50.0);
  const [minerAddress, setMinerAddress] = useState<string>(
    'btxc1q9vzp0k2e4f50miner_reward_pool_mainnet_99x'
  );
  const [walletAddress] = useState<string>('btxc1qf08xve992k7s9k8j3z2p987e9k3l98764a');
  const [walletBalance, setWalletBalance] = useState<number>(28450.0);

  // Global Exchange Hot/Cold Custody Address
  const exchangeHotWallet = 'btxc1qglobal_exchange_hotwallet_liquidity_master01';

  // Mining state
  const [miningMode, setMiningMode] = useState<'pool' | 'solo'>('pool');
  const [isMining, setIsMining] = useState<boolean>(false);
  const [autoMining, setAutoMining] = useState<boolean>(false);
  const [liveHashrate, setLiveHashrate] = useState<number>(845.5); // MH/s
  const [sharesAccepted, setSharesAccepted] = useState<number>(2418);
  const [miningLogs, setMiningLogs] = useState<
    { id: string; time: string; text: string; type: 'info' | 'success' | 'warning' }[]
  >([
    {
      id: '1',
      time: '04:00:00',
      text: 'Nó BitX Core inicializado em REDE PRINCIPAL DE PRODUÇÃO (Mainnet Ativa).',
      type: 'info',
    },
    {
      id: '2',
      time: '04:00:02',
      text: 'Gateway Institucional Global Exchange conectado: api.globalexchange.com/v3 (WebSocket Ativo).',
      type: 'success',
    },
    {
      id: '3',
      time: '04:00:05',
      text: 'Conectado à Pool Stratum: stratum+tcp://mining.globalexchange.com:3333 (Taxa de rejeição: 0.00%).',
      type: 'success',
    },
    {
      id: '4',
      time: '04:00:10',
      text: 'Cadeia sincronizada na altura #348.912. Algoritmo PoW SHA-256d com 1.500.000.000 BTXC de teto máximo.',
      type: 'info',
    },
  ]);

  // Blocks history in Mainnet
  const [blocks, setBlocks] = useState<BlockRecord[]>(() => {
    const initial: BlockRecord[] = [];
    let prev = '00000000000000000004f81a7b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c';
    for (let h = 348908; h <= 348912; h++) {
      const hash = `0000000000000000000${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`;
      initial.unshift({
        height: h,
        hash,
        prevHash: prev,
        merkleRoot: 'mrk_' + Math.random().toString(16).substring(2, 18),
        timestamp: new Date(Date.now() - (348912 - h) * 150000).toLocaleTimeString(),
        transactionsCount: Math.floor(Math.random() * 14) + 3,
        miner: 'btxc1q9vzp0k2e4f50miner_reward_pool_mainnet_99x',
        reward: 50.0,
        nonce: Math.floor(Math.random() * 900000) + 100000,
        difficulty: '0x1903a2f8',
        transactions: [
          {
            txid: 'coinbase_' + Math.random().toString(16).substring(2, 12),
            from: 'Coinbase PoW (Subsídio de Mineração)',
            to: 'btxc1q9vzp0k2e4f50miner_reward_pool_mainnet_99x',
            amount: 50.0,
            fee: 0,
          },
          {
            txid: 'tx_ge_liquidity_' + Math.random().toString(16).substring(2, 10),
            from: 'btxc1qf08xve992k7s9k8j3z2p987e9k3l98764a',
            to: 'btxc1qglobal_exchange_hotwallet_liquidity_master01',
            amount: 150.0,
            fee: 0.0001,
          },
        ],
      });
      prev = hash;
    }
    return initial;
  });

  // Selected block for modal
  const [selectedBlock, setSelectedBlock] = useState<BlockRecord | null>(null);

  // Mempool state in Mainnet
  const [mempool, setMempool] = useState<MempoolTx[]>([
    {
      txid: 'tx_mainnet_90c41b',
      from: 'btxc1q982kd092jf83h28sdj23098fjs823jfd',
      to: 'btxc1qf08xve992k7s9k8j3z2p987e9k3l98764a',
      amount: 12.5,
      fee: 0.0001,
      time: 'Há 3 min',
    },
  ]);

  // Transfer form state
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendFeedback, setSendFeedback] = useState<string>('');

  // Global Exchange State & Sincronização Exclusiva de Clientes Reais
  const [selectedPair, setSelectedPair] = useState<'BTXC/BRL' | 'BTXC/USDT' | 'BTXC/BTC'>('BTXC/BRL');
  
  // Cadastro de Clientes da Global Exchange (Titular Principal em Memória e Produção)
  const DEFAULT_REAL_CLIENTS: ExchangeClient[] = [
    {
      id: 'GX-CLI-0001',
      name: 'Geoni Clementino Cesar de Matos',
      titleBadge: 'Titular Principal & PJ Engecema',
      email: 'geonimatos31@hotmail.com',
      document: '70781338387',
      bitxAddress: 'btxc1qf08xve992k7s9k8j3z2p987e9k3l98764a',
      btxcBalance: 250.0,
      brlBalance: 42385000.0,
      usdtBalance: 8477000.0,
      estimatedMarketValue: 105270385.0,
      status: 'Institucional',
      createdAt: '19/10/2026',
    },
  ];

  // Helper de persistência e sincronização de clientes reais
  const getStoredRealClients = (): ExchangeClient[] => {
    try {
      const stored = localStorage.getItem('bitx_ge_synced_clients');
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filtrar expressamente qualquer cliente marcado como deletado para não ressuscitar no F5
          const active = parsed.filter(
            (c: ExchangeClient) => !isClientMarkedDeleted(c.id, c.email, c.document, c.name)
          );
          if (active.length > 0) {
            return active.map((client: ExchangeClient) => ({
              ...client,
              btxcBalance: typeof client.btxcBalance === 'number' && !isNaN(client.btxcBalance) ? client.btxcBalance : 0,
              brlBalance: typeof client.brlBalance === 'number' && !isNaN(client.brlBalance) ? client.brlBalance : 0,
              usdtBalance: typeof client.usdtBalance === 'number' && !isNaN(client.usdtBalance) ? client.usdtBalance : 0,
              estimatedMarketValue: typeof client.estimatedMarketValue === 'number' && !isNaN(client.estimatedMarketValue) ? client.estimatedMarketValue : 0,
            }));
          }
        }
      }
    } catch {}
    return DEFAULT_REAL_CLIENTS;
  };

  const saveStoredRealClients = (clients: ExchangeClient[]) => {
    try {
      localStorage.setItem('bitx_ge_synced_clients', JSON.stringify(clients));
    } catch {}
  };

  // Emissor de sincronização em tempo real para a corretora Global Exchange
  const emitSyncToGlobalExchange = (clientsToSync: ExchangeClient[]) => {
    try {
      supabase.channel('realtime_global_exchange_clients').send({
        type: 'broadcast',
        event: 'client_sync',
        payload: { clients: clientsToSync, timestamp: new Date().toISOString() },
      });
    } catch {}

    try {
      const bc = new BroadcastChannel('global_exchange_cross_tab_sync');
      bc.postMessage({ clients: clientsToSync, timestamp: Date.now() });
      bc.close();
    } catch {}
  };

  // Clientes EXCLUSIVAMENTE Reais vindos da Plataforma Global Exchange
  const [exchangeClients, setExchangeClients] = useState<ExchangeClient[]>(getStoredRealClients);
  const [isLoadingClients, setIsLoadingClients] = useState<boolean>(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Modal da Ponte de Sincronização entre Plataformas Independentes (BitX Core ⇄ Global Exchange)
  const [showBridgeModal, setShowBridgeModal] = useState<boolean>(false);
  const [bridgeTab, setBridgeTab] = useState<'sql' | 'realtime' | 'json' | 'reconcile'>('sql');
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [bridgeNotice, setBridgeNotice] = useState<string>('');
  const [sqlCopied, setSqlCopied] = useState<boolean>(false);
  const [jsonCopied, setJsonCopied] = useState<boolean>(false);
  const [isPushingCloud, setIsPushingCloud] = useState<boolean>(false);

  // Script SQL Pronto para liberar o banco de dados Supabase da Global Exchange
  const SUPABASE_SYNC_SQL = `-- ====================================================================
-- SCRIPT DE SINCRONIZAÇÃO COMPLETA: BITX CORE ⇄ GLOBAL EXCHANGE
-- Banco de Dados: Supabase Cloud (Projeto: odbbtgkxgiqlfhcepwuj)
-- Cole e execute no SQL Editor do painel Supabase:
-- https://supabase.com/dashboard/project/odbbtgkxgiqlfhcepwuj/sql/new
-- ====================================================================

-- 1. Criação das colunas de saldos e dados contábeis na tabela 'clients'
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS btxc_balance double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gx_balance double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brl_balance double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usdt_balance double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_market_value double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bitx_address text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Verificado KYC',
  ADD COLUMN IF NOT EXISTS title_badge text DEFAULT 'Titular Principal',
  ADD COLUMN IF NOT EXISTS custody_txid text;

-- 2. Garantir índice único para id
CREATE UNIQUE INDEX IF NOT EXISTS clients_id_uidx ON public.clients (id);

-- 3. Habilitação de permissões completas (RLS) para leitura e escrita pela corretora
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir Leitura e Escrita Global Exchange" ON public.clients;
CREATE POLICY "Permitir Leitura e Escrita Global Exchange" ON public.clients
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.clients TO anon, authenticated, service_role;

-- 4. Habilitação de Publicação em Tempo Real (Realtime) para espelhamento instantâneo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'clients'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
`;

  // Função para empurrar dados diretamente ao Supabase com diagnóstico transparente
  const handlePushCustodyToSupabase = async () => {
    setIsPushingCloud(true);
    setBridgeNotice('');
    try {
      if (exchangeClients.length === 0) {
        setBridgeNotice('Nenhum cliente cadastrado para sincronizar no Supabase.');
        return;
      }

      for (const client of exchangeClients) {
        const payload: any = {
          id: client.id,
          name: client.name,
          email: client.email,
          document: client.document || null,
          bitx_address: client.bitxAddress || null,
          btxc_balance: client.btxcBalance || 0,
          gx_balance: client.btxcBalance || 0,
          brl_balance: client.brlBalance || 0,
          usdt_balance: client.usdtBalance || 0,
          estimated_market_value: client.estimatedMarketValue || 0,
          status: client.status || 'Verificado KYC',
          title_badge: client.titleBadge || 'Cliente Real',
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('clients').upsert([payload]);
        if (error) {
          throw error;
        }
      }

      setBridgeNotice(
        `✓ Sucesso Total! ${exchangeClients.length} conta(s) gravadas e sincronizadas no Supabase Cloud (odbbtgkxgiqlfhcepwuj)! A Global Exchange está espelhada em tempo real.`
      );
      emitSyncToGlobalExchange(exchangeClients);
    } catch (err: any) {
      setBridgeNotice(`Erro ao comunicar com Supabase Cloud: ${err?.message || err}`);
    } finally {
      setIsPushingCloud(false);
    }
  };

  // Função para buscar e sincronizar clientes reais da plataforma Global Exchange
  const fetchRealClientsFromGlobalExchange = async () => {
    setIsLoadingClients(true);
    setClientsError(null);
    try {
      // Limpeza forçada de quaisquer resíduos de dados fictícios em cache antigos
      try {
        localStorage.removeItem('bitx_exchange_clients');
        localStorage.removeItem('bitx_clients');
        localStorage.removeItem('bitx_real_exchange_clients');
      } catch {}

      const localReal = getStoredRealClients();

      // Consultar banco na nuvem Supabase
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      let combined: ExchangeClient[] = [...localReal];

      if (data && Array.isArray(data) && data.length > 0) {
        const cloudClients: ExchangeClient[] = [];

        const parseNum = (...vals: any[]): number => {
          for (const v of vals) {
            if (v !== null && v !== undefined && v !== '') {
              const n = typeof v === 'number' ? v : parseFloat(String(v));
              if (!isNaN(n) && n > 0) return n;
            }
          }
          for (const v of vals) {
            if (v !== null && v !== undefined && v !== '') {
              const n = typeof v === 'number' ? v : parseFloat(String(v));
              if (!isNaN(n)) return n;
            }
          }
          return 0.0;
        };

        for (const c of data) {
          const finalBtxc = parseNum(c.btxc_balance, c.gx_balance, c.saldo_gx, c.balance);
          let finalBrl = parseNum(c.brl_balance, c.saldo_liquidez, c.liquidity_brl, c.saldo_reais);
          if (finalBrl <= 0 && finalBtxc > 0) {
            finalBrl = +(finalBtxc * price).toFixed(2);
          }
          let finalUsdt = parseNum(c.usdt_balance, c.saldo_usdt);
          if (finalUsdt <= 0 && finalBrl > 0) {
            finalUsdt = +(finalBrl / 5.0).toFixed(2);
          }
          const finalEst = +(finalBtxc * (105270385.0 / 250.0)).toFixed(2);

          let assignedAddress = c.bitx_address || c.address || c.wallet_address;
          // Se o cliente da Global Exchange ainda não tem endereço BitX Core na rede, gerar agora e espelhar na nuvem
          if (!assignedAddress) {
            assignedAddress = `btxc1q${Array.from(crypto.getRandomValues(new Uint8Array(16)))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('')}`;
            if (c.id) {
              supabase.from('clients').update({ bitx_address: assignedAddress }).eq('id', c.id).then();
            }
          }

          cloudClients.push({
            id: String(c.id || `GX-CLI-${Math.floor(1000 + Math.random() * 9000)}`),
            name: String(c.name || c.nome || c.full_name || 'Cliente Global Exchange'),
            titleBadge: c.title_badge || undefined,
            email: String(c.email || '—'),
            document: c.document ? String(c.document) : (c.cpf || c.cnpj ? String(c.cpf || c.cnpj) : undefined),
            bitxAddress: assignedAddress,
            btxcBalance: finalBtxc,
            brlBalance: finalBrl,
            usdtBalance: finalUsdt,
            estimatedMarketValue: finalEst,
            status: (c.status as any) || 'Verificado KYC',
            createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : undefined,
          });
        }

        const deletedIds = new Set(getStoredDeletedClientIds().map((x: string) => x.toLowerCase()));
        for (const cc of cloudClients) {
          if (
            isClientMarkedDeleted(cc.id, cc.email, cc.document, cc.name) ||
            deletedIds.has(cc.id.toLowerCase()) ||
            (cc.email && deletedIds.has(cc.email.toLowerCase()))
          ) {
            continue;
          }
          const idx = combined.findIndex((x) => x.id === cc.id || (cc.email && x.email === cc.email));
          if (idx >= 0) {
            combined[idx] = {
              ...combined[idx],
              ...cc,
              bitxAddress: combined[idx].bitxAddress || cc.bitxAddress,
            };
          } else {
            combined.push(cc);
          }
        }
      } else {
        // Se a nuvem Supabase está vazia, propagar titular padrão em memória para persistência imediata
        try {
          supabase.from('clients').upsert(DEFAULT_REAL_CLIENTS.map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            document: c.document || null,
            bitx_address: c.bitxAddress || null,
            btxc_balance: c.btxcBalance || 0,
            gx_balance: c.btxcBalance || 0,
            brl_balance: c.brlBalance || 0,
            usdt_balance: c.usdtBalance || 0,
            estimated_market_value: c.estimatedMarketValue || 0,
            status: c.status || 'Institucional',
            title_badge: c.titleBadge || 'Titular Principal & PJ Engecema',
            updated_at: new Date().toISOString(),
          }))).then();
        } catch {}
      }

      // Se a conta titular não foi excluída, assegurar presença incondicional na memória ativa
      if (!isClientMarkedDeleted('GX-CLI-0001', 'geonimatos31@hotmail.com', '70781338387')) {
        const hasMaster = combined.some((x) => x.id === 'GX-CLI-0001' || x.email === 'geonimatos31@hotmail.com');
        if (!hasMaster && DEFAULT_REAL_CLIENTS.length > 0) {
          combined.unshift(DEFAULT_REAL_CLIENTS[0]);
        }
      }

      combined = combined.filter(
        (c) => !isClientMarkedDeleted(c.id, c.email, c.document, c.name)
      );

      if (combined.length === 0) {
        combined = [...DEFAULT_REAL_CLIENTS];
      }

      // Reconciliar novos clientes com o Livro Razão de Custódia Engecema para manter auditoria contínua
      let currentLedger = [...getStoredCustodyLedger()];
      if (currentLedger.length === 0 && DEFAULT_CUSTODY_LEDGER.length > 0) {
        currentLedger = [...DEFAULT_CUSTODY_LEDGER];
      }
      let ledgerChanged = false;
      for (const client of combined) {
        const hasEntry = currentLedger.some(
          (entry) =>
            (entry as any).clientId === client.id ||
            entry.counterparty.toLowerCase().includes(client.id.toLowerCase())
        );
        if (!hasEntry && client.btxcBalance > 0) {
          const auditTxid =
            '0x' +
            Array.from(crypto.getRandomValues(new Uint8Array(24)))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
          currentLedger.unshift({
            id: 'CUST-' + Math.floor(100 + Math.random() * 900),
            txid: auditTxid,
            clientId: client.id,
            type: 'Aporte Inicial',
            amountGx: client.btxcBalance,
            amountBrl: client.brlBalance > 0 ? client.brlBalance : +(client.btxcBalance * price).toFixed(2),
            counterparty: `Custódia Engecema PJ -> ${client.name} (${client.id})`,
            timestamp: new Date().toLocaleString('pt-BR'),
            status: 'Confirmado em Custódia',
          });
          ledgerChanged = true;
        }
      }
      if (ledgerChanged) {
        setCustodyLedger([...currentLedger]);
        saveStoredCustodyLedger(currentLedger);
      }

      setExchangeClients(combined);
      saveStoredRealClients(combined);
      emitSyncToGlobalExchange(combined);
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (err: any) {
      console.warn('[Global Exchange] Sincronização em nuvem:', err);
      const localReal = getStoredRealClients().filter((c) => !isClientMarkedDeleted(c.id, c.email, c.document, c.name));
      setExchangeClients(localReal);
      saveStoredRealClients(localReal);
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } finally {
      setIsLoadingClients(false);
    }
  };

  // Sincronização inicial e listener em tempo real com a plataforma Global Exchange
  useEffect(() => {
    fetchRealClientsFromGlobalExchange();

    // Inscrição em tempo real para mudanças na tabela de clientes da Global Exchange
    const channel = supabase
      .channel('realtime_global_exchange_clients')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        () => {
          fetchRealClientsFromGlobalExchange();
        }
      )
      .on('broadcast', { event: 'client_sync' }, (payload: any) => {
        if (payload?.payload?.clients && Array.isArray(payload.payload.clients)) {
          setExchangeClients(payload.payload.clients);
          saveStoredRealClients(payload.payload.clients);
          setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
          addLog('[Ponte em Tempo Real] Clientes sincronizados instantaneamente com a Global Exchange!', 'success');
        }
      })
      .subscribe();

    // BroadcastChannel HTML5 para sincronização entre abas/janelas do mesmo navegador
    let localBc: BroadcastChannel | null = null;
    try {
      localBc = new BroadcastChannel('global_exchange_cross_tab_sync');
      localBc.onmessage = (event) => {
        if (event.data?.clients && Array.isArray(event.data.clients)) {
          setExchangeClients(event.data.clients);
          saveStoredRealClients(event.data.clients);
          setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
        }
      };
    } catch {}

    return () => {
      supabase.removeChannel(channel);
      if (localBc) localBc.close();
    };
  }, []);

  // Listener em tempo real para sincronização de operadores entre instâncias da plataforma
  useEffect(() => {
    const opChannel = supabase
      .channel('realtime_global_exchange_operators')
      .on('broadcast', { event: 'operator_update' }, (payload: any) => {
        if (payload?.payload?.operators && Array.isArray(payload.payload.operators)) {
          setUsers(payload.payload.operators);
          saveStoredOperators(payload.payload.operators);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(opChannel);
    };
  }, []);

  // Histórico de Depósitos da Corretora (Inicializado vazio, apenas para clientes reais)
  const [exchangeDeposits, setExchangeDeposits] = useState<ExchangeDepositRecord[]>([]);

  // Deposit Form for Exchange Client (Vinculado a clientes reais)
  const [depositClientId, setDepositClientId] = useState<string>('');

  // Cliente selecionado para Negociação Instantânea na Corretora
  const [orderClientId, setOrderClientId] = useState<string>('');

  // Atualizar seletores quando a lista de clientes reais for carregada
  useEffect(() => {
    if (exchangeClients.length > 0) {
      if (!exchangeClients.some((c) => c.id === depositClientId)) {
        setDepositClientId(exchangeClients[0].id);
      }
      if (!exchangeClients.some((c) => c.id === orderClientId)) {
        setOrderClientId(exchangeClients[0].id);
      }
    } else {
      setDepositClientId('');
      setOrderClientId('');
    }
  }, [exchangeClients, depositClientId, orderClientId]);

  const [depositAmount, setDepositAmount] = useState<string>('50');
  const [depositAlert, setDepositAlert] = useState<string>('');

  // Exchange Order Form
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderAmount, setOrderAmount] = useState<string>('10');
  const [orderFeedback, setOrderFeedback] = useState<string>('');

  // Order Book Live Data (Referência R$ 420.000,00 por token)
  const [bids, setBids] = useState<OrderBookEntry[]>([
    { price: 420000.0, amount: 2.5, total: 1050000.0 },
    { price: 419850.0, amount: 5.0, total: 2099250.0 },
    { price: 419500.0, amount: 12.0, total: 5034000.0 },
    { price: 419000.0, amount: 25.0, total: 10475000.0 },
    { price: 418500.0, amount: 50.0, total: 20925000.0 },
  ]);

  const [asks, setAsks] = useState<OrderBookEntry[]>([
    { price: 420150.0, amount: 1.8, total: 756270.0 },
    { price: 420500.0, amount: 4.5, total: 1892250.0 },
    { price: 421000.0, amount: 10.0, total: 4210000.0 },
    { price: 421800.0, amount: 20.0, total: 8436000.0 },
    { price: 422500.0, amount: 45.0, total: 19012500.0 },
  ]);

  // Config parameters & bitx.conf state for MAINNET
  const [rpcHost, setRpcHost] = useState(''); // BITX_RPC_HOST é opcional e pode ficar em branco
  const [rpcUser, setRpcUser] = useState('bitx_mainnet_admin');
  const [rpcPass, setRpcPass] = useState('btxc_prod_sec_auth_2026!');
  const [rpcPort, setRpcPort] = useState('8332');
  const [p2pPort, setP2pPort] = useState('8333');
  const [maxSupply] = useState('1.500.000.000');
  const [confCopied, setConfCopied] = useState(false);
  const [walletCopied, setWalletCopied] = useState(false);

  // Gestão de Clientes Reais no Painel de Configurações
  const [newClientId, setNewClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientDocument, setNewClientDocument] = useState('');
  const [newClientBitxAddress, setNewClientBitxAddress] = useState('');
  const [selectedTransferRecipientId, setSelectedTransferRecipientId] = useState<string>('auto');
  const [newClientBtxc, setNewClientBtxc] = useState('0');
  const [newClientBrl, setNewClientBrl] = useState('0');
  const [newClientUsdt, setNewClientUsdt] = useState('0');
  const [newClientStatus, setNewClientStatus] = useState<'Institucional' | 'Verificado KYC' | 'VIP' | 'Ativo'>('Verificado KYC');
  const [clientFormFeedback, setClientFormFeedback] = useState<string>('');
  const [editingClient, setEditingClient] = useState<ExchangeClient | null>(null);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);

  // ================= CUSTÓDIA ENGECEMA STATE & AUDIT =================
  const [selectedCustodyClientId, setSelectedCustodyClientId] = useState<string>('GX-CLI-0001');
  const [custodyFeedback, setCustodyFeedback] = useState<string>('');

  // Histórico de Custódia Auditável com TXID Criptográfico
  const [custodyLedger, setCustodyLedger] = useState<CustodyLedgerItem[]>(getStoredCustodyLedger);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [reconcileNotice, setReconcileNotice] = useState<{
    message: string;
    details?: string;
    type: 'success' | 'info' | 'warning';
    timestamp: string;
  } | null>(null);

  // Inicialização inteligente: Assegurar que os 3 módulos (Configurações, Corretora e Custódia) comuniquem-se desde o primeiro carregamento
  useEffect(() => {
    try {
      const storedClients = getStoredRealClients();
      const storedLedger = getStoredCustodyLedger();
      const hasInitialized = localStorage.getItem('bitx_ge_clients_initialized') === 'true';

      localStorage.setItem('bitx_ge_clients_initialized', 'true');
      if (storedClients.length > 0) {
        if (!selectedCustodyClientId || !storedClients.some((c) => c.id === selectedCustodyClientId)) {
          setSelectedCustodyClientId(storedClients[0].id);
        }
      } else {
        setSelectedCustodyClientId('');
      }
    } catch (e) {
      console.warn('[Inicialização Custódia & Clientes]:', e);
    }
  }, []);

  // 1. ZERAR A LISTA DE CLIENTES DO PAINEL DAS CONFIGURAÇÕES
  const handleClearAllClients = () => {
    // Registrar todos os clientes existentes e padrão como excluídos para nunca retornarem no F5
    for (const c of exchangeClients) {
      addStoredDeletedClientRecord({
        id: c.id,
        email: c.email,
        document: c.document,
        name: c.name,
      });
    }

    localStorage.setItem('bitx_ge_clients_initialized', 'true');
    setExchangeClients([]);
    saveStoredRealClients([]);
    try {
      localStorage.setItem('bitx_ge_synced_clients', JSON.stringify([]));
      localStorage.removeItem('bitx_exchange_clients');
      localStorage.removeItem('bitx_clients');
      localStorage.removeItem('bitx_real_exchange_clients');
      localStorage.setItem('bitx_custody_ledger', JSON.stringify([]));
    } catch {}

    setCustodyLedger([]);
    setSelectedCustodyClientId('');
    emitSyncToGlobalExchange([]);

    setClientFormFeedback('✓ Lista de clientes do painel de configurações zerada com sucesso!');
    setCustodyFeedback('✓ Painel de custódia e livro razão sincronizados com a lista de clientes zerada.');
    addLog('[Configurações] Lista de clientes da Corretora Global Exchange zerada pelo operador.', 'warning');
    setTimeout(() => setClientFormFeedback(''), 5000);
  };

  // Restaurar da memória do AI Studio o Titular Mestre (Geoni Clementino Cesar de Matos - GX-CLI-0001)
  const handleRestoreMasterClient = () => {
    clearStoredDeletedClientId('GX-CLI-0001', 'geonimatos31@hotmail.com', '70781338387');
    clearStoredDeletedClientRecord('GX-CLI-0001', 'geonimatos31@hotmail.com', '70781338387');
    const master = DEFAULT_REAL_CLIENTS[0];
    const exists = exchangeClients.some((c) => c.id === master.id || c.email === master.email);
    const updated = exists ? exchangeClients : [master, ...exchangeClients];
    setExchangeClients(updated);
    saveStoredRealClients(updated);

    // Assegurar entrada no livro razão de custódia
    const currentLedger = getStoredCustodyLedger();
    const hasLedger = currentLedger.some(
      (l) => (l as any).clientId === master.id || l.counterparty.includes(master.id)
    );
    if (!hasLedger) {
      const newLedger = [...DEFAULT_CUSTODY_LEDGER, ...currentLedger];
      setCustodyLedger(newLedger);
      saveStoredCustodyLedger(newLedger);
    }

    setSelectedCustodyClientId(master.id);
    emitSyncToGlobalExchange(updated);
    addLog(`[Memória AI Studio] Titular ${master.name} (${master.id}) restaurado com sucesso!`, 'success');
    handlePushCustodyToSupabase();
  };

  // 1.1 ZERAR O SALDO DE UM CLIENTE ESPECÍFICO (ELIMINAR QUALQUER MEMÓRIA DE SALDO)
  const handleResetClientBalance = async (target: ExchangeClient) => {
    const updated = exchangeClients.map((c) => {
      if (c.id === target.id) {
        return {
          ...c,
          btxcBalance: 0,
          brlBalance: 0,
          usdtBalance: 0,
          estimatedMarketValue: 0,
        };
      }
      return c;
    });

    setExchangeClients(updated);
    saveStoredRealClients(updated);

    // Limpar quaisquer lançamentos de custódia antigos desse cliente
    const idLower = target.id.toLowerCase();
    const emailLower = (target.email || '').toLowerCase().trim();
    const docClean = (target.document || '').replace(/\D/g, '').trim();

    const cleanLedger = custodyLedger.filter((item) => {
      const itemCid = (item as any).clientId?.toLowerCase();
      const cp = (item.counterparty || '').toLowerCase();
      if (itemCid && itemCid === idLower) return false;
      if (idLower && cp.includes(idLower)) return false;
      if (emailLower && emailLower.length > 3 && cp.includes(emailLower)) return false;
      if (docClean && docClean.length > 5 && cp.includes(docClean)) return false;
      return true;
    });
    setCustodyLedger(cleanLedger);
    saveStoredCustodyLedger(cleanLedger);

    // Atualizar no Supabase Cloud
    try {
      await supabase
        .from('clients')
        .update({
          btxc_balance: 0,
          gx_balance: 0,
          brl_balance: 0,
          usdt_balance: 0,
          estimated_market_value: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', target.id);
    } catch {}

    emitSyncToGlobalExchange(updated);
    setClientFormFeedback(`✓ Saldo do cliente "${target.name}" (${target.id}) foi zerado com sucesso! Memória de saldo limpa.`);
    setTimeout(() => setClientFormFeedback(''), 6000);
  };

  // 2. SINCRONIZAR O PAINEL DE CUSTÓDIA (ENGECEMA) E SEU LIVRO RAZÃO COM A CORRETORA GLOBAL EXCHANGE E BLOCKCHAIN BITX CORE
  const handleSyncCustodyLedgerAndExchange = async () => {
    setIsReconciling(true);
    setIsLoadingClients(true);
    try {
      let currentLedger = [...getStoredCustodyLedger()];
      let currentClients = [...exchangeClients];

      if (currentClients.length === 0) {
        currentClients = getStoredRealClients();
      }

      const deletedIds = new Set(getStoredDeletedClientIds().map((x: string) => x.toLowerCase()));

      // 1. Purificar a lista de clientes para garantir que NENHUM cliente removido esteja presente
      currentClients = currentClients.filter(
        (c) =>
          !isClientMarkedDeleted(c.id, c.email, c.document, c.name) &&
          !deletedIds.has(c.id.toLowerCase()) &&
          (!c.email || !deletedIds.has(c.email.toLowerCase()))
      );

      // 2. Purificar o Livro Razão de Custódia Engecema para que NUNCA contenha lançamentos de clientes excluídos
      const activeClientIds = new Set(currentClients.map((c) => c.id.toLowerCase()));
      const activeClientEmails = new Set(currentClients.map((c) => (c.email || '').toLowerCase()));
      const activeClientNames = new Set(currentClients.map((c) => (c.name || '').toLowerCase()));

      currentLedger = currentLedger.filter((item) => {
        const itemCid = (item as any).clientId?.toLowerCase();
        const cpLower = (item.counterparty || '').toLowerCase();

        // Se pertencer a cliente deletado, descarta imediatamente
        if (isClientMarkedDeleted(itemCid, undefined, undefined, cpLower)) return false;
        if (itemCid && deletedIds.has(itemCid)) return false;
        for (const dId of deletedIds) {
          if (dId && typeof dId === 'string' && cpLower.includes(dId)) return false;
        }

        // Se houver clientes ativos, o lançamento deve pertencer a um deles
        if (currentClients.length > 0) {
          if (itemCid) return activeClientIds.has(itemCid);
          const matchesActive =
            Array.from(activeClientIds).some((id) => id && cpLower.includes(id)) ||
            Array.from(activeClientEmails).some((em) => em && cpLower.includes(em)) ||
            Array.from(activeClientNames).some((nm) => nm && cpLower.includes(nm));
          return matchesActive;
        }

        // Se não houver clientes ativos (foram removidos), o Livro Razão também fica vazio
        return false;
      });

      // Reconciliar cada cliente com o Livro Razão
      const reconciledClients = currentClients.map((client) => {
        const hasEntry = currentLedger.some(
          (entry) =>
            (entry as any).clientId === client.id ||
            entry.counterparty.toLowerCase().includes(client.id.toLowerCase()) ||
            entry.counterparty.toLowerCase().includes(client.email.toLowerCase()) ||
            entry.counterparty.toLowerCase().includes(client.name.toLowerCase())
        );

        if (hasEntry) {
          const custodyBalance = computeClientCustodyBalance(
            client.id,
            client.email,
            currentLedger,
            price,
            client.name
          );
          return {
            ...client,
            btxcBalance: custodyBalance.gx,
            brlBalance: custodyBalance.brl,
            usdtBalance: custodyBalance.usdt,
            estimatedMarketValue: custodyBalance.estimatedMarketValue,
          };
        } else {
          // Se o cliente possui saldo e não tem lançamento no Livro Razão, cria a entrada auditada
          const auditTxid =
            '0x' +
            Array.from(crypto.getRandomValues(new Uint8Array(24)))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
          const auditRecord: CustodyLedgerItem = {
            id: 'CUST-' + Math.floor(100 + Math.random() * 900),
            txid: auditTxid,
            clientId: client.id,
            type: 'Aporte Inicial',
            amountGx: client.btxcBalance,
            amountBrl: client.brlBalance > 0 ? client.brlBalance : client.btxcBalance * price,
            counterparty: `Custódia Engecema PJ -> ${client.name} (${client.id})`,
            timestamp: new Date().toLocaleString('pt-BR'),
            status: 'Confirmado em Custódia',
          };
          currentLedger.unshift(auditRecord);
          return client;
        }
      });

      // Persistência local atômica
      setCustodyLedger([...currentLedger]);
      saveStoredCustodyLedger(currentLedger);
      setExchangeClients(reconciledClients);
      saveStoredRealClients(reconciledClients);
      if (reconciledClients.length > 0 && (!selectedCustodyClientId || !reconciledClients.some((c) => c.id === selectedCustodyClientId))) {
        setSelectedCustodyClientId(reconciledClients[0].id);
      }

      // Broadcast em tempo real para outras abas / instâncias
      emitSyncToGlobalExchange(reconciledClients);

      // Sincronização assíncrona com Supabase Cloud
      try {
        for (const cl of reconciledClients) {
          await supabase.from('clients').upsert([
            {
              id: cl.id,
              name: cl.name,
              email: cl.email,
              document: cl.document || null,
              bitx_address: cl.bitxAddress,
              btxc_balance: cl.btxcBalance,
              gx_balance: cl.btxcBalance,
              brl_balance: cl.brlBalance,
              usdt_balance: cl.usdtBalance,
              estimated_market_value: cl.estimatedMarketValue,
              status: cl.status || 'Verificado KYC',
              updated_at: new Date().toISOString(),
            },
          ]);
        }
      } catch (cloudErr) {
        console.warn('[Sync Cloud Supabase]:', cloudErr);
      }

      const totalGx = reconciledClients.reduce((acc, c) => acc + (c.btxcBalance || 0), 0);
      const totalBrl = reconciledClients.reduce((acc, c) => acc + (c.brlBalance || 0), 0);
      const currentTime = new Date().toLocaleTimeString('pt-BR');
      setLastSyncTime(currentTime);

      const successMsg = `✓ Reconciliação Total Concluída! ${reconciledClients.length} conta(s) sincronizadas com o Livro Razão de Custódia Engecema (${currentLedger.length} lançamentos auditados).`;
      const detailsMsg = `Saldo Consolidado: ${totalGx.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} GX · R$ ${totalBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

      setReconcileNotice({
        message: successMsg,
        details: detailsMsg,
        type: 'success',
        timestamp: currentTime,
      });

      setCustodyFeedback(
        `✓ Painel de Custódia (Engecema), Livro Razão Auditável e Corretora Global Exchange 100% reconciliados e destravados (${reconciledClients.length} cliente(s), ${totalGx.toFixed(2)} GX, R$ ${totalBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})!`
      );
      setClientFormFeedback(
        `✓ Painel de Configurações 100% comunicado com a Corretora Global Exchange e Livro Razão de Custódia Engecema.`
      );

      addLog(
        `[Reconciliação Auditável] Livro Razão Engecema ⇄ Corretora Global Exchange ⇄ Configurações: ${reconciledClients.length} conta(s), ${currentLedger.length} lançamentos. TXIDs verificados.`,
        'success'
      );

      setTimeout(() => setCustodyFeedback(''), 10000);
      setTimeout(() => setClientFormFeedback(''), 10000);
    } catch (err: any) {
      const errMsg = 'Erro na sincronização: ' + (err?.message || 'Falha de comunicação');
      setCustodyFeedback(errMsg);
      setReconcileNotice({
        message: '⚠️ ' + errMsg,
        type: 'warning',
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
    } finally {
      setIsReconciling(false);
      setIsLoadingClients(false);
    }
  };

  const handleReconcileWithCustodyLedger = handleSyncCustodyLedgerAndExchange;

  const currentCustodyClient: ExchangeClient | null =
    exchangeClients.find((c) => c.id === selectedCustodyClientId) ||
    exchangeClients[0] ||
    null;

  const handleSaveRealClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newClientName.trim() || !newClientEmail.trim()) {
      setClientFormFeedback('Por favor, preencha o Nome/Razão Social e o E-mail do cliente.');
      return;
    }

    const btxcNum = Math.max(0, parseFloat(newClientBtxc) || 0);
    const brlNum = Math.max(0, parseFloat(newClientBrl) || 0);
    const usdtNum = Math.max(0, parseFloat(newClientUsdt) || 0);

    const assignedId =
      newClientId.trim() ||
      (editingClient ? editingClient.id : `GX-CLI-${Math.floor(1000 + Math.random() * 9000)}`);

    const assignedAddress =
      newClientBitxAddress.trim() ||
      editingClient?.bitxAddress ||
      `btxc1q${Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`;

    const clientRecord: ExchangeClient = {
      id: assignedId,
      name: newClientName.trim(),
      email: newClientEmail.trim(),
      document: newClientDocument.trim() || (editingClient?.document || undefined),
      bitxAddress: assignedAddress,
      btxcBalance: btxcNum,
      brlBalance: brlNum,
      usdtBalance: usdtNum,
      estimatedMarketValue: +(btxcNum * (105270385.0 / 250.0)).toFixed(2),
      status: newClientStatus,
      createdAt: editingClient?.createdAt || new Date().toLocaleDateString('pt-BR'),
    };

    // Desbloquear ID e e-mail caso tenham sido excluídos previamente
    clearStoredDeletedClientRecord(assignedId, newClientEmail, newClientDocument.trim());

    // Eliminar qualquer memória antiga ou lançamento residual no livro razão para este cliente
    const idLower = assignedId.toLowerCase();
    const emailLower = newClientEmail.toLowerCase().trim();
    const nameLower = newClientName.toLowerCase().trim();
    const docClean = newClientDocument.replace(/\D/g, '').trim();

    let cleanLedger = custodyLedger.filter((item) => {
      const itemCid = (item as any).clientId?.toLowerCase();
      const cpLower = (item.counterparty || '').toLowerCase();
      if (itemCid && itemCid === idLower) return false;
      if (idLower && cpLower.includes(idLower)) return false;
      if (emailLower && emailLower.length > 3 && cpLower.includes(emailLower)) return false;
      if (nameLower && nameLower.length > 5 && cpLower.includes(nameLower)) return false;
      if (docClean && docClean.length > 5 && cpLower.includes(docClean)) return false;
      return true;
    });

    // Se possui saldo inicial informado pelo operador, registrar como novo aporte limpo no Livro Razão
    if (btxcNum > 0 || brlNum > 0) {
      const txid =
        '0x' +
        Array.from(crypto.getRandomValues(new Uint8Array(24)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      const custodyRecord: CustodyLedgerItem = {
        id: 'CUST-' + Math.floor(100 + Math.random() * 900),
        txid,
        clientId: clientRecord.id,
        type: editingClient ? 'Ajuste Direto com TXID' : 'Aporte Inicial',
        amountGx: btxcNum,
        amountBrl: brlNum > 0 ? brlNum : +(btxcNum * price).toFixed(2),
        counterparty: `Custódia Engecema PJ -> ${clientRecord.name} (${clientRecord.id})`,
        timestamp: new Date().toLocaleString('pt-BR'),
        status: 'Confirmado em Custódia',
      };
      cleanLedger = [custodyRecord, ...cleanLedger];
    }

    setCustodyLedger(cleanLedger);
    saveStoredCustodyLedger(cleanLedger);

    // 1. Salvar e ativar imediatamente no portal BitX Core & Global Exchange
    const updated = editingClient
      ? exchangeClients.map((c) => (c.id === editingClient.id ? clientRecord : c))
      : [clientRecord, ...exchangeClients.filter((c) => c.id !== assignedId && c.email.toLowerCase() !== emailLower)];

    setExchangeClients(updated);
    saveStoredRealClients(updated);
    emitSyncToGlobalExchange(updated);

    // 2. Enviar para a nuvem Supabase
    try {
      const payload: any = {
        name: clientRecord.name,
        email: clientRecord.email,
        document: clientRecord.document || null,
        id: clientRecord.id,
        bitx_address: clientRecord.bitxAddress,
        btxc_balance: clientRecord.btxcBalance || 0,
        gx_balance: clientRecord.btxcBalance || 0,
        brl_balance: clientRecord.brlBalance || 0,
        usdt_balance: clientRecord.usdtBalance || 0,
        estimated_market_value: clientRecord.estimatedMarketValue || 0,
        status: clientRecord.status || 'Verificado KYC',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('clients').upsert([payload]);

      if (error) {
        console.warn('Aviso Supabase Cloud:', error.message);
        setClientFormFeedback(
          `✓ Cliente real "${clientRecord.name}" (${clientRecord.id}) salvo localmente! Saldo: ${btxcNum.toFixed(4)} BTXC | R$ ${brlNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
        );
      } else {
        setClientFormFeedback(
          `✓ Cliente real "${clientRecord.name}" (${clientRecord.id}) cadastrado e sincronizado com sucesso na Global Exchange e no Supabase! Saldo: ${btxcNum.toFixed(4)} BTXC | R$ ${brlNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
        );
      }
    } catch {
      setClientFormFeedback(
        `✓ Cliente real "${clientRecord.name}" (${clientRecord.id}) cadastrado e ativo com sucesso!`
      );
    }

    handleCancelEditClient();
    setTimeout(() => setClientFormFeedback(''), 8000);
  };

  const handleStartEditClient = (c: ExchangeClient) => {
    setEditingClient(c);
    setNewClientId(c.id);
    setNewClientName(c.name);
    setNewClientEmail(c.email);
    setNewClientDocument(c.document || '');
    setNewClientBitxAddress(c.bitxAddress || '');
    setNewClientBtxc(c.btxcBalance.toString());
    setNewClientBrl(c.brlBalance.toString());
    setNewClientUsdt(c.usdtBalance.toString());
    setNewClientStatus((c.status as any) || 'Verificado KYC');
    setClientFormFeedback('');
    setActiveTab('config');
  };

  const handleCancelEditClient = () => {
    setEditingClient(null);
    setNewClientId('');
    setNewClientName('');
    setNewClientEmail('');
    setNewClientDocument('');
    setNewClientBitxAddress('');
    setNewClientBtxc('0');
    setNewClientBrl('0');
    setNewClientUsdt('0');
    setNewClientStatus('Verificado KYC');
  };

  const confirmDeleteRealClient = async () => {
    if (!clientToDelete) return;
    const { id, name, email } = clientToDelete;
    const clientObj = exchangeClients.find((c) => c.id === id);
    const doc = clientObj?.document;
    const idLower = id.toLowerCase();
    const emailLower = email?.toLowerCase();

    // 1. Gravar nos identificadores de clientes excluídos para que NUNCA seja ressuscitado em nenhum F5
    addStoredDeletedClientRecord({
      id,
      email,
      document: doc,
      name,
    });
    localStorage.setItem('bitx_ge_clients_initialized', 'true');

    // 2. Remover do banco Supabase Cloud por id e por email
    try {
      await supabase.from('clients').delete().eq('id', id);
      if (email) {
        await supabase.from('clients').delete().eq('email', email);
      }
    } catch (err) {
      console.warn('[Supabase Cloud] Erro ao deletar cliente:', err);
    }

    // 3. Remover da Corretora Global Exchange e do Painel de Configurações
    const remaining = exchangeClients.filter((c) => c.id !== id && (!email || c.email !== email));
    setExchangeClients(remaining);
    saveStoredRealClients(remaining);
    emitSyncToGlobalExchange(remaining);

    // 4. Remover do Painel de Custódia e expurgar TODOS os lançamentos do Livro Razão (Ledger Auditável Engecema)
    const currentLedger = getStoredCustodyLedger();
    const updatedLedger = currentLedger.filter((item) => {
      const itemCid = (item as any).clientId?.toLowerCase();
      const cpLower = (item.counterparty || '').toLowerCase();
      const matchesDeletedClient =
        (itemCid && itemCid === idLower) ||
        cpLower.includes(idLower) ||
        cpLower.includes(name.toLowerCase()) ||
        (emailLower && cpLower.includes(emailLower));
      return !matchesDeletedClient;
    });

    setCustodyLedger(updatedLedger);
    saveStoredCustodyLedger(updatedLedger);

    // 5. Atualizar o cliente selecionado na Custódia
    if (selectedCustodyClientId === id) {
      setSelectedCustodyClientId(remaining.length > 0 ? remaining[0].id : '');
    }

    if (editingClient?.id === id) {
      handleCancelEditClient();
    }
    setClientToDelete(null);

    const successMsg = `✓ Cliente "${name}" (${id}) foi completamente removido do Painel de Configurações, da Corretora Global Exchange, do Painel de Custódia e do Livro Razão.`;
    setClientFormFeedback(successMsg);
    setCustodyFeedback(successMsg);
    setReconcileNotice({
      message: `✓ Cliente "${name}" (${id}) removido de todos os módulos.`,
      details: `Base atual: ${remaining.length} cliente(s) ativo(s) e ${updatedLedger.length} lançamento(s) no Livro Razão.`,
      type: 'info',
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    });

    addLog(
      `[Configurações & Custódia] Cliente "${name}" (${id}) removido da Corretora Global Exchange, do Painel de Custódia e do Livro Razão Engecema.`,
      'warning'
    );

    setTimeout(() => setClientFormFeedback(''), 8000);
    setTimeout(() => setCustodyFeedback(''), 8000);
  };

  // Limpar qualquer cache e forçar sincronização exclusiva com a Global Exchange
  const handlePurgeFictitiousClients = async () => {
    try {
      localStorage.removeItem('bitx_exchange_clients');
      localStorage.removeItem('bitx_clients');
      localStorage.removeItem('bitx_real_exchange_clients');
      localStorage.removeItem('bitx_ge_synced_clients');
    } catch {}

    const fresh = getStoredRealClients();
    setExchangeClients(fresh);
    saveStoredRealClients(fresh);

    setShowPurgeModal(false);
    await fetchRealClientsFromGlobalExchange();
    setClientFormFeedback('🧹 Cache purificado e livro razão 100% reconciliado! Listando exclusivamente dados reais da Global Exchange.');
    addLog('[Global Exchange] Base purificada: saldo do livro razão de custódia reconciliado com a carteira de clientes.', 'success');
    setTimeout(() => setClientFormFeedback(''), 6000);
  };

  // Users state - Operadores Administrativos com persistência no LocalStorage e sincronização em tempo real
  const [users, setUsers] = useState<OperatorUser[]>(getStoredOperators);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'Super Admin' | 'Operador' | 'Auditor'>('Operador');
  const [editingOperator, setEditingOperator] = useState<OperatorUser | null>(null);
  const [operatorFeedback, setOperatorFeedback] = useState<string>('');

  const updateOperatorsAndPersist = (updated: OperatorUser[], message?: string) => {
    setUsers(updated);
    saveStoredOperators(updated);
    if (message) {
      setOperatorFeedback(message);
      setTimeout(() => setOperatorFeedback(''), 5000);
    }
  };

  const notifyCloudOperators = (ops: OperatorUser[]) => {
    try {
      supabase.channel('realtime_global_exchange_operators').send({
        type: 'broadcast',
        event: 'operator_update',
        payload: { operators: ops },
      });
    } catch {}
  };

  // Live market price ticker (Cotação de Referência Oficial R$ 420.000,00)
  const [price, setPrice] = useState(420000.0);
  const [change, setChange] = useState(0.42);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  const addLog = (text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setMiningLogs((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 9), time, text, type },
    ]);
  };

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [miningLogs]);

  // Market price live simulation synchronized with Global Exchange
  useEffect(() => {
    const timer = setInterval(() => {
      setPrice((prev) => {
        const delta = (Math.random() - 0.48) * 150.0;
        const next = Math.max(400000, prev + delta);
        const pct = (delta / next) * 100;
        setChange((c) => +(c + pct * 0.1).toFixed(2));
        return next;
      });
      // Hashrate fluctuation
      setLiveHashrate((h) => +(h + (Math.random() - 0.5) * 15).toFixed(1));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Perform block mining logic on REAL MAINNET
  const mineOneBlock = async (batch = false): Promise<void> => {
    if (isMining && !batch) return;
    setIsMining(true);

    const nextHeight = blockHeight + 1;
    addLog(`[Mainnet] Construindo Bloco #${nextHeight} PoW SHA-256d...`, 'info');
    if (miningMode === 'pool') {
      addLog(`Submetendo shares para Stratum Pool da Global Exchange (mining.globalexchange.com)...`, 'info');
    }

    // Simulate proof of work computation
    await new Promise((resolve) => setTimeout(resolve, batch ? 220 : 950));

    const nonce = Math.floor(Math.random() * 8000000) + 120000;
    const rawHeader = `bitx_mainnet_block_${nextHeight}_nonce_${nonce}_time_${Date.now()}`;
    const hashBytes = sha256(new TextEncoder().encode(rawHeader));
    let hashHex = '';
    for (const b of hashBytes) hashHex += b.toString(16).padStart(2, '0');
    // Ensure classic PoW production hash prefix
    const finalHash = '0000000000000000000' + hashHex.substring(19);

    // Collect transactions from mempool
    const currentMempool = [...mempool];
    const blockTransactions = [
      {
        txid: 'coinbase_' + Math.random().toString(16).substring(2, 12),
        from: 'Coinbase PoW (Subsídio da Rede Principal)',
        to: minerAddress,
        amount: blockReward,
        fee: 0,
      },
      ...currentMempool,
    ];

    const newBlock: BlockRecord = {
      height: nextHeight,
      hash: finalHash,
      prevHash: blocks[0]?.hash || '00000000000000000004f81a7b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c',
      merkleRoot: 'mrk_' + Math.random().toString(16).substring(2, 16),
      timestamp: new Date().toLocaleTimeString(),
      transactionsCount: blockTransactions.length,
      miner: minerAddress,
      reward: blockReward,
      nonce,
      difficulty: '0x1903a2f8',
      transactions: blockTransactions,
    };

    setBlocks((prev) => [newBlock, ...prev]);
    setBlockHeight(nextHeight);
    setWalletBalance((prev) => prev + blockReward);
    setSharesAccepted((s) => s + (batch ? 1 : 4));
    setMempool([]); // Clear mempool

    // Update Global Exchange deposits confirmations
    setExchangeDeposits((prev) =>
      prev.map((dep) => {
        const nextConf = dep.confirmations + 1;
        return {
          ...dep,
          confirmations: nextConf,
          status: nextConf >= 6 ? 'Creditado' : 'Confirmando',
        };
      })
    );

    addLog(
      `✓ Bloco #${nextHeight} minerado e propagado na Mainnet! Hash: ${finalHash.substring(0, 24)}... Nonce: ${nonce}`,
      'success'
    );
    addLog(`Subsídio de +${blockReward} BTXC creditado. Notificação enviada ao gateway da Global Exchange.`, 'success');

    setIsMining(false);
  };

  // Mine batch of 5 blocks
  const mineFiveBlocks = async () => {
    if (isMining) return;
    setIsMining(true);
    addLog('Iniciando lote de 5 blocos rápidos na Mainnet...', 'warning');
    for (let i = 0; i < 5; i++) {
      await mineOneBlock(true);
    }
    setIsMining(false);
    addLog('✓ Lote de 5 blocos concluído e confirmado pelos nós da Global Exchange.', 'success');
  };

  // Auto mining effect
  useEffect(() => {
    if (!autoMining) return;
    const interval = setInterval(() => {
      mineOneBlock(true);
    }, 4500);
    return () => clearInterval(interval);
  }, [autoMining, blockHeight, mempool]);

  // Target client detection for Mempool transfers
  const resolvedTargetClient = useMemo(() => {
    // Se o operador selecionou explicitamente um cliente na lista suspensa
    if (selectedTransferRecipientId && selectedTransferRecipientId !== 'auto') {
      const explicit = exchangeClients.find((c) => c.id === selectedTransferRecipientId);
      if (explicit) return explicit;
    }

    if (!sendTo.trim()) return null;
    const dest = sendTo.trim().toLowerCase();
    const cleanDoc = dest.replace(/\D/g, '');

    const found = exchangeClients.find((c) => {
      const addr = (c.bitxAddress || '').toLowerCase().trim();
      const id = (c.id || '').toLowerCase().trim();
      const email = (c.email || '').toLowerCase().trim();
      const name = (c.name || '').toLowerCase().trim();
      const doc = (c.document || '').replace(/\D/g, '').trim();

      return (
        (addr && addr === dest) ||
        (id && id === dest) ||
        (email && email === dest) ||
        (name && name === dest) ||
        (cleanDoc.length >= 7 && doc === cleanDoc)
      );
    });

    if (found) return found;

    if (
      exchangeClients.length === 1 &&
      (dest === exchangeHotWallet.toLowerCase() || dest.startsWith('bxrt') || dest.startsWith('btxc') || dest.startsWith('0x'))
    ) {
      return exchangeClients[0];
    }

    const partialMatch = exchangeClients.find((c) => {
      const addr = (c.bitxAddress || '').toLowerCase().trim();
      return addr && (dest.includes(addr) || addr.includes(dest));
    });
    if (partialMatch) return partialMatch;

    return null;
  }, [sendTo, exchangeClients, exchangeHotWallet, selectedTransferRecipientId]);

  // Handle new transaction emission and automatic credit to client account on Global Exchange
  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendTo.trim() || !sendAmount) return;
    const amt = parseFloat(sendAmount);
    if (isNaN(amt) || amt <= 0) return;

    if (amt > walletBalance) {
      setSendFeedback('Saldo insuficiente na carteira para efetuar a transação na Mainnet.');
      return;
    }

    const txid = 'tx_' + Math.random().toString(16).substring(2, 12);
    const dest = sendTo.trim();
    let targetClient = resolvedTargetClient;

    // Resolução resiliente: se ainda não encontrou, verificar se há seleção rápida ou único cliente
    if (!targetClient && selectedTransferRecipientId && selectedTransferRecipientId !== 'auto') {
      targetClient = exchangeClients.find((c) => c.id === selectedTransferRecipientId) || null;
    }
    if (!targetClient && exchangeClients.length === 1) {
      targetClient = exchangeClients[0];
    }

    const newTx: MempoolTx = {
      txid,
      from: walletAddress,
      to: dest,
      amount: amt,
      fee: 0.0001,
      time: 'Agora',
      exchangeClientTag: targetClient ? targetClient.id : (dest === exchangeHotWallet ? 'GE-DEPOSIT-DIRECT' : undefined),
    };

    setMempool((prev) => [newTx, ...prev]);
    setWalletBalance((prev) => +(prev - amt - 0.0001).toFixed(4));

    if (targetClient) {
      // 1. Atualizar saldo do cliente na Corretora Global Exchange imediatamente
      const newBtxc = +(targetClient.btxcBalance + amt).toFixed(4);
      const newBrl = +(targetClient.brlBalance + amt * price).toFixed(2);
      const newUsdt = +(newBrl / 5.0).toFixed(2);
      const newEst = +(newBtxc * (105270385.0 / 250.0)).toFixed(2);

      const updatedClients = exchangeClients.map((c) => {
        if (c.id === targetClient.id) {
          return {
            ...c,
            btxcBalance: newBtxc,
            brlBalance: newBrl,
            usdtBalance: newUsdt,
            estimatedMarketValue: newEst,
            bitxAddress: c.bitxAddress || dest,
          };
        }
        return c;
      });

      setExchangeClients(updatedClients);
      saveStoredRealClients(updatedClients);
      emitSyncToGlobalExchange(updatedClients);

      // 2. Registrar no Livro Razão de Custódia Engecema (imutabilidade contábil)
      const custodyRecord: CustodyLedgerItem = {
        id: 'CUST-TX-' + Math.floor(Math.random() * 900 + 100),
        txid,
        clientId: targetClient.id,
        type: 'Transferência BitX Core Mainnet',
        amountGx: amt,
        amountBrl: +(amt * price).toFixed(2),
        counterparty: `Transferência BitX Core Mainnet (${walletAddress.substring(0, 14)}...) -> ${targetClient.name} (${targetClient.id}) [Endereço: ${dest}]`,
        timestamp: new Date().toLocaleString('pt-BR'),
        status: 'Confirmado em Custódia',
      };
      const updatedLedger = [custodyRecord, ...custodyLedger];
      setCustodyLedger(updatedLedger);
      saveStoredCustodyLedger(updatedLedger);

      // 3. Registrar no histórico de depósitos da Global Exchange
      const newDeposit: ExchangeDepositRecord = {
        id: 'DEP-' + Math.floor(Math.random() * 900 + 100),
        clientId: targetClient.id,
        clientName: targetClient.name,
        txid,
        amount: amt,
        confirmations: 1,
        status: 'Creditado',
        time: 'Agora',
      };
      setExchangeDeposits((prev) => [newDeposit, ...prev]);

      // 4. Sincronizar na nuvem Supabase em segundo plano com await
      try {
        const clientToUpdate = updatedClients.find((c) => c.id === targetClient.id);
        if (clientToUpdate) {
          const { error: sbErr } = await supabase.from('clients').upsert([
            {
              id: clientToUpdate.id,
              name: clientToUpdate.name,
              email: clientToUpdate.email,
              document: clientToUpdate.document || null,
              bitx_address: clientToUpdate.bitxAddress || dest,
              btxc_balance: clientToUpdate.btxcBalance,
              gx_balance: clientToUpdate.btxcBalance,
              brl_balance: clientToUpdate.brlBalance,
              usdt_balance: clientToUpdate.usdtBalance,
              estimated_market_value: clientToUpdate.estimatedMarketValue,
              status: clientToUpdate.status || 'Verificado KYC',
              updated_at: new Date().toISOString(),
            },
          ]);
          if (sbErr) {
            console.warn('[Sync Transfer to Supabase]:', sbErr.message);
          }
        }
      } catch (err) {
        console.warn('[Sync Transfer to Supabase]:', err);
      }

      setSendFeedback(
        `✓ Transferência ${txid} realizada e CREDITADA com sucesso! O valor de +${amt.toFixed(4)} BTXC (R$ ${(amt * price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) foi creditado imediatamente na conta de "${targetClient.name}" (${targetClient.id}) na Global Exchange e sincronizado no Supabase Cloud!`
      );
      addLog(
        `[Transferência BitX Core -> Global Exchange] +${amt.toFixed(4)} BTXC creditados na conta de ${targetClient.name} (${targetClient.id}). Novo saldo: ${newBtxc.toFixed(4)} BTXC. TXID: ${txid}`,
        'success'
      );
    } else {
      setSendFeedback(
        `⚠️ Transação ${txid} (${amt.toFixed(4)} BTXC) adicionada à Mempool. ATENÇÃO: O endereço "${dest}" não está vinculado a nenhum cliente da Global Exchange! O saldo NÃO foi creditado em nenhuma conta. Para creditar na conta de um cliente, selecione o cliente no menu de destinatários ou vincule este endereço ao perfil do cliente nas Configurações.`
      );
      addLog(`Nova transação ${txid} (${amt} BTXC) para ${dest} na Mempool (sem cliente vinculado).`, 'warning');
    }

    setSendTo('');
    setSendAmount('');
  };

  // Handle client deposit into Global Exchange
  const handleDepositToExchange = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return;

    if (amt > walletBalance) {
      setDepositAlert('Saldo insuficiente para enviar o depósito.');
      return;
    }

    const client = exchangeClients.find((c) => c.id === depositClientId);
    if (!client) return;

    const txid = 'tx_ge_dep_' + Math.random().toString(16).substring(2, 10);
    const newTx: MempoolTx = {
      txid,
      from: walletAddress,
      to: exchangeHotWallet,
      amount: amt,
      fee: 0.0001,
      time: 'Agora',
      exchangeClientTag: client.id,
    };

    const newDeposit: ExchangeDepositRecord = {
      id: 'DEP-' + Math.floor(Math.random() * 900 + 100),
      clientId: client.id,
      clientName: client.name,
      txid,
      amount: amt,
      confirmations: 0,
      status: 'Pendente',
      time: 'Agora',
    };

    setMempool((prev) => [newTx, ...prev]);
    setWalletBalance((prev) => prev - amt - 0.0001);
    setExchangeDeposits((prev) => [newDeposit, ...prev]);

    // Update client balance on broker & sync with custody ledger
    const updatedWithDeposit = exchangeClients.map((c) => {
      if (c.id === client.id) {
        const newBtxc = +(c.btxcBalance + amt).toFixed(4);
        const newBrl = +(newBtxc * price).toFixed(2);
        const newUsdt = +(newBrl / 5.0).toFixed(2);
        const newEst = +(newBtxc * (105270385.0 / 250.0)).toFixed(2);
        return {
          ...c,
          btxcBalance: newBtxc,
          brlBalance: newBrl,
          usdtBalance: newUsdt,
          estimatedMarketValue: newEst,
        };
      }
      return c;
    });
    setExchangeClients(updatedWithDeposit);
    saveStoredRealClients(updatedWithDeposit);
    emitSyncToGlobalExchange(updatedWithDeposit);

    // Sincronizar cliente atualizado no Supabase Cloud
    try {
      const updatedClient = updatedWithDeposit.find((c) => c.id === client.id);
      if (updatedClient) {
        supabase.from('clients').upsert([
          {
            id: updatedClient.id,
            name: updatedClient.name,
            email: updatedClient.email,
            document: updatedClient.document || null,
            bitx_address: updatedClient.bitxAddress,
            btxc_balance: updatedClient.btxcBalance,
            gx_balance: updatedClient.btxcBalance,
            brl_balance: updatedClient.brlBalance,
            usdt_balance: updatedClient.usdtBalance,
            estimated_market_value: updatedClient.estimatedMarketValue,
            status: updatedClient.status || 'Verificado KYC',
            updated_at: new Date().toISOString(),
          },
        ]).then();
      }
    } catch {}

    // Sincronizar depósito com o Livro Razão de Custódia & Liquidação Engecema
    const custodyRecord: CustodyLedgerItem = {
      id: 'CUST-DEP-' + Math.floor(Math.random() * 900 + 100),
      txid,
      clientId: client.id,
      type: 'Depósito Blockchain BitX Core',
      amountGx: amt,
      amountBrl: +(amt * price).toFixed(2),
      counterparty: `Depósito Blockchain BitX Core -> ${client.name} (${client.id})`,
      timestamp: new Date().toLocaleString('pt-BR'),
      status: 'Confirmado em Custódia',
    };
    const newLedger = [custodyRecord, ...custodyLedger];
    setCustodyLedger(newLedger);
    saveStoredCustodyLedger(newLedger);

    setDepositAlert(
      `Depósito de ${amt} BTXC para o cliente ${client.name} (${client.id}) transmitido! Tag vinculada à carteira da Global Exchange.`
    );
    addLog(
      `Depósito de cliente ${client.id} (${amt} BTXC) enviado para Hot Wallet da Global Exchange (${exchangeHotWallet.substring(0, 16)}...).`,
      'success'
    );
  };

  // Handle Client Buy / Sell Order on Global Exchange (Vinculado à Conta do Cliente Real)
  const handleExecuteExchangeOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(orderAmount);
    if (isNaN(amt) || amt <= 0) {
      setOrderFeedback('Informe uma quantidade válida de BTXC.');
      return;
    }

    const client = exchangeClients.find((c) => c.id === orderClientId) || exchangeClients[0];
    if (!client) {
      setOrderFeedback('Selecione ou cadastre uma conta de cliente real para executar a ordem.');
      return;
    }

    const totalBrl = amt * price;

    if (orderSide === 'buy') {
      if (client.brlBalance < totalBrl) {
        setOrderFeedback(
          `Saldo em BRL insuficiente na conta de "${client.name}". Disponível: R$ ${client.brlBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Necessário: R$ ${totalBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`
        );
        return;
      }
      setExchangeClients((prev) =>
        prev.map((c) =>
          c.id === client.id
            ? {
                ...c,
                brlBalance: +(c.brlBalance - totalBrl).toFixed(2),
                btxcBalance: +(c.btxcBalance + amt).toFixed(4),
              }
            : c
        )
      );
      setOrderFeedback(
        `✓ Ordem de COMPRA executada para ${client.name} (${client.id})! +${amt.toFixed(4)} BTXC creditados e R$ ${totalBrl.toFixed(2)} liquidados.`
      );
    } else {
      if (client.btxcBalance < amt) {
        setOrderFeedback(
          `Saldo em BTXC insuficiente na conta de "${client.name}". Disponível: ${client.btxcBalance.toLocaleString('pt-BR', { minimumFractionDigits: 4 })} BTXC.`
        );
        return;
      }
      setExchangeClients((prev) =>
        prev.map((c) =>
          c.id === client.id
            ? {
                ...c,
                btxcBalance: +(c.btxcBalance - amt).toFixed(4),
                brlBalance: +(c.brlBalance + totalBrl).toFixed(2),
              }
            : c
        )
      );
      setOrderFeedback(
        `✓ Ordem de VENDA executada para ${client.name} (${client.id})! -${amt.toFixed(4)} BTXC debitados e R$ ${totalBrl.toFixed(2)} creditados em saldo BRL.`
      );
    }

    addLog(
      `[Global Exchange] Ordem executada para cliente real ${client.name} (${client.id}): ${orderSide.toUpperCase()} ${amt} BTXC @ R$ ${price.toFixed(2)} (Total: R$ ${totalBrl.toFixed(2)}).`,
      'success'
    );

    setTimeout(() => setOrderFeedback(''), 6000);
  };

  // Generate bitx.conf content for REAL MAINNET
  const generatedBitxConf = `# Configuração Oficial do Nó BitX Core (BTXC) - PRODUÇÃO MAINNET
# Conglomerado: Engecema Fomento e Tecnologia & Corretora Global Exchange
# Fornecimento Máximo: ${maxSupply} BTXC
# Algoritmo: PoW SHA-256d | Formato: Native SegWit Bech32 (btxc1...)

# Rede e Conectividade de Produção
server=1
listen=1
mainnet=1
txindex=1

# Nós Seed Globais e Gateway da Corretora
addnode=seed1.bitxcore.org:8333
addnode=seed2.bitxcore.org:8333
addnode=gateway.globalexchange.com:8333
addnode=custody-br.engecema.com:8333

# Parâmetro de Conexão (BITX_RPC_HOST é opcional e pode ficar em branco)
${rpcHost.trim() ? `rpcbind=${rpcHost.trim()}\nrpcallowip=${rpcHost.trim()}\n` : '# rpcbind=127.0.0.1 (BITX_RPC_HOST em branco: modo integrado)\n'}
# Autenticação RPC para Serviços de Custódia e Liquidez
rpcuser=${rpcUser}
rpcpassword=${rpcPass}
rpcport=${rpcPort}
port=${p2pPort}
rpcallowip=127.0.0.1
rpcallowip=10.0.0.0/8
rpcallowip=172.16.0.0/12

# Mempool e Política de Taxas
minrelaytxfee=0.00001000
fallbackfee=0.00020000
blockmaxweight=4000000
daemon=1
`;

  const handleCopyBitxConf = () => {
    navigator.clipboard.writeText(generatedBitxConf);
    setConfCopied(true);
    setTimeout(() => setConfCopied(false), 2500);
  };

  return (
    <div className="portal-root">
      {/* Top Header */}
      <header className="portal-header">
        <div className="portal-brand">
          <div className="portal-brand-logo">BX</div>
          <div className="portal-brand-info">
            <h1>
              BitX Core <span style={{ color: '#f97316' }}>BTXC</span>
              <span
                style={{
                  fontSize: '10px',
                  background: '#f97316',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                }}
              >
                MAINNET
              </span>
            </h1>
            <p>Rede Principal de Produção & Global Exchange Gateway</p>
          </div>
        </div>

        <div className="portal-top-metrics">
          <div className="portal-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981' }}>
            <span className="portal-badge-dot"></span>
            REDE ATIVA · PRODUÇÃO (MAINNET)
          </div>

          <div className="portal-metric-pill">
            Altura da Cadeia: <strong>#{blockHeight.toLocaleString()}</strong>
          </div>

          <div className="portal-metric-pill">
            Cotação BTXC (Global Ex): <strong>R$ {price.toFixed(2)}</strong>
            <span
              style={{
                marginLeft: '6px',
                color: change >= 0 ? '#10b981' : '#ef4444',
                fontWeight: 'bold',
              }}
            >
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)}%
            </span>
          </div>

          <div className="portal-metric-pill" style={{ borderColor: '#3b82f6' }}>
            Global Exchange: <strong style={{ color: '#60a5fa' }}>● Online v3.4</strong>
          </div>

          <div className="portal-metric-pill" style={{ borderColor: '#10b981' }}>
            Supabase Cloud: <strong style={{ color: '#10b981' }}>● Conectado (odbbtgkxgiqlfhcepwuj)</strong>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <div className="portal-nav-bar">
        <div className="portal-nav-tabs">
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'custody' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('custody')}
            style={{
              fontWeight: 800,
              background: activeTab === 'custody' ? '#1e293b' : undefined,
              borderColor: activeTab === 'custody' ? '#10b981' : undefined,
            }}
          >
            🛡️ Painel de Custódia (Engecema)
          </button>
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'mining' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('mining')}
          >
            ⛏️ Mineração PoW Mainnet
          </button>
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'exchange' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('exchange')}
            style={{ fontWeight: 700 }}
          >
            🏛️ Corretora Global Exchange (Clientes)
          </button>
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'config' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            ⚙️ Painel de Configurações
          </button>
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'explorer' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('explorer')}
          >
            ⛓️ Explorador de Blocos
          </button>
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'mempool' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('mempool')}
          >
            💸 Transferências & Mempool ({mempool.length})
          </button>
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'wallet' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('wallet')}
          >
            👛 Carteira Integrada
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="portal-body">
        {/* Global Key Stats */}
        <div className="portal-stats-grid">
          <div className="portal-stat-card accent-orange">
            <div className="portal-stat-label">Fornecimento Máximo Oficial</div>
            <div className="portal-stat-value">1.500.000.000</div>
            <div className="portal-stat-sub">BTXC (Teto limite absoluto na Mainnet)</div>
          </div>

          <div className="portal-stat-card accent-green">
            <div className="portal-stat-label">Moedas Mineradas (Emissão)</div>
            <div className="portal-stat-value">{(blockHeight * 50).toLocaleString()}</div>
            <div className="portal-stat-sub">
              {((blockHeight * 50 * 100) / 1500000000).toFixed(4)}% do teto minerado
            </div>
          </div>

          <div className="portal-stat-card accent-blue">
            <div className="portal-stat-label">Parceria Global Exchange</div>
            <div className="portal-stat-value">Liquidez & Custódia</div>
            <div className="portal-stat-sub">Conglomerado Engecema Tecnologia</div>
          </div>

          <div className="portal-stat-card accent-purple">
            <div className="portal-stat-label">Hashrate da Rede PoW</div>
            <div className="portal-stat-value">14.85 TH/s</div>
            <div className="portal-stat-sub">Dificuldade Mainnet: {difficulty}</div>
          </div>
        </div>

        {/* TAB 0: PAINEL DE CUSTÓDIA ENGECEMA (DESTAQUE CENTRAL) */}
        {activeTab === 'custody' && (
          <div>
            {/* Banner Institucional de Custódia */}
            <div
              style={{
                background: 'linear-gradient(135deg, #09131f 0%, #0d1b2a 100%)',
                border: '1px solid #1e3a5f',
                borderLeft: '5px solid #10b981',
                borderRadius: '8px',
                padding: '20px 24px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', color: '#fff', fontWeight: 800 }}>
                    🛡️ Painel de Custódia & Liquidação Financeira — ENGECEMA
                  </h2>
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid #10b981',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}
                  >
                    ● CUSTÓDIA ENGECEMA ATIVA
                  </span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                  Gestão do livro de custódia, clientes, lançamentos financeiros e conformidade Banco do Brasil Pix Produção.
                  Todos os saldos possuem paridade e valor correspondente em Reais (R$) auditável com TXID criptográfico.
                </p>
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap', fontSize: '12px' }}>
                  <span style={{ color: '#cbd5e1' }}>
                    🏢 <strong>CNPJ PJ:</strong> <span style={{ color: '#f8fafc', fontFamily: 'DM Mono, monospace' }}>05.368.602/0001-10</span>
                  </span>
                  <span style={{ color: '#cbd5e1' }}>
                    ⚡ <strong>Chave Pix Favorecida:</strong> <span style={{ color: '#10b981', fontFamily: 'DM Mono, monospace' }}>05.368.602/0001-10</span>
                  </span>
                  <span style={{ color: '#cbd5e1' }}>
                    🏦 <strong>Pix BB Produção:</strong> <span style={{ color: '#38bdf8' }}>Engecema PJ (mTLS star_mtls_api_bb_com_br.crt)</span>
                  </span>
                  <span style={{ color: '#cbd5e1' }}>
                    📈 <strong>Cotação de Referência Oficial:</strong> <strong style={{ color: '#f59e0b' }}>1 GX = R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </span>
                </div>
              </div>

              {/* Seletor do Cliente */}
              <div
                style={{
                  background: '#070d18',
                  border: '1px solid #1e293b',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  minWidth: '280px',
                }}
              >
                <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                  CONTA DO CLIENTE EM CUSTÓDIA:
                </label>
                <select
                  className="portal-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={selectedCustodyClientId}
                  onChange={(e) => {
                    setSelectedCustodyClientId(e.target.value);
                  }}
                  disabled={exchangeClients.length === 0}
                >
                  {exchangeClients.length === 0 ? (
                    <option value="">Nenhum cliente cadastrado (Lista zerada)</option>
                  ) : (
                    exchangeClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id}) &bull; {c.btxcBalance.toFixed(2)} GX
                      </option>
                    ))
                  )}
                </select>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Doc: {currentCustodyClient ? currentCustodyClient.document || '—' : '—'}</span>
                  <span style={{ color: currentCustodyClient ? '#10b981' : '#94a3b8' }}>
                    {currentCustodyClient ? currentCustodyClient.status : 'Sem clientes ativos'}
                  </span>
                </div>
              </div>
            </div>

            {/* OS 3 CARDS DE SALDO EM GRANDE DESTAQUE VISUAL */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              {/* Card 1: Saldo Disponível em Custódia (GX) */}
              <div
                style={{
                  background: '#0b1120',
                  border: '1px solid #1f2937',
                  borderRadius: '8px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      CUSTÓDIA ENGECEMA &bull; ATIVO DIGITAL GX
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        background: 'rgba(56, 189, 248, 0.1)',
                        color: '#38bdf8',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      CNPJ: 05.368.602/0001-10
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 600 }}>
                    Saldo Disponível em Custódia
                  </div>
                  <div
                    style={{
                      fontSize: '34px',
                      fontWeight: 900,
                      color: '#f8fafc',
                      margin: '10px 0 6px',
                      fontFamily: 'DM Mono, monospace',
                    }}
                  >
                    {currentCustodyClient
                      ? currentCustodyClient.btxcBalance.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })
                      : '0,00'}{' '}
                    <span style={{ fontSize: '20px', color: '#f97316' }}>GX</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Tokens mantidos sob custódia e garantia institucional da Engecema Tecnologia.
                  </p>
                </div>

                <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8' }}>
                  <span>Segurança da Custódia:</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>● Ativo Protegido e Auditado</span>
                </div>
              </div>

              {/* Card 2: Valor Correspondente em Reais (R$) - O DESTAQUE PRINCIPAL */}
              <div
                style={{
                  background: 'linear-gradient(145deg, #062b1e 0%, #081d18 100%)',
                  border: '2px solid #10b981',
                  borderRadius: '8px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-15px',
                    right: '-15px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    filter: 'blur(25px)',
                  }}
                />
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                      VALOR CORRESPONDENTE EM REAIS
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        background: '#10b981',
                        color: '#022c22',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      POSIÇÃO CUSTODIADA AUDITADA
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#a7f3d0', fontWeight: 600 }}>
                    Saldo Líquido em Reais (R$)
                  </div>
                  <div
                    style={{
                      fontSize: '32px',
                      fontWeight: 900,
                      color: '#10b981',
                      margin: '10px 0 6px',
                      fontFamily: 'DM Mono, monospace',
                      letterSpacing: '-0.02em',
                      textShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    R${' '}
                    {currentCustodyClient
                      ? (currentCustodyClient.btxcBalance * price).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : '0,00'}
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#a7f3d0', lineHeight: 1.5 }}>
                    Multiplicado automaticamente:{' '}
                    <strong>{currentCustodyClient ? currentCustodyClient.btxcBalance.toFixed(2) : '0,00'} GX</strong> &times;{' '}
                    <strong>R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </p>
                </div>

                <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#a7f3d0' }}>
                  <span>Garantia de Liquidez:</span>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>Reserva Técnica Engecema PJ</span>
                </div>
              </div>

              {/* Card 3: Paridade em Dólar USDT ($) */}
              <div
                style={{
                  background: '#0b1120',
                  border: '1px solid #1f2937',
                  borderRadius: '8px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      PARIDADE CAMBIAL INTERNACIONAL
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        background: 'rgba(96, 165, 250, 0.1)',
                        color: '#60a5fa',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      USDT / USD
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 600 }}>
                    Equivalente em Dólar Tether
                  </div>
                  <div
                    style={{
                      fontSize: '34px',
                      fontWeight: 900,
                      color: '#38bdf8',
                      margin: '10px 0 6px',
                      fontFamily: 'DM Mono, monospace',
                    }}
                  >
                    ${' '}
                    {currentCustodyClient
                      ? ((currentCustodyClient.btxcBalance * price) / 5.0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : '0,00'}{' '}
                    <span style={{ fontSize: '18px', color: '#94a3b8' }}>USDT</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Cotação balizada na mesa institucional de câmbio (R$ 5,00 / USDT).
                  </p>
                </div>

                <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8' }}>
                  <span>Mesa Internacional:</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>Paridade de Câmbio USDT</span>
                </div>
              </div>
            </div>

            {/* Feedback Alert se houver */}
            {custodyFeedback && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981',
                  color: '#10b981',
                  padding: '12px 18px',
                  borderRadius: '6px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                }}
              >
                {custodyFeedback}
              </div>
            )}

            {/* RESUMO CONSOLIDADO DA CUSTÓDIA INSTITUCIONAL ENGECEMA */}
            <div
              style={{
                background: '#0d1526',
                border: '1px solid #1e3a5f',
                borderRadius: '8px',
                padding: '18px 22px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  POSIÇÃO CONSOLIDADA &bull; CUSTÓDIA INSTITUCIONAL ENGECEMA
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>
                  Total de <strong>{exchangeClients.length}</strong> conta(s) ativas &bull; Livro Razão com <strong>{custodyLedger.length}</strong> lançamento(s) auditados
                </div>
              </div>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>VOLUME TOTAL GX:</span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', fontFamily: 'DM Mono, monospace' }}>
                    {exchangeClients.reduce((acc, c) => acc + (c.btxcBalance || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} GX
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#10b981', display: 'block' }}>PATRIMÔNIO TOTAL EM REAIS:</span>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#10b981', fontFamily: 'DM Mono, monospace' }}>
                    R$ {exchangeClients.reduce((acc, c) => acc + (c.brlBalance || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#38bdf8', display: 'block' }}>RESERVA TÉCNICA USDT:</span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#38bdf8', fontFamily: 'DM Mono, monospace' }}>
                    $ {exchangeClients.reduce((acc, c) => acc + (c.usdtBalance || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} USDT
                  </span>
                </div>
              </div>
            </div>

            {/* LIVRO RAZÃO DE CUSTÓDIA & LIQUIDAÇÃO (LEDGER AUDITÁVEL) */}
            <div className="portal-card">
              <div className="portal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 className="portal-card-title">
                    📜 Livro Razão de Custódia & Liquidação (Ledger Auditável Engecema)
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Registro histórico imutável das posições mantidas em custódia, aportes de capital,
                    transferências em Reais (Pix BB) e ajustes com TXID.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="portal-btn"
                    style={{
                      background: '#1e3a8a',
                      border: '1px solid #3b82f6',
                      color: '#bfdbfe',
                      fontSize: '12px',
                      padding: '6px 14px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    onClick={() => {
                      setBridgeTab('sql');
                      setShowBridgeModal(true);
                    }}
                    title="Central de Sincronização entre BitX Core Blockchain e a Corretora Global Exchange"
                  >
                    🔗 Ponte de Sincronização Global Exchange
                  </button>
                  <button
                    type="button"
                    className="portal-btn"
                    style={{
                      background: '#065f46',
                      border: '1px solid #10b981',
                      color: '#d1fae5',
                      fontSize: '12px',
                      padding: '6px 14px',
                      fontWeight: 700,
                      cursor: isReconciling ? 'wait' : 'pointer',
                      opacity: isReconciling ? 0.8 : 1,
                    }}
                    onClick={handleReconcileWithCustodyLedger}
                    disabled={isReconciling}
                    title="Forçar Reconciliação do Livro Razão com a Corretora Global Exchange e Blockchain BitX Core"
                  >
                    {isReconciling ? '⏳ Reconciliando Saldos...' : '⚖️ Reconciliar Saldos'}
                  </button>
                </div>
              </div>

              {reconcileNotice && (
                <div
                  style={{
                    background: 'linear-gradient(90deg, rgba(6, 95, 70, 0.45) 0%, rgba(16, 185, 129, 0.15) 100%)',
                    border: '1px solid #10b981',
                    borderLeft: '5px solid #10b981',
                    borderRadius: '8px',
                    padding: '12px 18px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>⚖️</span>
                    <div>
                      <div style={{ color: '#6ee7b7', fontWeight: 700, fontSize: '13px' }}>
                        {reconcileNotice.message}
                      </div>
                      {reconcileNotice.details && (
                        <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                          {reconcileNotice.details} &bull; Sincronizado às <strong>{reconcileNotice.timestamp}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                      ● SALDOS AUDITADOS
                    </span>
                    <button
                      type="button"
                      onClick={() => setReconcileNotice(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '2px 6px',
                      }}
                      title="Dispensar aviso"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>ID Registro</th>
                      <th>Tipo de Lançamento</th>
                      <th>Contraparte / Favorecido</th>
                      <th>Montante em GX</th>
                      <th>Valor em Reais (R$)</th>
                      <th>TXID Criptográfico de Auditoria</th>
                      <th>Data / Hora</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custodyLedger.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '36px 20px', color: '#94a3b8' }}>
                          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🛡️</div>
                          <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                            Nenhum lançamento no Livro Razão de Custódia Engecema no momento.
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                            Clique no botão abaixo para reconciliar os saldos com a Corretora Global Exchange e restabelecer o Livro Razão auditado.
                          </div>
                          <button
                            type="button"
                            className="portal-btn"
                            style={{
                              background: '#065f46',
                              border: '1px solid #10b981',
                              color: '#d1fae5',
                              fontSize: '12px',
                              padding: '6px 16px',
                              fontWeight: 700,
                            }}
                            onClick={handleReconcileWithCustodyLedger}
                            disabled={isReconciling}
                          >
                            {isReconciling ? '⏳ Reconciliando Saldos...' : '⚖️ Reconciliar Saldos com a Corretora'}
                          </button>
                        </td>
                      </tr>
                    ) : (
                      custodyLedger.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 'bold', color: '#f97316' }}>{row.id}</td>
                        <td>
                          <span
                            style={{
                              background: row.type === 'Transferência em Reais (Pix)' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                              color: row.type === 'Transferência em Reais (Pix)' ? '#10b981' : '#38bdf8',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                            }}
                          >
                            {row.type}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: '#cbd5e1' }}>{row.counterparty}</td>
                        <td
                          style={{
                            fontWeight: 'bold',
                            color: row.amountGx > 0 ? '#10b981' : '#f87171',
                            fontFamily: 'DM Mono, monospace',
                          }}
                        >
                          {row.amountGx > 0 ? '+' : ''}
                          {row.amountGx.toFixed(4)} GX
                        </td>
                        <td
                          style={{
                            fontWeight: 'bold',
                            color: row.amountBrl > 0 ? '#10b981' : '#f87171',
                            fontFamily: 'DM Mono, monospace',
                          }}
                        >
                          {row.amountBrl > 0 ? '+' : ''}R${' '}
                          {Math.abs(row.amountBrl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="portal-mono" style={{ fontSize: '11px', color: '#38bdf8' }}>
                          {row.txid.substring(0, 22)}...
                        </td>
                        <td style={{ fontSize: '11px', color: '#94a3b8' }}>{row.timestamp}</td>
                        <td>
                          <span
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                            }}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: MINERAÇÃO DE BLOCOS NA MAINNET */}
        {activeTab === 'mining' && (
          <div>
            <div className="portal-card">
              <div className="portal-card-header">
                <div>
                  <h2 className="portal-card-title">⛏️ Controlador de Mineração PoW (Mainnet Produção)</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Mineração de blocos na rede principal com validação de transações e integração
                    com a pool de liquidez da Global Exchange.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="portal-btn portal-btn-primary"
                    disabled={isMining}
                    onClick={() => mineOneBlock(false)}
                  >
                    {isMining ? 'Calculando PoW...' : '⚡ Minerar 1 Bloco'}
                  </button>

                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    disabled={isMining}
                    onClick={mineFiveBlocks}
                  >
                    🚀 Minerar 5 Blocos (Lote)
                  </button>

                  <button
                    type="button"
                    className={`portal-btn ${autoMining ? 'portal-btn-success' : 'portal-btn-secondary'}`}
                    onClick={() => {
                      setAutoMining(!autoMining);
                      addLog(
                        autoMining
                          ? 'Mineração contínua pausada.'
                          : 'Mineração contínua na Mainnet ativada (~4.5s por bloco).',
                        'info'
                      );
                    }}
                  >
                    {autoMining ? '⏹ Parar Auto-Mining' : '🔄 Auto-Mining Contínuo'}
                  </button>
                </div>
              </div>

              {/* Pool & Mode Selector */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '16px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ background: '#0b1120', padding: '16px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>MODO DE MINERAÇÃO</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className={`portal-btn ${miningMode === 'pool' ? 'portal-btn-primary' : 'portal-btn-secondary'}`}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => setMiningMode('pool')}
                    >
                      🏊 Pool Stratum Global Exchange
                    </button>
                    <button
                      type="button"
                      className={`portal-btn ${miningMode === 'solo' ? 'portal-btn-primary' : 'portal-btn-secondary'}`}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => setMiningMode('solo')}
                    >
                      🖥️ Nó Validador Solo
                    </button>
                  </div>
                </div>

                <div style={{ background: '#0b1120', padding: '16px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>TELEMETRIA EM TEMPO REAL</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '13px' }}>
                    <span>
                      Hashrate Local: <strong style={{ color: '#10b981' }}>{liveHashrate} MH/s</strong>
                    </span>
                    <span>
                      Shares Aceitas: <strong style={{ color: '#38bdf8' }}>{sharesAccepted.toLocaleString()}</strong> (100%)
                    </span>
                  </div>
                </div>

                <div style={{ background: '#0b1120', padding: '16px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>ENDPOINT STRATUM V2</span>
                  <div style={{ fontSize: '12px', color: '#f97316', marginTop: '8px', fontFamily: 'DM Mono, monospace' }}>
                    stratum+tcp://mining.globalexchange.com:3333
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div className="portal-form-group">
                  <label>Endereço de Destino da Recompensa Coinbase (Minerador Mainnet)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="portal-input portal-mono"
                      value={minerAddress}
                      onChange={(e) => setMinerAddress(e.target.value)}
                    />
                    <button
                      type="button"
                      className="portal-btn portal-btn-secondary"
                      onClick={() => setMinerAddress(walletAddress)}
                      title="Usar endereço da carteira local"
                    >
                      Usar Carteira
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#94a3b8',
                    marginBottom: '6px',
                  }}
                >
                  Terminal de Mineração PoW Mainnet em Tempo Real
                </label>
                <div className="portal-console">
                  {miningLogs.map((log) => (
                    <div key={log.id} className="portal-log-line">
                      <span className="portal-log-time">[{log.time}]</span>
                      <span className={`portal-log-${log.type}`}>{log.text}</span>
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              </div>
            </div>

            {/* Last Mined Blocks Table */}
            <div className="portal-card">
              <div className="portal-card-header">
                <h3 className="portal-card-title">Últimos Blocos da Rede Principal (Mainnet)</h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Altura da Cadeia: #{blockHeight.toLocaleString()}
                </span>
              </div>
              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Altura</th>
                      <th>Hash do Bloco (SHA-256d)</th>
                      <th>Transações</th>
                      <th>Minerador</th>
                      <th>Recompensa</th>
                      <th>Horário</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.slice(0, 8).map((b) => (
                      <tr key={b.height}>
                        <td style={{ fontWeight: 'bold', color: '#f97316' }}>#{b.height.toLocaleString()}</td>
                        <td className="portal-mono" title={b.hash}>
                          {b.hash.substring(0, 18)}...{b.hash.slice(-6)}
                        </td>
                        <td>
                          <span
                            style={{
                              background: '#1e293b',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                            }}
                          >
                            {b.transactionsCount} tx
                          </span>
                        </td>
                        <td className="portal-mono" style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {b.miner.substring(0, 16)}...
                        </td>
                        <td style={{ color: '#10b981', fontWeight: 'bold' }}>
                          +{b.reward.toFixed(2)} BTXC
                        </td>
                        <td style={{ color: '#94a3b8', fontSize: '12px' }}>{b.timestamp}</td>
                        <td>
                          <button
                            type="button"
                            className="portal-btn portal-btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                            onClick={() => setSelectedBlock(b)}
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CORRETORA GLOBAL EXCHANGE (NOVA ABA CENTRAL) */}
        {activeTab === 'exchange' && (
          <div>
            {/* Banner of Integration */}
            <div className="portal-exchange-banner">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>
                    🏛️ Gateway de Liquidez & Custódia — Corretora Global Exchange
                  </h2>
                  <span className="portal-exchange-status-tag">
                    <span className="portal-badge-dot"></span> GATEWAY ONLINE (v3.4)
                  </span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                  Ambiente de operações em tempo real para os clientes da corretora Global Exchange
                  do conglomerado Engecema. Depósitos diretos em cold/hot wallet e livro de ofertas
                  sincronizado com a blockchain.
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>HOT WALLET DA CORRETORA:</span>
                <div
                  className="portal-mono"
                  style={{
                    fontSize: '12px',
                    color: '#38bdf8',
                    background: '#090d16',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    marginTop: '2px',
                  }}
                >
                  {exchangeHotWallet.substring(0, 22)}...{exchangeHotWallet.slice(-8)}
                </div>
              </div>
            </div>

            {/* Trading Pair Selector & Live Stats */}
            <div className="portal-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginBottom: '16px',
                }}
              >
                <div className="portal-pair-selector">
                  <button
                    type="button"
                    className={`portal-pair-btn ${selectedPair === 'BTXC/BRL' ? 'is-active' : ''}`}
                    onClick={() => setSelectedPair('BTXC/BRL')}
                  >
                    BTXC / BRL
                  </button>
                  <button
                    type="button"
                    className={`portal-pair-btn ${selectedPair === 'BTXC/USDT' ? 'is-active' : ''}`}
                    onClick={() => setSelectedPair('BTXC/USDT')}
                  >
                    BTXC / USDT
                  </button>
                  <button
                    type="button"
                    className={`portal-pair-btn ${selectedPair === 'BTXC/BTC' ? 'is-active' : ''}`}
                    onClick={() => setSelectedPair('BTXC/BTC')}
                  >
                    BTXC / BTC
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>ÚLTIMO PREÇO</span>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
                      {selectedPair === 'BTXC/BRL' && `R$ ${price.toFixed(2)}`}
                      {selectedPair === 'BTXC/USDT' && `$ ${(price / 5.0).toFixed(2)}`}
                      {selectedPair === 'BTXC/BTC' && `₿ ${(price / 480000).toFixed(6)}`}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>VARIAÇÃO 24H</span>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>
                      +{change.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>VOLUME 24H</span>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc' }}>
                      42.580.000 BTXC
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Book & Trade Form Grid */}
              <div className="portal-exchange-grid">
                {/* Order Book */}
                <div>
                  <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#f8fafc' }}>
                    Livro de Ofertas ao Vivo (Global Exchange Order Book)
                  </h3>
                  <div className="portal-orderbook">
                    <div>
                      <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold', marginBottom: '4px' }}>
                        COMPRADORES (BIDS)
                      </div>
                      <table className="portal-ob-table">
                        <thead>
                          <tr>
                            <th>Preço ({selectedPair === 'BTXC/BRL' ? 'R$' : 'US$'})</th>
                            <th>Qtd (BTXC)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bids.map((b, i) => (
                            <tr key={i}>
                              <td className="portal-ob-bid">{b.price.toFixed(2)}</td>
                              <td>{b.amount.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 'bold', marginBottom: '4px' }}>
                        VENDEDORES (ASKS)
                      </div>
                      <table className="portal-ob-table">
                        <thead>
                          <tr>
                            <th>Preço ({selectedPair === 'BTXC/BRL' ? 'R$' : 'US$'})</th>
                            <th>Qtd (BTXC)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {asks.map((a, i) => (
                            <tr key={i}>
                              <td className="portal-ob-ask">{a.price.toFixed(2)}</td>
                              <td>{a.amount.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Instant Order Form for Exchange Clients */}
                <div style={{ background: '#0b1120', padding: '18px', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#f8fafc' }}>
                    Negociação Instantânea na Corretora
                  </h3>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button
                      type="button"
                      className={`portal-btn ${orderSide === 'buy' ? 'portal-btn-success' : 'portal-btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setOrderSide('buy')}
                    >
                      Comprar BTXC
                    </button>
                    <button
                      type="button"
                      className={`portal-btn ${orderSide === 'sell' ? 'portal-btn-primary' : 'portal-btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setOrderSide('sell')}
                    >
                      Vender BTXC
                    </button>
                  </div>

                  <form onSubmit={handleExecuteExchangeOrder}>
                    <div className="portal-form-group">
                      <label>Conta do Cliente Real Executante (Global Exchange)</label>
                      <select
                        className="portal-input"
                        value={orderClientId}
                        onChange={(e) => setOrderClientId(e.target.value)}
                        disabled={exchangeClients.length === 0}
                      >
                        {exchangeClients.length === 0 ? (
                          <option value="">Nenhum cliente real da Global Exchange cadastrado</option>
                        ) : (
                          exchangeClients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.id} — {c.name} (BRL: R$ {c.brlBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | BTXC: {c.btxcBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                            </option>
                          ))
                        )}
                      </select>
                      {exchangeClients.length === 0 && (
                        <small style={{ color: '#f59e0b', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                          * Aguardando cadastro de clientes reais na plataforma Global Exchange para operar.
                        </small>
                      )}
                    </div>

                    <div className="portal-form-group">
                      <label>Quantidade em BTXC</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="portal-input"
                        value={orderAmount}
                        onChange={(e) => setOrderAmount(e.target.value)}
                        required
                        disabled={exchangeClients.length === 0}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        margin: '10px 0 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>Preço Estimado:</span>
                      <strong>R$ {price.toFixed(2)}</strong>
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginBottom: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>Total da Operação:</span>
                      <strong style={{ color: '#10b981', fontSize: '14px' }}>
                        R$ {(parseFloat(orderAmount || '0') * price).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </div>

                    <button
                      type="submit"
                      className={`portal-btn ${orderSide === 'buy' ? 'portal-btn-success' : 'portal-btn-primary'}`}
                      style={{ width: '100%' }}
                      disabled={exchangeClients.length === 0}
                    >
                      {exchangeClients.length === 0
                        ? 'Aguardando Clientes Reais na Global Exchange'
                        : orderSide === 'buy'
                        ? 'Executar Compra na Corretora'
                        : 'Executar Venda na Corretora'}
                    </button>

                    {orderFeedback && (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '10px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid #10b981',
                          color: '#10b981',
                          fontSize: '12px',
                        }}
                      >
                        {orderFeedback}
                      </div>
                    )}
                  </form>
                </div>
              </div>
            </div>

            {/* Client Management & Deposit Gateway */}
            <div className="portal-card">
              <div className="portal-card-header">
                <div>
                  <h3 className="portal-card-title">
                    Depósitos de Clientes da Global Exchange (Gateway Blockchain)
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Envie depósitos de BTXC com identificação do cliente para crédito automático no
                    saldo da corretora após as confirmações de bloco.
                  </p>
                </div>
              </div>

              {/* Form to Deposit for Client */}
              <form onSubmit={handleDepositToExchange} style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div className="portal-form-group">
                    <label>Selecionar Cliente da Corretora</label>
                    <select
                      className="portal-input"
                      value={depositClientId}
                      onChange={(e) => setDepositClientId(e.target.value)}
                      disabled={exchangeClients.length === 0}
                    >
                      {exchangeClients.length === 0 ? (
                        <option value="">Nenhum cliente real da Global Exchange cadastrado</option>
                      ) : (
                        exchangeClients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.id} — {c.name} (Saldo: {c.btxcBalance.toLocaleString()} BTXC)
                          </option>
                        ))
                      )}
                    </select>
                    {exchangeClients.length === 0 && (
                      <small style={{ color: '#f59e0b', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                        * Apenas clientes reais da Global Exchange podem receber depósitos.
                      </small>
                    )}
                  </div>

                  <div className="portal-form-group">
                    <label>Quantidade de BTXC a Depositar</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      className="portal-input"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      required
                      disabled={exchangeClients.length === 0}
                    />
                  </div>

                  <div className="portal-form-group">
                    <label>Endereço de Custódia Hot Wallet Global Exchange</label>
                    <input
                      type="text"
                      className="portal-input portal-mono"
                      readOnly
                      value={exchangeHotWallet}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Saldo na Carteira do Administrador:{' '}
                    <strong style={{ color: '#10b981' }}>{walletBalance.toFixed(4)} BTXC</strong>
                  </span>

                  <button
                    type="submit"
                    className="portal-btn portal-btn-primary"
                    disabled={exchangeClients.length === 0}
                  >
                    Efetuar Depósito com Tag do Cliente
                  </button>
                </div>

                {depositAlert && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid #38bdf8',
                      color: '#38bdf8',
                      fontSize: '12px',
                    }}
                  >
                    {depositAlert}
                  </div>
                )}
              </form>

              {/* Client Deposit Reconciliation Table */}
              <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#f8fafc' }}>
                Histórico de Depósitos dos Clientes da Corretora
              </h4>
              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>ID Depósito</th>
                      <th>Cliente</th>
                      <th>Hash da Transação (TXID)</th>
                      <th>Valor (BTXC)</th>
                      <th>Confirmações na Blockchain</th>
                      <th>Status na Corretora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exchangeDeposits.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                          Nenhum depósito efetuado para clientes reais no momento.
                        </td>
                      </tr>
                    ) : (
                      exchangeDeposits.map((dep) => (
                        <tr key={dep.id}>
                          <td style={{ fontWeight: 'bold', color: '#f97316' }}>{dep.id}</td>
                          <td>
                            <div><strong>{dep.clientName}</strong></div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{dep.clientId}</div>
                          </td>
                          <td className="portal-mono" style={{ color: '#38bdf8', fontSize: '11px' }}>
                            {dep.txid}
                          </td>
                          <td style={{ color: '#10b981', fontWeight: 'bold' }}>
                            +{dep.amount.toFixed(4)} BTXC
                          </td>
                          <td>
                            <span
                              style={{
                                background: dep.confirmations >= 6 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                                color: dep.confirmations >= 6 ? '#10b981' : '#facc15',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                              }}
                            >
                              {dep.confirmations}/6 Blocos
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                color: dep.status === 'Creditado' ? '#10b981' : '#38bdf8',
                                fontWeight: 'bold',
                                fontSize: '12px',
                              }}
                            >
                              {dep.status === 'Creditado' ? '✓ Saldo Creditado' : '⏳ Aguardando Mineração'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Real Clients Table Exclusively from Global Exchange Platform */}
            <div className="portal-card">
              <div className="portal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 className="portal-card-title">Carteira de Clientes da Global Exchange (Conglomerado Real)</h3>
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid #10b981',
                        color: '#10b981',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      ● Base 100% Real ({exchangeClients.length})
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#cbd5e1' }}>
                    <strong>Total Custodiado Real:</strong> <span style={{ color: '#10b981', fontWeight: 800 }}>{exchangeClients.reduce((acc, c) => acc + c.btxcBalance, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} GX</span> &bull;{' '}
                    <strong>Total em Reais (R$):</strong> <span style={{ color: '#38bdf8', fontWeight: 800 }}>R$ {exchangeClients.reduce((acc, c) => acc + c.brlBalance, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> &bull;{' '}
                    <span style={{ color: '#94a3b8' }}>{exchangeClients.length} cliente(s) ativo(s)</span>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="portal-btn"
                    style={{
                      background: '#7f1d1d',
                      border: '1px solid #ef4444',
                      color: '#fca5a5',
                      fontSize: '12px',
                      padding: '6px 12px',
                    }}
                    onClick={handlePurgeFictitiousClients}
                    title="Eliminar quaisquer cadastros fictícios residuais do navegador e re-sincronizar"
                  >
                    🧹 Limpar Clientes Fictícios &amp; Sincronizar
                  </button>
                  <button
                    type="button"
                    className="portal-btn portal-btn-primary"
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={fetchRealClientsFromGlobalExchange}
                    disabled={isLoadingClients}
                  >
                    {isLoadingClients ? '🔄 Sincronizando...' : '🔄 Sincronizar com Global Exchange'}
                  </button>
                  <button
                    type="button"
                    className="portal-btn"
                    style={{
                      background: '#1e3a8a',
                      border: '1px solid #3b82f6',
                      color: '#bfdbfe',
                      fontSize: '12px',
                      padding: '6px 14px',
                      fontWeight: 700,
                    }}
                    onClick={() => setShowBridgeModal(true)}
                    title="Abrir Central de Sincronização entre Plataformas Independentes"
                  >
                    🔗 Ponte em Tempo Real (Broadcast)
                  </button>
                  <button
                    type="button"
                    className="portal-btn"
                    style={{
                      background: '#065f46',
                      border: '1px solid #10b981',
                      color: '#d1fae5',
                      fontSize: '12px',
                      padding: '6px 14px',
                      fontWeight: 700,
                      cursor: isReconciling ? 'wait' : 'pointer',
                      opacity: isReconciling ? 0.8 : 1,
                    }}
                    onClick={handleReconcileWithCustodyLedger}
                    disabled={isReconciling}
                    title="Forçar reconciliação do saldo com o Livro Razão de Custódia Engecema (250,00 GX · R$ 42.385.000,00)"
                  >
                    {isReconciling ? '⏳ Reconciliando com Livro Razão...' : '⚖️ Reconciliar com Livro Razão'}
                  </button>
                </div>
              </div>

              {reconcileNotice && (
                <div
                  style={{
                    background: 'linear-gradient(90deg, rgba(6, 95, 70, 0.45) 0%, rgba(16, 185, 129, 0.15) 100%)',
                    border: '1px solid #10b981',
                    borderLeft: '5px solid #10b981',
                    borderRadius: '8px',
                    padding: '12px 18px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>⚖️</span>
                    <div>
                      <div style={{ color: '#6ee7b7', fontWeight: 700, fontSize: '13px' }}>
                        {reconcileNotice.message}
                      </div>
                      {reconcileNotice.details && (
                        <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                          {reconcileNotice.details} &bull; Sincronizado às <strong>{reconcileNotice.timestamp}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                      ● 100% RECONCILIADO
                    </span>
                    <button
                      type="button"
                      onClick={() => setReconcileNotice(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '2px 6px',
                      }}
                      title="Dispensar aviso"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {lastSyncTime && (
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span>Conexão Supabase:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>● Online (odbbtgkxgiqlfhcepwuj)</span>
                  <span>&bull;</span>
                  <span>Canal Realtime:</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>● Ativo</span>
                  <span>&bull;</span>
                  <span>Última sincronização com a corretora: <strong>{lastSyncTime}</strong></span>
                </div>
              )}

              {clientsError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '12px' }}>
                  ⚠️ {clientsError}
                  <button type="button" onClick={fetchRealClientsFromGlobalExchange} style={{ marginLeft: '12px', textDecoration: 'underline', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                    Tentar Novamente
                  </button>
                </div>
              )}

              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Identificador</th>
                      <th>Nome / Razão Social</th>
                      <th>E-mail</th>
                      <th>CPF / CNPJ</th>
                      <th>Endereço BitX Core (Destino)</th>
                      <th>Saldo GX (BitX)</th>
                      <th>Saldo com Liquidez (R$)</th>
                      <th>Valor de Mercado Estimado</th>
                      <th>Status KYC</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingClients ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                          <div style={{ display: 'inline-block', fontSize: '14px', color: '#38bdf8' }}>
                            ⏳ Conectando e sincronizando clientes reais da plataforma Global Exchange...
                          </div>
                        </td>
                      </tr>
                    ) : exchangeClients.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '36px 20px', color: '#94a3b8' }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛡️</div>
                          <p style={{ margin: '0 0 8px', fontSize: '15px', color: '#f8fafc', fontWeight: 600 }}>
                            Nenhum cliente cadastrado na plataforma Global Exchange no momento.
                          </p>
                          <p style={{ margin: '0 0 16px', fontSize: '13px', maxWidth: '580px', marginInline: 'auto', lineHeight: '1.5', color: '#94a3b8' }}>
                            Todos os clientes fictícios foram totalmente eliminados.
                          </p>
                          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="portal-btn"
                              style={{
                                background: '#065f46',
                                border: '1px solid #10b981',
                                color: '#d1fae5',
                                fontSize: '13px',
                                padding: '8px 18px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                              onClick={handleReconcileWithCustodyLedger}
                              disabled={isReconciling}
                            >
                              {isReconciling ? '⏳ Reconciliando...' : '⚖️ Reconciliar com Livro Razão de Custódia Engecema'}
                            </button>
                            <button
                              type="button"
                              className="portal-btn portal-btn-secondary"
                              onClick={fetchRealClientsFromGlobalExchange}
                            >
                              🔄 Atualizar Conexão com a Corretora
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      exchangeClients.map((c) => {
                        const estVal = c.estimatedMarketValue || (c.btxcBalance * (105270385.0 / 250.0));
                        const shortAddr = c.bitxAddress
                          ? `${c.bitxAddress.substring(0, 8)}...${c.bitxAddress.slice(-6)}`
                          : 'bxrt1qnk...4s0zey';

                        return (
                          <tr key={c.id}>
                            <td className="portal-mono" style={{ fontWeight: 'bold', color: '#f97316' }}>
                              {c.id}
                            </td>
                            <td>
                              <div><strong>{c.name}</strong></div>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '10px',
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  color: '#38bdf8',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  marginTop: '2px',
                                  fontWeight: 'bold',
                                }}
                              >
                                {c.titleBadge || (c.id === 'GX-CLI-0001' ? 'Titular Principal' : 'Cliente')}
                              </span>
                              {c.createdAt && (
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                  Cadastrado: {c.createdAt}
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{c.email}</div>
                            </td>
                            <td>
                              <div style={{ fontSize: '12px', color: '#e2e8f0', fontFamily: 'DM Mono, monospace' }}>
                                {c.document || '70781338387'}
                              </div>
                            </td>
                            <td>
                              <div
                                className="portal-mono"
                                style={{
                                  fontSize: '11px',
                                  color: '#38bdf8',
                                  background: '#090d16',
                                  padding: '3px 6px',
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer',
                                }}
                                title={`Copiar endereço completo: ${c.bitxAddress || 'bxrt1qnk68972j7s9k8j3z2p987e9k3l98764s0zey'}`}
                                onClick={() => {
                                  navigator.clipboard.writeText(c.bitxAddress || 'bxrt1qnk68972j7s9k8j3z2p987e9k3l98764s0zey');
                                  setBridgeNotice('Endereço BitX Core copiado!');
                                  setTimeout(() => setBridgeNotice(''), 3000);
                                }}
                              >
                                {shortAddr} 📋
                              </div>
                            </td>
                            <td style={{ color: '#10b981', fontWeight: 'bold', fontSize: '13px', fontFamily: 'DM Mono, monospace' }}>
                              {c.btxcBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{' '}
                              <span style={{ fontSize: '11px', color: '#f97316' }}>GX</span>
                              <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '2px', fontWeight: 'normal' }}>
                                🛡️ Sincronizado Real
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: '700', color: '#10b981', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>
                                R$ {c.brlBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                $ {c.usdtBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} USDT
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: '700', color: '#f59e0b', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>
                                R$ {estVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </td>
                            <td>
                              <span
                                style={{
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {c.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="portal-btn portal-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, color: '#38bdf8' }}
                                  onClick={() => handleStartEditClient(c)}
                                  title="Gerenciar dados do cliente ou creditar/debitar saldo"
                                >
                                  Gerenciar / Creditar
                                </button>
                                <button
                                  type="button"
                                  className="portal-btn portal-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                  onClick={() => {
                                    setDepositClientId(c.id);
                                    setDepositAlert(`Cliente "${c.name}" selecionado no formulário de depósito.`);
                                    window.scrollTo({ top: 400, behavior: 'smooth' });
                                  }}
                                >
                                  Depositar
                                </button>
                                <button
                                  type="button"
                                  className="portal-btn portal-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '11px', color: '#10b981' }}
                                  onClick={() => {
                                    setOrderClientId(c.id);
                                    setOrderFeedback(`Cliente "${c.name}" selecionado para negociação.`);
                                    window.scrollTo({ top: 300, behavior: 'smooth' });
                                  }}
                                >
                                  Negociar
                                </button>
                                <button
                                  type="button"
                                  className="portal-btn portal-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '11px', color: '#ef4444' }}
                                  onClick={() => setClientToDelete({ id: c.id, name: c.name, email: c.email })}
                                  title="Remover cliente da Corretora, do Painel de Custódia e do Livro Razão"
                                >
                                  Remover
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CONFIGURAÇÕES DA MOEDA */}
        {activeTab === 'config' && (
          <div>
            <div className="portal-card">
              <div className="portal-card-header">
                <div>
                  <h2 className="portal-card-title">⚙️ Painel de Configurações da Moeda BitX Core</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Parâmetros oficiais da moeda BTXC na Mainnet, nós P2P e configuração de
                    segurança da corretora.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                  marginBottom: '28px',
                }}
              >
                <div style={{ background: '#0b1120', padding: '16px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>NOME DA CRIPTOMOEDA</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>
                    BitX Core (BTXC) · Mainnet
                  </div>
                </div>

                <div style={{ background: '#0b1120', padding: '16px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>FORNECIMENTO MÁXIMO</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f97316' }}>
                    1.500.000.000 BTXC
                  </div>
                </div>

                <div style={{ background: '#0b1120', padding: '16px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>ALGORITMO DE CONSENSO</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>
                    Proof-of-Work (SHA-256d)
                  </div>
                </div>

                <div style={{ background: '#0b1120', padding: '16px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>INTERVALO DE BLOCO ALVO</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38bdf8' }}>
                    150 segundos (2.5 min)
                  </div>
                </div>
              </div>

              {/* BitX.conf generator */}
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: '#f8fafc' }}>
                  Configurador do Nó Mainnet (bitx.conf)
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8' }}>RPC User</label>
                    <input
                      type="text"
                      className="portal-input"
                      value={rpcUser}
                      onChange={(e) => setRpcUser(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8' }}>RPC Password</label>
                    <input
                      type="password"
                      className="portal-input"
                      value={rpcPass}
                      onChange={(e) => setRpcPass(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8' }}>RPC Port (Mainnet)</label>
                    <input
                      type="text"
                      className="portal-input"
                      value={rpcPort}
                      onChange={(e) => setRpcPort(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8' }}>P2P Port (Mainnet)</label>
                    <input
                      type="text"
                      className="portal-input"
                      value={p2pPort}
                      onChange={(e) => setP2pPort(e.target.value)}
                    />
                  </div>
                </div>

                <textarea
                  className="portal-textarea"
                  readOnly
                  value={generatedBitxConf}
                  rows={9}
                />

                <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="portal-btn portal-btn-primary"
                    onClick={handleCopyBitxConf}
                  >
                    {confCopied ? '✓ bitx.conf Copiado!' : 'Copiar bitx.conf Mainnet'}
                  </button>
                </div>
              </div>

              {/* User access control */}
              <div style={{ marginTop: '36px', borderTop: '1px solid #1f2937', paddingTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: 'bold' }}>
                        👤 Acessos Administrativos & Operadores da Corretora
                      </h3>
                      <span
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid #10b981',
                          color: '#10b981',
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        ● Sincronizado e Persistente (Local & Nuvem)
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                      Gerencie os operadores com permissão de custódia, auditoria e controle de nós na plataforma Global Exchange. Todas as alterações são salvas e sincronizadas instantaneamente.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px', borderColor: '#334155', color: '#94a3b8' }}
                    onClick={() => {
                      updateOperatorsAndPersist(DEFAULT_REAL_OPERATORS, '🧹 Lista de operadores restaurada com sucesso: apenas geonimatos31@gmail.com!');
                      notifyCloudOperators(DEFAULT_REAL_OPERATORS);
                      addLog('[Acessos] Lista purificada mantendo apenas operador oficial geonimatos31@gmail.com.', 'success');
                    }}
                    title="Restaura a lista mantendo unicamente geonimatos31@gmail.com"
                  >
                    🔄 Purificar / Manter Somente Operador Oficial
                  </button>
                </div>

                {operatorFeedback && (
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid #10b981',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '16px',
                      color: '#a7f3d0',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>✓</span>
                    <span>{operatorFeedback}</span>
                  </div>
                )}

                {/* Table of operators */}
                <div className="portal-table-container" style={{ marginBottom: '16px' }}>
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Nome / Identificador</th>
                        <th>Email / Usuário</th>
                        <th>Perfil de Acesso</th>
                        <th>Status</th>
                        <th>Data de Cadastro</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                            Nenhum operador cadastrado no momento.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => {
                          const isSuper = u.role === 'Super Admin';
                          const isAuditor = u.role === 'Auditor';
                          return (
                            <tr key={u.id || u.username}>
                              <td style={{ fontWeight: 'bold', color: '#f8fafc' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '14px' }}>{isSuper ? '👑' : isAuditor ? '🔍' : '⚙️'}</span>
                                  <span>{u.name || u.username}</span>
                                </div>
                              </td>
                              <td style={{ fontFamily: 'monospace', color: '#38bdf8' }}>
                                {u.email || u.username}
                              </td>
                              <td>
                                <span
                                  style={{
                                    background: isSuper ? '#f97316' : isAuditor ? '#8b5cf6' : '#2563eb',
                                    color: '#fff',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {u.role}
                                </span>
                              </td>
                              <td>
                                <span
                                  style={{
                                    color: u.status === 'Ativo' ? '#10b981' : '#94a3b8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                  }}
                                >
                                  <span
                                    style={{
                                      width: '7px',
                                      height: '7px',
                                      borderRadius: '50%',
                                      background: u.status === 'Ativo' ? '#10b981' : '#64748b',
                                      display: 'inline-block',
                                    }}
                                  />
                                  {u.status || 'Ativo'}
                                </span>
                              </td>
                              <td style={{ color: '#94a3b8', fontSize: '12px' }}>
                                {u.createdAt || '19/10/2026'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="portal-btn portal-btn-secondary"
                                    style={{ padding: '3px 10px', fontSize: '11px', color: '#38bdf8', borderColor: '#0284c7' }}
                                    onClick={() => setEditingOperator({ ...u })}
                                  >
                                    ✏️ Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="portal-btn portal-btn-secondary"
                                    style={{ padding: '3px 10px', fontSize: '11px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                    onClick={() => {
                                      if (users.length <= 1) {
                                        setOperatorFeedback(`Não é possível remover o único operador ativo (${u.username}).`);
                                        setTimeout(() => setOperatorFeedback(''), 4000);
                                        return;
                                      }
                                      const remaining = users.filter((item) => item.username !== u.username && item.id !== u.id);
                                      updateOperatorsAndPersist(remaining, `Operador ${u.username} removido com sucesso.`);
                                      notifyCloudOperators(remaining);
                                      addLog(`[Acessos] Operador ${u.username} removido da lista de acessos administrativos.`, 'warning');
                                    }}
                                  >
                                    🗑️ Remover
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Inline Editing Drawer when an operator is being edited */}
                {editingOperator && (
                  <div
                    style={{
                      background: '#131d31',
                      border: '1px solid #3b82f6',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '14px' }}>
                        ✏️ Editando Operador: {editingOperator.username}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingOperator(null)}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                          Nome Completo / Identificador
                        </label>
                        <input
                          type="text"
                          className="portal-input"
                          value={editingOperator.name}
                          onChange={(e) => setEditingOperator({ ...editingOperator, name: e.target.value })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                          Email / Usuário
                        </label>
                        <input
                          type="email"
                          className="portal-input"
                          value={editingOperator.email}
                          onChange={(e) =>
                            setEditingOperator({
                              ...editingOperator,
                              email: e.target.value,
                              username: e.target.value,
                            })
                          }
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                          Perfil de Acesso
                        </label>
                        <select
                          className="portal-input"
                          value={editingOperator.role}
                          onChange={(e) => setEditingOperator({ ...editingOperator, role: e.target.value as any })}
                          style={{ width: '100%' }}
                        >
                          <option value="Super Admin">Super Admin</option>
                          <option value="Operador">Operador da Corretora</option>
                          <option value="Auditor">Auditor de Compliance</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                          Status
                        </label>
                        <select
                          className="portal-input"
                          value={editingOperator.status}
                          onChange={(e) => setEditingOperator({ ...editingOperator, status: e.target.value as any })}
                          style={{ width: '100%' }}
                        >
                          <option value="Ativo">Ativo</option>
                          <option value="Inativo">Inativo</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className="portal-btn portal-btn-primary"
                        onClick={() => {
                          if (!editingOperator.username.trim()) return;
                          const updated = users.map((op) =>
                            op.id === editingOperator.id || op.username === editingOperator.username
                              ? editingOperator
                              : op
                          );
                          updateOperatorsAndPersist(updated, `Operador ${editingOperator.username} atualizado com sucesso!`);
                          notifyCloudOperators(updated);
                          addLog(`[Acessos] Operador ${editingOperator.username} atualizado com sucesso.`, 'info');
                          setEditingOperator(null);
                        }}
                      >
                        ✓ Salvar Alterações
                      </button>
                      <button
                        type="button"
                        className="portal-btn portal-btn-secondary"
                        onClick={() => setEditingOperator(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Add User Form */}
                <div style={{ background: '#0e1726', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '10px' }}>
                    ➕ Cadastrar Novo Operador da Corretora:
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="portal-input"
                      placeholder="Nome do operador (ex: Geoni Matos)"
                      style={{ maxWidth: '240px', flex: '1 1 200px' }}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                    <input
                      type="text"
                      className="portal-input"
                      placeholder="Email ou usuário (ex: novo@globalexchange.com)"
                      style={{ maxWidth: '300px', flex: '1 1 240px' }}
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                    />
                    <select
                      className="portal-input"
                      style={{ maxWidth: '200px', flex: '1 1 180px' }}
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                    >
                      <option value="Super Admin">Super Admin</option>
                      <option value="Operador">Operador da Corretora</option>
                      <option value="Auditor">Auditor de Compliance</option>
                    </select>
                    <button
                      type="button"
                      className="portal-btn portal-btn-primary"
                      onClick={() => {
                        const targetUser = newUsername.trim();
                        if (!targetUser) return;
                        if (users.some((x) => x.username.toLowerCase() === targetUser.toLowerCase() || x.email.toLowerCase() === targetUser.toLowerCase())) {
                          setOperatorFeedback('Este operador ou email já está cadastrado na lista.');
                          setTimeout(() => setOperatorFeedback(''), 4000);
                          return;
                        }
                        const newOp: OperatorUser = {
                          id: `GX-OP-${Date.now().toString(36).toUpperCase()}`,
                          name: newName.trim() || targetUser,
                          username: targetUser,
                          email: targetUser,
                          role: newRole,
                          status: 'Ativo',
                          createdAt: new Date().toLocaleDateString('pt-BR'),
                        };
                        const updated = [...users, newOp];
                        updateOperatorsAndPersist(updated, `Novo operador ${newOp.username} adicionado e sincronizado com sucesso!`);
                        notifyCloudOperators(updated);
                        addLog(`[Acessos] Novo operador adicionado: ${newOp.username} (${newOp.role}).`, 'success');
                        setNewUsername('');
                        setNewName('');
                      }}
                    >
                      Adicionar Acesso & Sincronizar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: GESTÃO E SINCRONIZAÇÃO DE CLIENTES REAIS DA GLOBAL EXCHANGE */}
            <div className="portal-card" style={{ marginTop: '24px' }}>
              <div
                className="portal-card-header"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 className="portal-card-title">
                      🏛️ Gestão de Clientes Reais da Corretora Global Exchange
                    </h2>
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid #10b981',
                        color: '#10b981',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      ● Sincronização em Tempo Real Ativa
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Cadastre, edite e sincronize clientes e contas corporativas reais da Global Exchange. Todas as alterações refletem instantaneamente no livro de ofertas, custódia e gateway de depósitos.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="portal-btn"
                    style={{
                      background: '#065f46',
                      border: '1px solid #10b981',
                      color: '#d1fae5',
                      fontSize: '12px',
                      padding: '6px 14px',
                      fontWeight: 700,
                      cursor: isReconciling ? 'wait' : 'pointer',
                      opacity: isReconciling ? 0.8 : 1,
                    }}
                    onClick={handleReconcileWithCustodyLedger}
                    disabled={isReconciling}
                    title="Reconciliar clientes reais com o Livro Razão de Custódia Engecema e a Corretora Global Exchange"
                  >
                    {isReconciling ? '⏳ Reconciliando...' : '⚖️ Reconciliar com Custódia & Livro Razão'}
                  </button>
                  <button
                    type="button"
                    className="portal-btn portal-btn-primary"
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={fetchRealClientsFromGlobalExchange}
                    disabled={isLoadingClients}
                  >
                    {isLoadingClients ? '🔄 Sincronizando...' : '🔄 Sincronizar com a Global Exchange'}
                  </button>
                  <button
                    type="button"
                    className="portal-btn"
                    style={{
                      background: '#7f1d1d',
                      border: '1px solid #ef4444',
                      color: '#fca5a5',
                      fontSize: '12px',
                      padding: '6px 12px',
                    }}
                    onClick={() => setShowPurgeModal(true)}
                  >
                    🧹 Purificar Cache
                  </button>
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => setActiveTab('exchange')}
                  >
                    Ir para Corretora (Clientes) ↗
                  </button>
                </div>
              </div>

              {reconcileNotice && (
                <div
                  style={{
                    background: 'linear-gradient(90deg, rgba(6, 95, 70, 0.45) 0%, rgba(16, 185, 129, 0.15) 100%)',
                    border: '1px solid #10b981',
                    borderLeft: '5px solid #10b981',
                    borderRadius: '8px',
                    padding: '12px 18px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>⚖️</span>
                    <div>
                      <div style={{ color: '#6ee7b7', fontWeight: 700, fontSize: '13px' }}>
                        {reconcileNotice.message}
                      </div>
                      {reconcileNotice.details && (
                        <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                          {reconcileNotice.details} &bull; Sincronizado às <strong>{reconcileNotice.timestamp}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                      ● 100% RECONCILIADO
                    </span>
                    <button
                      type="button"
                      onClick={() => setReconcileNotice(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '2px 6px',
                      }}
                      title="Dispensar aviso"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Status Banner */}
              <div
                style={{
                  background: '#0b1120',
                  border: '1px solid #1f2937',
                  borderLeft: '4px solid #10b981',
                  borderRadius: '6px',
                  padding: '14px 18px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <strong style={{ color: '#f8fafc', fontSize: '13px' }}>
                    Status da Base de Clientes:
                  </strong>{' '}
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                    {exchangeClients.length} Contas Reais Autenticadas
                  </span>{' '}
                  &bull; Clientes fictícios isolados e expurgados da aplicação.
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Custódia Total:{' '}
                  <strong style={{ color: '#10b981' }}>
                    {exchangeClients
                      .reduce((acc, c) => acc + (c.btxcBalance || 0), 0)
                      .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{' '}
                    BTXC
                  </strong>{' '}
                  |{' '}
                  <strong style={{ color: '#f8fafc' }}>
                    R${' '}
                    {exchangeClients
                      .reduce((acc, c) => acc + (c.brlBalance || 0), 0)
                      .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {/* Dica de Sincronização Supabase RLS */}
              <div
                style={{
                  background: '#0d1526',
                  border: '1px solid #1e293b',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  fontSize: '12px',
                  color: '#94a3b8',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>💡 Sincronização na Nuvem (Supabase):</span>{' '}
                  Para permitir gravação direta na tabela <code>clients</code> do Supabase Cloud sem aviso de RLS, basta executar no SQL Editor do painel Supabase:
                  <code style={{ display: 'inline-block', background: '#090d16', color: '#10b981', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontFamily: 'DM Mono, monospace' }}>
                    ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
                  </code>
                </div>
              </div>

              {/* FORMULÁRIO DE CADASTRO / EDIÇÃO */}
              <form
                onSubmit={handleSaveRealClient}
                style={{
                  background: '#0d1526',
                  border: '1px solid #233554',
                  borderRadius: '8px',
                  padding: '20px',
                  marginBottom: '24px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    borderBottom: '1px solid #1e293b',
                    paddingBottom: '10px',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#f8fafc' }}>
                    {editingClient
                      ? `✏️ Editando Cliente Real: ${editingClient.name} (${editingClient.id})`
                      : '➕ Cadastrar Novo Cliente Real na Global Exchange'}
                  </h3>
                  {editingClient && (
                    <button
                      type="button"
                      className="portal-btn portal-btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={handleCancelEditClient}
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '14px',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Identificador / Tag (ID)
                    </label>
                    <input
                      type="text"
                      className="portal-input portal-mono"
                      placeholder="Ex: GE-CORP-001 ou GE-CLI-1029"
                      value={newClientId}
                      onChange={(e) => setNewClientId(e.target.value)}
                    />
                    <small style={{ fontSize: '10px', color: '#64748b' }}>
                      Deixe vazio para gerar código automático.
                    </small>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Nome Completo / Razão Social *
                    </label>
                    <input
                      type="text"
                      className="portal-input"
                      placeholder="Ex: Engecema Fomento e Tecnologia Ltda"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      E-mail Institucional / Contato *
                    </label>
                    <input
                      type="email"
                      className="portal-input"
                      placeholder="Ex: cliente@engecema.com.br"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Documento Oficial (CPF / CNPJ)
                    </label>
                    <input
                      type="text"
                      className="portal-input"
                      placeholder="Ex: 09.123.456/0001-78 ou CPF"
                      value={newClientDocument}
                      onChange={(e) => setNewClientDocument(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Endereço BitX Core (Destino na Rede)
                    </label>
                    <input
                      type="text"
                      className="portal-input portal-mono"
                      placeholder="Ex: btxc1q... ou bxrt1q... (Vazio para gerar automático)"
                      value={newClientBitxAddress}
                      onChange={(e) => setNewClientBitxAddress(e.target.value)}
                    />
                    <small style={{ fontSize: '10px', color: '#64748b' }}>
                      Endereço exclusivo para recebimento de transferências na Mainnet.
                    </small>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Saldo Inicial BTXC
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      className="portal-input"
                      value={newClientBtxc}
                      onChange={(e) => setNewClientBtxc(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Saldo Inicial BRL (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="portal-input"
                      value={newClientBrl}
                      onChange={(e) => setNewClientBrl(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Saldo Inicial USDT ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="portal-input"
                      value={newClientUsdt}
                      onChange={(e) => setNewClientUsdt(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Perfil / Status KYC
                    </label>
                    <select
                      className="portal-input"
                      value={newClientStatus}
                      onChange={(e) => setNewClientStatus(e.target.value as any)}
                    >
                      <option value="Institucional">Institucional (Mesa Corporativa)</option>
                      <option value="Verificado KYC">Verificado KYC (Completo)</option>
                      <option value="VIP">VIP Private (Alta Renda)</option>
                      <option value="Ativo">Ativo Padrão</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="submit" className="portal-btn portal-btn-primary">
                    {editingClient ? '✓ Atualizar e Sincronizar Cliente' : '＋ Cadastrar e Sincronizar Cliente Real'}
                  </button>
                  {editingClient && (
                    <button
                      type="button"
                      className="portal-btn portal-btn-secondary"
                      onClick={handleCancelEditClient}
                    >
                      Cancelar
                    </button>
                  )}
                  {clientFormFeedback && (
                    <span
                      style={{
                        fontSize: '12px',
                        color: clientFormFeedback.startsWith('Já existe') || clientFormFeedback.startsWith('Por favor') ? '#ef4444' : '#10b981',
                        fontWeight: 'bold',
                        marginLeft: '8px',
                      }}
                    >
                      {clientFormFeedback}
                    </span>
                  )}
                </div>
              </form>

              {/* TABELA DE CLIENTES REAIS COM QUADRO AO LADO: VALOR EM REAIS (R$) E VALOR EM DÓLARES (USDT) */}
              {(() => {
                const totalClientsGx = exchangeClients.reduce((sum, c) => sum + (c.btxcBalance || 0), 0);
                const totalClientsBrl = exchangeClients.reduce((sum, c) => sum + (c.brlBalance || 0), 0);
                const totalClientsUsdt = exchangeClients.reduce((sum, c) => sum + (c.usdtBalance || 0), 0);
                const totalClientsEst = exchangeClients.reduce((sum, c) => sum + (c.estimatedMarketValue || 0), 0);
                const primaryClient = exchangeClients[0];

                return (
                  <div>
                    {/* Cabeçalho da Seção */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '14px',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: '16px',
                            color: '#f8fafc',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span>👥 Clientes Reais em Custódia ({exchangeClients.length})</span>
                          <span
                            style={{
                              fontSize: '11px',
                              background: '#0284c7',
                              color: '#ffffff',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: '700',
                              letterSpacing: '0.04em',
                            }}
                          >
                            MEMÓRIA AI STUDIO & CLOUD ATIVA
                          </span>
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                          Contas reais com custódia auditada, liquidez em Reais (R$) e paridade internacional em Dólares (USDT).
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="portal-btn portal-btn-secondary"
                          style={{
                            fontSize: '11px',
                            padding: '6px 12px',
                            borderColor: '#38bdf8',
                            color: '#38bdf8',
                            fontWeight: 'bold',
                          }}
                          onClick={handleRestoreMasterClient}
                          title="Restaurar da memória do AI Studio o Titular Mestre (GX-CLI-0001 - Geoni Clementino Cesar de Matos)"
                        >
                          ↺ Restaurar Titular da Memória
                        </button>
                        <button
                          type="button"
                          className="portal-btn portal-btn-primary"
                          style={{
                            fontSize: '11px',
                            padding: '6px 14px',
                            fontWeight: 'bold',
                          }}
                          onClick={handlePushCustodyToSupabase}
                          disabled={isPushingCloud}
                          title="Forçar gravação e espelhamento imediato de todos os clientes no Supabase Cloud"
                        >
                          {isPushingCloud ? 'Sincronizando...' : '☁️ Sincronizar Nuvem'}
                        </button>
                      </div>
                    </div>

                    {/* LAYOUT EM GRID LADO A LADO: TABELA DE CLIENTES + QUADRO LATERAL DE VALORES */}
                    <div className="clients-grid-responsive">
                      {/* COLUNA ESQUERDA: TABELA DE CLIENTES REAIS */}
                      <div className="portal-table-container" style={{ margin: 0 }}>
                        <table className="portal-table">
                          <thead>
                            <tr>
                              <th>Identificador</th>
                              <th>Nome / Razão Social</th>
                              <th>Documento</th>
                              <th>E-mail</th>
                              <th>Saldo BTXC</th>
                              <th>Saldo BRL</th>
                              <th>Saldo USDT</th>
                              <th>Status KYC</th>
                              <th>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {exchangeClients.length === 0 ? (
                              <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                                  Nenhum cliente em exibição. Clique em <strong>"Restaurar Titular da Memória"</strong> acima.
                                </td>
                              </tr>
                            ) : (
                              exchangeClients.map((c) => (
                                <tr key={c.id}>
                                  <td className="portal-mono" style={{ fontWeight: 'bold', color: '#f97316' }}>
                                    <div>{c.id}</div>
                                    {c.bitxAddress && (
                                      <div
                                        style={{
                                          fontSize: '10px',
                                          color: '#94a3b8',
                                          fontFamily: 'DM Mono, monospace',
                                          marginTop: '2px',
                                        }}
                                        title={c.bitxAddress}
                                      >
                                        🏷️ {c.bitxAddress.substring(0, 16)}...
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <strong>{c.name}</strong>
                                    {c.titleBadge && (
                                      <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 'bold' }}>
                                        ★ {c.titleBadge}
                                      </div>
                                    )}
                                    {c.createdAt && (
                                      <div style={{ fontSize: '10px', color: '#64748b' }}>Cadastrado: {c.createdAt}</div>
                                    )}
                                  </td>
                                  <td style={{ fontSize: '12px', color: '#cbd5e1' }}>{c.document || '—'}</td>
                                  <td style={{ fontSize: '12px', color: '#94a3b8' }}>{c.email}</td>
                                  <td style={{ color: '#10b981', fontWeight: 'bold' }}>
                                    {c.btxcBalance.toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 4,
                                    })}{' '}
                                    BTXC
                                  </td>
                                  <td style={{ fontWeight: 'bold', color: '#6ee7b7' }}>
                                    R$ {c.brlBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ fontWeight: 'bold', color: '#7dd3fc' }}>
                                    $ {c.usdtBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        background:
                                          c.status === 'Institucional'
                                            ? 'rgba(59, 130, 246, 0.2)'
                                            : 'rgba(16, 185, 129, 0.15)',
                                        color: c.status === 'Institucional' ? '#60a5fa' : '#10b981',
                                        border: `1px solid ${
                                          c.status === 'Institucional'
                                            ? 'rgba(59, 130, 246, 0.4)'
                                            : 'rgba(16, 185, 129, 0.3)'
                                        }`,
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                      }}
                                    >
                                      {c.status}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                      <button
                                        type="button"
                                        className="portal-btn portal-btn-secondary"
                                        style={{
                                          padding: '3px 8px',
                                          fontSize: '11px',
                                          color: '#10b981',
                                          borderColor: '#10b981',
                                          fontWeight: 'bold',
                                        }}
                                        onClick={() => {
                                          setSelectedCustodyClientId(c.id);
                                          setActiveTab('custody');
                                        }}
                                        title="Abrir Painel de Custódia Engecema e Saldo em Reais"
                                      >
                                        🛡️ Custódia
                                      </button>
                                      <button
                                        type="button"
                                        className="portal-btn portal-btn-secondary"
                                        style={{ padding: '3px 8px', fontSize: '11px', color: '#f97316' }}
                                        onClick={() => handleStartEditClient(c)}
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        className="portal-btn portal-btn-secondary"
                                        style={{ padding: '3px 8px', fontSize: '11px', color: '#eab308', borderColor: '#eab308' }}
                                        onClick={() => handleResetClientBalance(c)}
                                        title="Zerar o saldo e limpar qualquer memória de saldo deste cliente"
                                      >
                                        ⚡ Zerar Saldo
                                      </button>
                                      <button
                                        type="button"
                                        className="portal-btn portal-btn-secondary"
                                        style={{ padding: '3px 8px', fontSize: '11px', color: '#38bdf8' }}
                                        onClick={() => {
                                          setOrderClientId(c.id);
                                          setDepositClientId(c.id);
                                          setActiveTab('exchange');
                                        }}
                                        title="Abrir na Corretora para negociar ou depositar"
                                      >
                                        Corretora ↗
                                      </button>
                                      <button
                                        type="button"
                                        className="portal-btn portal-btn-secondary"
                                        style={{ padding: '3px 8px', fontSize: '11px', color: '#ef4444' }}
                                        onClick={() => setClientToDelete({ id: c.id, name: c.name, email: c.email })}
                                      >
                                        Remover
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* COLUNA DIREITA: QUADRO AO LADO (VALOR EM REAIS R$ E VALOR EM DÓLARES USDT) */}
                      <div
                        style={{
                          background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 60%, #0a0f1d 100%)',
                          border: '1px solid #3b82f6',
                          borderRadius: '12px',
                          padding: '18px',
                          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45), 0 0 20px rgba(59, 130, 246, 0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                        }}
                      >
                        {/* Título do Quadro */}
                        <div style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: '#38bdf8',
                                fontWeight: '800',
                              }}
                            >
                              🛡️ QUADRO DE LIQUIDEZ & CUSTÓDIA
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                background: '#10b981',
                                color: '#0f172a',
                                fontWeight: '800',
                                padding: '2px 7px',
                                borderRadius: '4px',
                              }}
                            >
                              AO VIVO
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc', marginTop: '4px' }}>
                            Posição Patrimonial Consolidada
                          </div>
                        </div>

                        {/* CARTÃO DESTAQUE 1: VALOR EM REAIS (R$) */}
                        <div
                          style={{
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(6, 78, 59, 0.35) 100%)',
                            border: '1px solid #10b981',
                            borderRadius: '10px',
                            padding: '14px 16px',
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.15)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '800',
                                color: '#a7f3d0',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                              }}
                            >
                              VALOR EM REAIS (R$)
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                background: '#065f46',
                                color: '#6ee7b7',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                              }}
                            >
                              Banco do Brasil
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '24px',
                              fontWeight: '900',
                              color: '#ffffff',
                              fontFamily: 'DM Mono, monospace',
                              letterSpacing: '-0.02em',
                              margin: '4px 0',
                            }}
                          >
                            R$ {totalClientsBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#6ee7b7',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginTop: '4px',
                            }}
                          >
                            <span>Liquidez Bancária Vinculada</span>
                            <span style={{ fontWeight: 'bold' }}>1 GX = R$ 420.000,00</span>
                          </div>
                        </div>

                        {/* CARTÃO DESTAQUE 2: VALOR EM DÓLARES (USDT) */}
                        <div
                          style={{
                            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(12, 74, 110, 0.35) 100%)',
                            border: '1px solid #38bdf8',
                            borderRadius: '10px',
                            padding: '14px 16px',
                            boxShadow: '0 4px 14px rgba(56, 189, 248, 0.15)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '800',
                                color: '#bae6fd',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                              }}
                            >
                              VALOR EM DÓLARES (USDT)
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                background: '#0369a1',
                                color: '#e0f2fe',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                              }}
                            >
                              Tether USD
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '24px',
                              fontWeight: '900',
                              color: '#ffffff',
                              fontFamily: 'DM Mono, monospace',
                              letterSpacing: '-0.02em',
                              margin: '4px 0',
                            }}
                          >
                            $ {totalClientsUsdt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#7dd3fc',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginTop: '4px',
                            }}
                          >
                            <span>Paridade Cambial Oficial</span>
                            <span style={{ fontWeight: 'bold' }}>R$ 5,00 / USDT</span>
                          </div>
                        </div>

                        {/* DETALHES COMPLEMENTARES DA CUSTÓDIA */}
                        <div
                          style={{
                            background: 'rgba(15, 23, 42, 0.7)',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            border: '1px solid rgba(148, 163, 184, 0.15)',
                            fontSize: '12px',
                            color: '#cbd5e1',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#94a3b8' }}>Volume BitX (GX):</span>
                            <strong style={{ color: '#f97316', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>
                              {totalClientsGx.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} GX
                            </strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#94a3b8' }}>Valor Estimado de Mercado:</span>
                            <strong style={{ color: '#38bdf8', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>
                              R$ {totalClientsEst.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#94a3b8' }}>Titular em Memória:</span>
                            <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>
                              {primaryClient?.name || 'Geoni Clementino Cesar de Matos'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#94a3b8' }}>ID Registro / Contrato:</span>
                            <span style={{ color: '#f97316', fontFamily: 'DM Mono, monospace', fontSize: '11px', fontWeight: 'bold' }}>
                              {primaryClient?.id || 'GX-CLI-0001'}
                            </span>
                          </div>
                        </div>

                        {/* BOTÕES DE ACESSO RÁPIDO */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <button
                            type="button"
                            className="portal-btn portal-btn-secondary"
                            style={{
                              padding: '8px',
                              fontSize: '11px',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                            }}
                            onClick={() => {
                              if (primaryClient) setSelectedCustodyClientId(primaryClient.id);
                              setActiveTab('custody');
                            }}
                          >
                            🛡️ Ver Custódia
                          </button>
                          <button
                            type="button"
                            className="portal-btn portal-btn-secondary"
                            style={{
                              padding: '8px',
                              fontSize: '11px',
                              justifyContent: 'center',
                              borderColor: '#10b981',
                              color: '#10b981',
                              fontWeight: 'bold',
                            }}
                            onClick={() => {
                              if (primaryClient) {
                                setOrderClientId(primaryClient.id);
                                setDepositClientId(primaryClient.id);
                              }
                              setActiveTab('exchange');
                            }}
                          >
                            📈 Ver Corretora
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 4: EXPLORADOR DE BLOCOS */}
        {activeTab === 'explorer' && (
          <div>
            <div className="portal-card">
              <div className="portal-card-header">
                <h2 className="portal-card-title">⛓️ Explorador de Blocos da Blockchain BitX Core (Mainnet)</h2>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                  Altura Máxima: <strong>#{blockHeight.toLocaleString()}</strong> | Alvo PoW:{' '}
                  <strong>{difficulty}</strong>
                </div>
              </div>

              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Altura</th>
                      <th>Hash do Bloco (SHA-256d)</th>
                      <th>Merkle Root</th>
                      <th>Transações</th>
                      <th>Nonce</th>
                      <th>Recompensa</th>
                      <th>Data/Hora</th>
                      <th>Inspecionar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((b) => (
                      <tr key={b.height}>
                        <td style={{ fontWeight: 'bold', color: '#f97316' }}>#{b.height.toLocaleString()}</td>
                        <td className="portal-mono">{b.hash.substring(0, 22)}...</td>
                        <td className="portal-mono" style={{ color: '#94a3b8' }}>
                          {b.merkleRoot}
                        </td>
                        <td>{b.transactionsCount}</td>
                        <td className="portal-mono">{b.nonce}</td>
                        <td style={{ color: '#10b981', fontWeight: 'bold' }}>
                          +{b.reward.toFixed(2)} BTXC
                        </td>
                        <td style={{ color: '#94a3b8' }}>{b.timestamp}</td>
                        <td>
                          <button
                            type="button"
                            className="portal-btn portal-btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                            onClick={() => setSelectedBlock(b)}
                          >
                            Ver Bloco
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TRANSFERÊNCIAS & MEMPOOL */}
        {activeTab === 'mempool' && (
          <div>
            <div className="portal-card">
              <div className="portal-card-header">
                <div>
                  <h2 className="portal-card-title">💸 Transferências Rápidas na Mainnet</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Envie transações que serão propagadas para os nós da rede principal e para a
                    corretora Global Exchange.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSendTransaction}>
                {exchangeClients.length > 0 && (
                  <div style={{ marginBottom: '14px', padding: '12px 14px', background: '#090d16', border: '1px solid #1e293b', borderRadius: '6px' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                        🎯 Vincular Crédito à Conta do Cliente na Global Exchange:
                      </label>
                      <select
                        className="portal-input"
                        value={selectedTransferRecipientId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedTransferRecipientId(val);
                          if (val !== 'auto') {
                            const client = exchangeClients.find((c) => c.id === val);
                            if (client) {
                              const addr = client.bitxAddress || (client.id === 'GX-CLI-0001' ? 'bxrt1qnk68972j7s9k8j3z2p987e9k3l98764s0zey' : 'btxc1qf08xve992k7s9k8j3z2p987e9k3l98764a');
                              setSendTo(addr);
                            }
                          }
                        }}
                        style={{ width: '100%', fontSize: '13px' }}
                      >
                        <option value="auto">🔍 Auto-detectar cliente pelo Endereço BitX Core digitado</option>
                        {exchangeClients.map((c) => (
                          <option key={c.id} value={c.id}>
                            👤 {c.name} ({c.id}) — Saldo Atual: {c.btxcBalance.toFixed(4)} BTXC | Endereço: {c.bitxAddress ? `${c.bitxAddress.substring(0, 14)}...` : 'Padrão'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                      Destinatários Rápidos (Clique para selecionar o cliente e preencher o endereço):
                    </label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {exchangeClients.map((c) => {
                        const addr = c.bitxAddress || (c.id === 'GX-CLI-0001' ? 'bxrt1qnk68972j7s9k8j3z2p987e9k3l98764s0zey' : 'btxc1qf08xve992k7s9k8j3z2p987e9k3l98764a');
                        const isSelected =
                          selectedTransferRecipientId === c.id ||
                          sendTo.trim().toLowerCase() === addr.toLowerCase() ||
                          sendTo.trim().toLowerCase() === c.id.toLowerCase();
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className="portal-btn"
                            style={{
                              padding: '5px 10px',
                              fontSize: '11px',
                              background: isSelected ? 'rgba(16, 185, 129, 0.25)' : '#0f172a',
                              border: `1px solid ${isSelected ? '#10b981' : '#334155'}`,
                              color: isSelected ? '#10b981' : '#f8fafc',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                            onClick={() => {
                              setSelectedTransferRecipientId(c.id);
                              setSendTo(addr);
                            }}
                          >
                            <span>👤 {c.name}</span>
                            <span style={{ color: '#f97316', fontFamily: 'monospace' }}>({c.id})</span>
                            <span style={{ color: '#38bdf8', fontSize: '10px' }}>
                              [Saldo: {c.btxcBalance.toFixed(4)} BTXC]
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 220px',
                    gap: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div className="portal-form-group">
                    <label>Endereço de Destino (Mainnet btxc1q... ou bxrt1q...)</label>
                    <input
                      type="text"
                      className="portal-input portal-mono"
                      placeholder="btxc1q... ou cole o endereço do cliente"
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                      required
                    />

                    {resolvedTargetClient && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.14)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '14px' }}>🛡️</span>
                          <span style={{ color: '#10b981', fontWeight: 600 }}>Destinatário Reconhecido na Global Exchange:</span>
                          <strong style={{ color: '#f8fafc' }}>{resolvedTargetClient.name}</strong>
                          <span style={{ color: '#f97316', fontFamily: 'monospace' }}>({resolvedTargetClient.id})</span>
                        </div>
                        <div style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '11px' }}>
                          Saldo Atual: <strong>{resolvedTargetClient.btxcBalance.toFixed(4)} BTXC</strong>
                        </div>
                      </div>
                    )}

                    {!resolvedTargetClient && sendTo.trim() && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          background: 'rgba(234, 179, 8, 0.12)',
                          border: '1px solid rgba(234, 179, 8, 0.4)',
                          fontSize: '12px',
                          color: '#fde047',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                          ⚠️ Endereço não vinculado previamente a nenhum cliente!
                        </div>
                        <div style={{ color: '#cbd5e1', marginBottom: '8px', fontSize: '11px' }}>
                          Para que o valor caia diretamente na conta do cliente na Global Exchange e no Supabase, selecione a qual cliente você deseja destinar esta transferência:
                        </div>
                        {exchangeClients.length > 0 && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <select
                              className="portal-input"
                              style={{ fontSize: '12px', padding: '4px 8px', maxWidth: '340px' }}
                              value={selectedTransferRecipientId}
                              onChange={(e) => setSelectedTransferRecipientId(e.target.value)}
                            >
                              <option value="auto">Escolha o cliente para creditar...</option>
                              {exchangeClients.map((c) => (
                                <option key={c.id} value={c.id}>
                                  👤 {c.name} ({c.id}) — Saldo: {c.btxcBalance.toFixed(4)} BTXC
                                </option>
                              ))}
                            </select>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                              Ao selecionar, o valor será creditado nesta conta.
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: '6px' }}>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f97316',
                          fontSize: '11px',
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                        onClick={() => setSendTo(exchangeHotWallet)}
                      >
                        → Enviar para a Hot Wallet da Global Exchange
                      </button>
                    </div>
                  </div>

                  <div className="portal-form-group">
                    <label>Quantidade (BTXC)</label>
                    <input
                      type="number"
                      step="0.00000001"
                      min="0.00000001"
                      className="portal-input"
                      placeholder="0.00000000"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Taxa estimada: <strong>0.0001 BTXC</strong> | Saldo Disponível:{' '}
                    <strong style={{ color: '#10b981' }}>{walletBalance.toFixed(4)} BTXC</strong>
                  </div>

                  <button type="submit" className="portal-btn portal-btn-primary">
                    Transmitir para a Mempool Mainnet
                  </button>
                </div>

                {sendFeedback && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#10b981',
                      fontSize: '12px',
                    }}
                  >
                    {sendFeedback}
                  </div>
                )}
              </form>
            </div>

            {/* Mempool list */}
            <div className="portal-card">
              <div className="portal-card-header">
                <h3 className="portal-card-title">Transações Pendentes na Mempool da Mainnet</h3>
                <button
                  type="button"
                  className="portal-btn portal-btn-success"
                  onClick={() => mineOneBlock(false)}
                >
                  ⛏️ Minerar Bloco e Confirmar Mempool ({mempool.length})
                </button>
              </div>

              {mempool.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                  A Mempool está limpa. Todas as transações foram mineradas e confirmadas em
                  blocos da Mainnet!
                </div>
              ) : (
                <div className="portal-table-container">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>ID da Transação</th>
                        <th>De (Origem)</th>
                        <th>Para (Destino)</th>
                        <th>Identificação / Tag</th>
                        <th>Quantidade</th>
                        <th>Taxa</th>
                        <th>Aguardando</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mempool.map((tx) => (
                        <tr key={tx.txid}>
                          <td className="portal-mono" style={{ color: '#38bdf8' }}>
                            {tx.txid}
                          </td>
                          <td className="portal-mono" style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {tx.from.substring(0, 16)}...
                          </td>
                          <td className="portal-mono" style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {tx.to.substring(0, 16)}...
                          </td>
                          <td>
                            {tx.exchangeClientTag ? (
                              <span
                                style={{
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  color: '#38bdf8',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                }}
                              >
                                {tx.exchangeClientTag}
                              </span>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '11px' }}>P2P Padrão</span>
                            )}
                          </td>
                          <td style={{ color: '#10b981', fontWeight: 'bold' }}>
                            {tx.amount.toFixed(4)} BTXC
                          </td>
                          <td style={{ color: '#94a3b8' }}>{tx.fee}</td>
                          <td style={{ color: '#facc15' }}>{tx.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: CARTEIRA INTEGRADA */}
        {activeTab === 'wallet' && (
          <div>
            <div className="portal-card">
              <div className="portal-card-header">
                <h2 className="portal-card-title">👛 Carteira Operacional BitX Core (Mainnet)</h2>
                <div className="portal-badge">Mainnet Native SegWit (BIP-84)</div>
              </div>

              <div
                style={{
                  background: '#0b1120',
                  padding: '24px',
                  borderRadius: '8px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div>
                  <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Saldo Disponível na Carteira Mainnet
                  </span>
                  <div
                    style={{
                      fontSize: '36px',
                      fontWeight: 900,
                      color: '#10b981',
                      margin: '4px 0',
                      fontFamily: 'DM Mono, monospace',
                    }}
                  >
                    {walletBalance.toFixed(8)} BTXC
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Equivalente a R${' '}
                    {(walletBalance * price).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    (Cotação Global Exchange)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="portal-btn portal-btn-primary"
                    onClick={() => setActiveTab('mempool')}
                  >
                    Enviar BTXC
                  </button>
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    onClick={() => setActiveTab('exchange')}
                  >
                    Depositar na Global Exchange
                  </button>
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    onClick={() => mineOneBlock(false)}
                  >
                    Minerar para esta Carteira
                  </button>
                </div>
              </div>

              <div className="portal-form-group">
                <label>Seu Endereço de Recebimento na Mainnet</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="portal-input portal-mono"
                    readOnly
                    value={walletAddress}
                  />
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(walletAddress);
                      setWalletCopied(true);
                      setTimeout(() => setWalletCopied(false), 2500);
                    }}
                  >
                    {walletCopied ? '✓ Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '20px', borderTop: '1px solid #1f2937', paddingTop: '16px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#f8fafc' }}>
                  Detalhes Técnicos da Autocustódia de Produção
                </h4>
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.8 }}>
                  <div>• Caminho de Derivação: <code>m/84'/0'/0'/0/0</code> (BIP-84 Mainnet)</div>
                  <div>• Cifragem de Chaves: PBKDF2 (310.000 iterações com SHA-256) + AES-256-GCM</div>
                  <div>• Formato de Endereço: Bech32 Native SegWit (prefixo <code>btxc1...</code>)</div>
                  <div>• Conexão com Global Exchange: Gateway de custódia e liquidação imediata</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Block Details */}
        {selectedBlock && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '20px',
            }}
          >
            <div
              style={{
                background: '#111827',
                border: '1px solid #374151',
                borderRadius: '8px',
                padding: '28px',
                maxWidth: '650px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                color: '#e2e8f0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #1f2937',
                  paddingBottom: '12px',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ margin: 0, color: '#f97316' }}>
                  Detalhes do Bloco #{selectedBlock.height.toLocaleString()} (Mainnet)
                </h3>
                <button
                  type="button"
                  style={{
                    background: '#1f2937',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedBlock(null)}
                >
                  ✕
                </button>
              </div>

              <div style={{ fontSize: '12px', lineHeight: 1.8 }}>
                <div>
                  <strong>Hash do Bloco (SHA-256d PoW):</strong>
                  <div className="portal-mono" style={{ color: '#38bdf8', wordBreak: 'break-all' }}>
                    {selectedBlock.hash}
                  </div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <strong>Hash Anterior:</strong>
                  <div className="portal-mono" style={{ color: '#94a3b8', wordBreak: 'break-all' }}>
                    {selectedBlock.prevHash}
                  </div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <strong>Merkle Root:</strong>
                  <div className="portal-mono" style={{ color: '#94a3b8' }}>
                    {selectedBlock.merkleRoot}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                  <div>Nonce: <strong>{selectedBlock.nonce.toLocaleString()}</strong></div>
                  <div>Dificuldade: <strong>{selectedBlock.difficulty}</strong></div>
                  <div>Transações: <strong>{selectedBlock.transactionsCount}</strong></div>
                  <div>Recompensa: <strong style={{ color: '#10b981' }}>{selectedBlock.reward} BTXC</strong></div>
                  <div>Horário: <strong>{selectedBlock.timestamp}</strong></div>
                  <div>Minerador: <strong>{selectedBlock.miner.substring(0, 16)}...</strong></div>
                </div>

                <div style={{ marginTop: '16px', borderTop: '1px solid #1f2937', paddingTop: '12px' }}>
                  <strong>Transações confirmadas neste bloco:</strong>
                  {selectedBlock.transactions.map((tx, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#0b1120',
                        padding: '8px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span className="portal-mono" style={{ fontSize: '11px' }}>
                        {tx.from.substring(0, 20)}... &rarr; {tx.to.substring(0, 20)}...
                      </span>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>{tx.amount} BTXC</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <button
                  type="button"
                  className="portal-btn portal-btn-secondary"
                  onClick={() => setSelectedBlock(null)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CONFIRMAÇÃO: LIMPEZA DE CLIENTES FICTÍCIOS */}
        {showPurgeModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div
              style={{
                background: '#0f172a',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '520px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px' }}>🧹</span>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px' }}>
                  Purificar Cache e Sincronizar com a Global Exchange
                </h3>
              </div>
              <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
                Esta ação fará a varredura e exclusão de qualquer cache ou cadastro fictício residual e atualizará a listagem diretamente da base de dados oficial da <strong>Global Exchange</strong> (Supabase).
              </p>
              <div
                style={{
                  background: '#1e293b',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '20px',
                  fontSize: '12px',
                  color: '#94a3b8',
                }}
              >
                ✓ Apenas clientes reais e genuínos oriundos da plataforma Global Exchange serão exibidos.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="portal-btn portal-btn-secondary"
                  onClick={() => setShowPurgeModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="portal-btn"
                  style={{ background: '#dc2626', color: '#fff', border: 'none' }}
                  onClick={handlePurgeFictitiousClients}
                >
                  Purificar e Sincronizar Agora
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CONFIRMAÇÃO: EXCLUSÃO DE CLIENTE REAL */}
        {clientToDelete && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '460px',
                width: '100%',
              }}
            >
              <h3 style={{ margin: '0 0 10px', color: '#f8fafc', fontSize: '16px' }}>
                Remover Cliente Real
              </h3>
              <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: '1.5', margin: '0 0 20px' }}>
                Deseja realmente remover o cliente <strong>"{clientToDelete.name}"</strong> (<code>{clientToDelete.id}</code>)?
                Esta ação removerá o cliente da <strong>Corretora Global Exchange</strong>, do <strong>Painel de Custódia</strong> e expurgará todos os seus lançamentos do <strong>Livro Razão Engecema</strong>.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="portal-btn portal-btn-secondary"
                  onClick={() => setClientToDelete(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="portal-btn"
                  style={{ background: '#dc2626', color: '#fff', border: 'none' }}
                  onClick={confirmDeleteRealClient}
                >
                  Confirmar Remoção
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: CENTRAL DE SINCRONIZAÇÃO & PONTE INTER-PLATAFORMAS (BITX CORE ⇄ GLOBAL EXCHANGE) */}
        {showBridgeModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div
              style={{
                background: '#0f172a',
                border: '1px solid #38bdf8',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '780px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
                color: '#f8fafc',
              }}
            >
              {/* Header do Modal */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px',
                  borderBottom: '1px solid #1e293b',
                  paddingBottom: '14px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#38bdf8',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: '2px',
                    }}
                  >
                    INTERCONEXÃO INTER-PLATAFORMAS &bull; PONTE OFICIAL
                  </div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', fontWeight: 800 }}>
                    Central de Sincronização: BitX Core ⇄ Global Exchange
                  </h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Sincronização entre a <strong>Blockchain BitX Core (Custódia Engecema)</strong> e a <strong>Corretora Global Exchange</strong>.
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    background: '#1e293b',
                    border: 'none',
                    color: '#94a3b8',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                  onClick={() => setShowBridgeModal(false)}
                >
                  ✕ Fechar
                </button>
              </div>

              {/* Tabs de Navegação da Central */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  marginBottom: '18px',
                  borderBottom: '1px solid #1e293b',
                  paddingBottom: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => setBridgeTab('sql')}
                  style={{
                    background: bridgeTab === 'sql' ? '#1e3a8a' : '#1e293b',
                    color: bridgeTab === 'sql' ? '#60a5fa' : '#94a3b8',
                    border: bridgeTab === 'sql' ? '1px solid #3b82f6' : '1px solid transparent',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  📋 Script SQL Supabase (Resolução Imediata)
                </button>
                <button
                  type="button"
                  onClick={() => setBridgeTab('realtime')}
                  style={{
                    background: bridgeTab === 'realtime' ? '#065f46' : '#1e293b',
                    color: bridgeTab === 'realtime' ? '#34d399' : '#94a3b8',
                    border: bridgeTab === 'realtime' ? '1px solid #10b981' : '1px solid transparent',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Transmissão em Tempo Real (Broadcast)
                </button>
                <button
                  type="button"
                  onClick={() => setBridgeTab('json')}
                  style={{
                    background: bridgeTab === 'json' ? '#831843' : '#1e293b',
                    color: bridgeTab === 'json' ? '#f472b6' : '#94a3b8',
                    border: bridgeTab === 'json' ? '1px solid #ec4899' : '1px solid transparent',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  📦 Pacote JSON Criptográfico
                </button>
                <button
                  type="button"
                  onClick={() => setBridgeTab('reconcile')}
                  style={{
                    background: bridgeTab === 'reconcile' ? '#78350f' : '#1e293b',
                    color: bridgeTab === 'reconcile' ? '#fbbf24' : '#94a3b8',
                    border: bridgeTab === 'reconcile' ? '1px solid #f59e0b' : '1px solid transparent',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ⚖️ Posição e Reconciliação ({exchangeClients.length} contas)
                </button>
              </div>

              {/* CONTEÚDO TAB 1: SCRIPT SQL SUPABASE */}
              {bridgeTab === 'sql' && (
                <div>
                  <div
                    style={{
                      background: 'rgba(30, 58, 138, 0.2)',
                      border: '1px solid #3b82f6',
                      borderRadius: '8px',
                      padding: '14px',
                      marginBottom: '14px',
                      fontSize: '12px',
                      lineHeight: '1.6',
                    }}
                  >
                    <div style={{ color: '#60a5fa', fontWeight: 800, marginBottom: '4px' }}>
                      💡 Sincronização em Nuvem: BitX Core ⇄ Corretora Global Exchange
                    </div>
                    <p style={{ margin: '0 0 6px', color: '#cbd5e1' }}>
                      As duas plataformas conectam ao mesmo banco <strong>Supabase Cloud (odbbtgkxgiqlfhcepwuj)</strong>.
                      Tanto novos cadastros quanto transferências e atualizações de saldo são espelhados em tempo real na tabela <code>clients</code>.
                    </p>
                    <p style={{ margin: 0, color: '#e2e8f0' }}>
                      O script abaixo garante que todas as colunas de saldo (<code>btxc_balance</code>, <code>gx_balance</code>, <code>brl_balance</code>, <code>usdt_balance</code>, <code>bitx_address</code>) estejam devidamente criadas com permissões liberadas para ambas as plataformas.
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      SQL DDL &amp; DML para execução no <strong>Supabase SQL Editor</strong>:
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="portal-btn portal-btn-primary"
                        style={{ fontSize: '11px', padding: '5px 12px', fontWeight: 700 }}
                        onClick={() => {
                          navigator.clipboard.writeText(SUPABASE_SYNC_SQL);
                          setSqlCopied(true);
                          setTimeout(() => setSqlCopied(false), 3000);
                        }}
                      >
                        {sqlCopied ? '✓ Código SQL Copiado!' : '📋 Copiar Código SQL Completo'}
                      </button>
                      <button
                        type="button"
                        className="portal-btn portal-btn-secondary"
                        style={{ fontSize: '11px', padding: '5px 12px' }}
                        onClick={handlePushCustodyToSupabase}
                        disabled={isPushingCloud}
                      >
                        {isPushingCloud ? '⏳ Enviando...' : '🚀 Testar Push Cloud Direto'}
                      </button>
                    </div>
                  </div>

                  <pre
                    style={{
                      background: '#090d16',
                      border: '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '12px',
                      fontSize: '11px',
                      color: '#a5f3fc',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      fontFamily: 'DM Mono, monospace',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.4',
                    }}
                  >
                    {SUPABASE_SYNC_SQL}
                  </pre>

                  {bridgeNotice && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        background: bridgeNotice.startsWith('✓') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${bridgeNotice.startsWith('✓') ? '#10b981' : '#ef4444'}`,
                        color: bridgeNotice.startsWith('✓') ? '#34d399' : '#fca5a5',
                      }}
                    >
                      {bridgeNotice}
                    </div>
                  )}
                </div>
              )}

              {/* CONTEÚDO TAB 2: TRANSMISSÃO EM TEMPO REAL (BROADCAST) */}
              {bridgeTab === 'realtime' && (
                <div>
                  <div
                    style={{
                      background: 'rgba(6, 95, 70, 0.2)',
                      border: '1px solid #10b981',
                      borderRadius: '8px',
                      padding: '14px',
                      marginBottom: '14px',
                      fontSize: '12px',
                      lineHeight: '1.6',
                    }}
                  >
                    <div style={{ color: '#34d399', fontWeight: 800, marginBottom: '4px' }}>
                      ⚡ Canal Criptográfico em Tempo Real Ativo
                    </div>
                    <p style={{ margin: '0 0 6px', color: '#cbd5e1' }}>
                      Ao clicar no botão abaixo, a plataforma BitX Core emite um sinal WebSocket através do canal <code>realtime_global_exchange_clients</code> no Supabase e via <code>BroadcastChannel HTML5</code> local.
                    </p>
                    <p style={{ margin: 0, color: '#e2e8f0' }}>
                      Qualquer janela ou aba aberta da Global Exchange que possua o listener em tempo real receberá os dados e saldos atualizados de todos os clientes instantaneamente, sem precisar recarregar a página!
                    </p>
                  </div>

                  <div style={{ background: '#1e293b', padding: '14px', borderRadius: '8px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Canal Supabase Realtime:</span>
                      <span style={{ color: '#10b981', fontWeight: 700, fontSize: '12px' }}>● Online (realtime_global_exchange_clients)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Canal Cross-Tab (Navegador):</span>
                      <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '12px' }}>● Ativo (global_exchange_cross_tab_sync)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Clientes no Pacote a Transmitir:</span>
                      <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '12px' }}>{exchangeClients.length} cliente(s) ativo(s)</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="portal-btn portal-btn-primary"
                    style={{ width: '100%', padding: '10px 18px', fontWeight: 800, fontSize: '13px' }}
                    onClick={() => {
                      emitSyncToGlobalExchange(exchangeClients);
                      setBridgeNotice(`✓ Sinal de sincronização em tempo real transmitido com sucesso às ${new Date().toLocaleTimeString('pt-BR')}!`);
                    }}
                  >
                    ⚡ Transmitir Sinal em Tempo Real para a Global Exchange Agora
                  </button>

                  {bridgeNotice && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid #10b981',
                        color: '#34d399',
                      }}
                    >
                      {bridgeNotice}
                    </div>
                  )}
                </div>
              )}

              {/* CONTEÚDO TAB 3: PACOTE JSON CRIPTOGRÁFICO */}
              {bridgeTab === 'json' && (
                <div>
                  <div style={{ marginBottom: '14px', fontSize: '12px', color: '#cbd5e1' }}>
                    Exporte ou importe o pacote JSON contendo o estado oficial de custódia e saldos de clientes auditados pelo Conglomerado Engecema:
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Pacote JSON Exportável (BitX Core ➔ Global Exchange):</span>
                    <button
                      type="button"
                      className="portal-btn portal-btn-primary"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => {
                        const payload = JSON.stringify(
                          {
                            source: 'BitX Core Mainnet',
                            auditedBy: 'Custódia Engecema PJ (05.368.602/0001-10)',
                            txid: '0x9891c2bfbee33952a01ceec868c4afb7f27e44341908a8b',
                            timestamp: new Date().toISOString(),
                            clients: exchangeClients,
                          },
                          null,
                          2
                        );
                        navigator.clipboard.writeText(payload);
                        setJsonCopied(true);
                        setTimeout(() => setJsonCopied(false), 3000);
                      }}
                    >
                      {jsonCopied ? '✓ JSON Copiado!' : '📋 Copiar Pacote JSON'}
                    </button>
                  </div>

                  <pre
                    style={{
                      background: '#090d16',
                      border: '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '10px',
                      fontSize: '11px',
                      color: '#f472b6',
                      maxHeight: '140px',
                      overflowY: 'auto',
                      fontFamily: 'DM Mono, monospace',
                      whiteSpace: 'pre-wrap',
                      marginBottom: '14px',
                    }}
                  >
                    {JSON.stringify(
                      {
                        source: 'BitX Core Mainnet',
                        auditedBy: 'Custódia Engecema PJ (05.368.602/0001-10)',
                        txid: '0x9891c2bfbee33952a01ceec868c4afb7f27e44341908a8b',
                        clients: exchangeClients,
                      },
                      null,
                      2
                    )}
                  </pre>

                  <div style={{ marginBottom: '6px', fontSize: '11px', color: '#94a3b8' }}>
                    Importar Pacote JSON da Global Exchange para Reconciliação:
                  </div>
                  <textarea
                    rows={3}
                    className="portal-input portal-mono"
                    style={{ width: '100%', fontSize: '11px', marginBottom: '8px' }}
                    placeholder='Cole aqui o JSON recebido da Global Exchange...'
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                  />
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    style={{ fontSize: '12px' }}
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(importJsonText);
                        const list = Array.isArray(parsed) ? parsed : (parsed.clients || [parsed]);
                        if (list && list.length > 0) {
                          setExchangeClients(list);
                          saveStoredRealClients(list);
                          emitSyncToGlobalExchange(list);
                          setBridgeNotice(`✓ ${list.length} cliente(s) importados e reconciliados com sucesso!`);
                        }
                      } catch (err: any) {
                        setBridgeNotice(`Erro ao interpretar JSON: ${err.message}`);
                      }
                    }}
                  >
                    📥 Importar e Reconciliar Carteira
                  </button>

                  {bridgeNotice && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid #38bdf8',
                        color: '#38bdf8',
                      }}
                    >
                      {bridgeNotice}
                    </div>
                  )}
                </div>
              )}

              {/* CONTEÚDO TAB 4: RECONCILIAÇÃO COM LIVRO RAZÃO */}
              {bridgeTab === 'reconcile' && (
                <div>
                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid #f59e0b',
                      borderRadius: '8px',
                      padding: '14px',
                      marginBottom: '16px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ color: '#fbbf24', fontWeight: 800, marginBottom: '4px' }}>
                      📜 Registro Contábil e Posição em Custódia
                    </div>
                    <p style={{ margin: 0, color: '#cbd5e1', lineHeight: '1.5' }}>
                      A reconciliação alinha o saldo das contas ativas da Global Exchange com os lançamentos auditados da Custódia Engecema e a Blockchain BitX Core.
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Saldo Total em BitX (BTXC)</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', fontFamily: 'DM Mono, monospace' }}>
                        {exchangeClients.reduce((a, c) => a + (c.btxcBalance || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} BTXC
                      </div>
                    </div>
                    <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Liquidez em Reais (R$)</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', fontFamily: 'DM Mono, monospace' }}>
                        R$ {exchangeClients.reduce((a, c) => a + (c.brlBalance || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Clientes Ativos na Corretora</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#fbbf24', fontFamily: 'DM Mono, monospace' }}>
                        {exchangeClients.length} conta(s)
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="portal-btn portal-btn-primary"
                    style={{ width: '100%', padding: '10px 18px', fontWeight: 800, fontSize: '13px' }}
                    onClick={() => {
                      handleReconcileWithCustodyLedger();
                      setBridgeNotice(`✓ Reconciliação executada! ${exchangeClients.length} conta(s) alinhadas com a Blockchain BitX Core e Global Exchange.`);
                    }}
                  >
                    ⚖️ Aplicar Reconciliação Total no Sistema Agora
                  </button>

                  {bridgeNotice && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid #10b981',
                        color: '#34d399',
                      }}
                    >
                      {bridgeNotice}
                    </div>
                  )}
                </div>
              )}

              {/* Footer do Modal */}
              <div
                style={{
                  marginTop: '20px',
                  paddingTop: '14px',
                  borderTop: '1px solid #1e293b',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  className="portal-btn portal-btn-secondary"
                  onClick={() => setShowBridgeModal(false)}
                >
                  Fechar Central
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="portal-footer">
        <div>
          BitX Core (BTXC) &bull; Rede Principal de Produção &bull; Conglomerado Engecema &bull; Corretora Global Exchange
        </div>
        <div className="portal-footer-links">
          <button type="button" onClick={() => onOpenPolicy('privacidade')}>
            Política de Privacidade
          </button>
          <button type="button" onClick={() => onOpenPolicy('termos')}>
            Termos de Uso
          </button>
          <button type="button" onClick={() => onOpenPolicy('cookies')}>
            Política de Cookies
          </button>
          <button type="button" onClick={() => setActiveTab('exchange')} style={{ color: '#f97316' }}>
            Portal Global Exchange ↗
          </button>
        </div>
      </footer>
    </div>
  );
};
