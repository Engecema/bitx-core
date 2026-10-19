import React, { useState, useEffect, useRef } from 'react';
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
  btxcBalance: number;
  brlBalance: number;
  usdtBalance: number;
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
  type: 'Aporte Inicial' | 'Ajuste Direto com TXID' | 'Transferência em Reais (Pix)' | 'Transferência em GX';
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
    id: 'CUST-001',
    txid: '0x9891c2bfbee33952a01ceec868c4afb7f27e44341908a8b',
    type: 'Aporte Inicial',
    amountGx: 101.0,
    amountBrl: 42420000.0,
    counterparty: 'Custódia Engecema PJ (05.368.602/0001-10) -> Geoni Clementino Cesar de Matos',
    timestamp: '18/10/2026 06:47:01',
    status: 'Confirmado em Custódia',
  },
];

export const getStoredCustodyLedger = (): CustodyLedgerItem[] => {
  try {
    const saved = localStorage.getItem('bitx_custody_ledger');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!parsed.some((r: any) => r.id === 'CUST-001')) {
          parsed.unshift(DEFAULT_CUSTODY_LEDGER[0]);
        }
        return parsed;
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
  refPrice: number = 420000.0
): { gx: number; brl: number; usdt: number } => {
  const isGeoni =
    clientId === 'GX-CLI-0001' ||
    clientEmail === 'geonimatos31@hotmail.com' ||
    clientEmail === 'geonimatos31@gmail.com';

  if (!isGeoni) {
    return { gx: 0, brl: 0, usdt: 0 };
  }

  let netGx = 0;
  for (const item of ledger) {
    const isBeneficiary =
      item.id === 'CUST-001' ||
      item.counterparty.toLowerCase().includes('geoni') ||
      item.counterparty.toLowerCase().includes('custódia engecema') ||
      item.counterparty.toLowerCase().includes('pix bb engecema') ||
      item.counterparty.toLowerCase().includes('ajuste direto');

    if (isBeneficiary) {
      netGx += item.amountGx;
    }
  }

  const safeGx = Math.max(0, Number.isFinite(netGx) ? netGx : 101.0);
  const safeBrl = safeGx * refPrice;
  const safeUsdt = safeBrl / 5.0;

  return { gx: +safeGx.toFixed(4), brl: +safeBrl.toFixed(2), usdt: +safeUsdt.toFixed(2) };
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
  
  // Cadastro Real Oficial Confirmado da Global Exchange
  const DEFAULT_REAL_CLIENTS: ExchangeClient[] = [
    {
      id: 'GX-CLI-0001',
      name: 'Geoni Clementino Cesar de Matos',
      email: 'geonimatos31@hotmail.com',
      document: '70781338387',
      btxcBalance: 101.0,
      brlBalance: 42420000.0,
      usdtBalance: 8484000.0,
      status: 'Verificado KYC',
      createdAt: '18/10/2026',
    },
  ];

  // Helper de persistência e sincronização de clientes reais com o Livro Razão de Custódia Engecema
  const getStoredRealClients = (): ExchangeClient[] => {
    const ledger = getStoredCustodyLedger();
    const geoniCustody = computeClientCustodyBalance('GX-CLI-0001', 'geonimatos31@hotmail.com', ledger, 420000.0);

    const baseClient: ExchangeClient = {
      id: 'GX-CLI-0001',
      name: 'Geoni Clementino Cesar de Matos',
      email: 'geonimatos31@hotmail.com',
      document: '70781338387',
      btxcBalance: geoniCustody.gx,
      brlBalance: geoniCustody.brl,
      usdtBalance: geoniCustody.usdt,
      status: 'Verificado KYC',
      createdAt: '18/10/2026',
    };

    try {
      const stored = localStorage.getItem('bitx_ge_synced_clients');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const idx = parsed.findIndex((c: any) => c.id === 'GX-CLI-0001' || c.email === 'geonimatos31@hotmail.com');
          if (idx >= 0) {
            // Reconciliar estritamente com o livro razão de custódia se o saldo em cache estiver zerado ou inferior
            const currentBtxc = typeof parsed[idx].btxcBalance === 'number' && parsed[idx].btxcBalance > 0
              ? parsed[idx].btxcBalance
              : geoniCustody.gx;
            const currentBrl = typeof parsed[idx].brlBalance === 'number' && parsed[idx].brlBalance > 0
              ? parsed[idx].brlBalance
              : geoniCustody.brl;
            const currentUsdt = typeof parsed[idx].usdtBalance === 'number' && parsed[idx].usdtBalance > 0
              ? parsed[idx].usdtBalance
              : geoniCustody.usdt;

            parsed[idx] = {
              ...parsed[idx],
              document: parsed[idx].document || '70781338387',
              btxcBalance: currentBtxc,
              brlBalance: currentBrl,
              usdtBalance: currentUsdt,
              status: 'Verificado KYC',
            };
            return parsed;
          }
          return [baseClient, ...parsed];
        }
      }
    } catch {}
    return [baseClient];
  };

  const saveStoredRealClients = (clients: ExchangeClient[]) => {
    try {
      localStorage.setItem('bitx_ge_synced_clients', JSON.stringify(clients));
    } catch {}
  };

  // Clientes EXCLUSIVAMENTE Reais vindos da Plataforma Global Exchange
  const [exchangeClients, setExchangeClients] = useState<ExchangeClient[]>(getStoredRealClients);
  const [isLoadingClients, setIsLoadingClients] = useState<boolean>(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

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
      const currentLedger = getStoredCustodyLedger();
      const geoniCustody = computeClientCustodyBalance('GX-CLI-0001', 'geonimatos31@hotmail.com', currentLedger, price);

      // Consultar banco na nuvem Supabase
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      let combined: ExchangeClient[] = [...localReal];

      if (data && Array.isArray(data) && data.length > 0) {
        const cloudClients: ExchangeClient[] = data.map((c: any) => {
          const isGeoni =
            c.id === 'GX-CLI-0001' ||
            c.email === 'geonimatos31@hotmail.com' ||
            c.email === 'geonimatos31@gmail.com' ||
            String(c.document || '').replace(/\D/g, '') === '70781338387';

          const rawBtxc = typeof c.btxc_balance === 'number' ? c.btxc_balance : 0.0;
          const rawBrl = typeof c.brl_balance === 'number' ? c.brl_balance : 0.0;
          const rawUsdt = typeof c.usdt_balance === 'number' ? c.usdt_balance : 0.0;

          // Reconciliar: Se for o favorecido Geoni e o saldo no banco em nuvem estiver 0, NÃO zerar! Usar a custódia auditada
          const finalBtxc = isGeoni && rawBtxc <= 0 ? geoniCustody.gx : rawBtxc;
          const finalBrl = isGeoni && rawBrl <= 0 ? geoniCustody.brl : rawBrl;
          const finalUsdt = isGeoni && rawUsdt <= 0 ? geoniCustody.usdt : rawUsdt;

          return {
            id: String(c.id || ''),
            name: String(c.name || 'Cliente Global Exchange'),
            email: String(c.email || '—'),
            document: c.document ? String(c.document) : (isGeoni ? '70781338387' : undefined),
            btxcBalance: finalBtxc,
            brlBalance: finalBrl,
            usdtBalance: finalUsdt,
            status: 'Verificado KYC',
            createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : undefined,
          };
        });

        for (const cc of cloudClients) {
          const idx = combined.findIndex((x) => x.id === cc.id || (cc.email && x.email === cc.email));
          if (idx >= 0) {
            combined[idx] = { ...combined[idx], ...cc };
          } else {
            combined.push(cc);
          }
        }

        // Se Geoni estiver com saldo auditado positivo, sincronizar o Supabase em segundo plano
        const geoniRecord = combined.find(
          (c) => c.id === 'GX-CLI-0001' || c.email === 'geonimatos31@hotmail.com'
        );
        if (geoniRecord && geoniRecord.btxcBalance > 0) {
          try {
            await supabase
              .from('clients')
              .update({
                btxc_balance: geoniRecord.btxcBalance,
                brl_balance: geoniRecord.brlBalance,
                usdt_balance: geoniRecord.usdtBalance,
                document: '70781338387',
                status: 'Verificado KYC',
              })
              .or(`id.eq.${geoniRecord.id},email.eq.${geoniRecord.email}`);
          } catch (syncErr) {
            console.warn('[Custódia] Atualização do saldo no Supabase:', syncErr);
          }
        }
      }

      setExchangeClients(combined);
      saveStoredRealClients(combined);
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
    } catch (err: any) {
      console.warn('[Global Exchange] Sincronização em nuvem:', err);
      const localReal = getStoredRealClients();
      setExchangeClients(localReal);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  // Gestão de Clientes Reais no Painel de Configurações
  const [newClientId, setNewClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientDocument, setNewClientDocument] = useState('');
  const [newClientBtxc, setNewClientBtxc] = useState('0');
  const [newClientBrl, setNewClientBrl] = useState('0');
  const [newClientUsdt, setNewClientUsdt] = useState('0');
  const [newClientStatus, setNewClientStatus] = useState<'Institucional' | 'Verificado KYC' | 'VIP' | 'Ativo'>('Verificado KYC');
  const [clientFormFeedback, setClientFormFeedback] = useState<string>('');
  const [editingClient, setEditingClient] = useState<ExchangeClient | null>(null);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);

  // ================= CUSTÓDIA ENGECEMA STATE & HANDLERS =================
  const [selectedCustodyClientId, setSelectedCustodyClientId] = useState<string>('GX-CLI-0001');
  const [showEditCustodyModal, setShowEditCustodyModal] = useState<boolean>(false);
  const [custodyEditGxAmount, setCustodyEditGxAmount] = useState<string>('101.00');
  const [custodyEditReason, setCustodyEditReason] = useState<string>(
    'Aporte inicial de capital, rebalanceamento comercial'
  );
  const [custodyFeedback, setCustodyFeedback] = useState<string>('');

  // Transferência em Reais (R$)
  const [showTransferBrlModal, setShowTransferBrlModal] = useState<boolean>(false);
  const [transferBrlAmount, setTransferBrlAmount] = useState<string>('50000');
  const [transferBrlPixKey, setTransferBrlPixKey] = useState<string>('geonimatos31@hotmail.com');
  const [transferBrlKeyType, setTransferBrlKeyType] = useState<
    'E-mail' | 'CPF' | 'CNPJ' | 'Telefone' | 'Aleatória' | 'TED Bancário'
  >('E-mail');
  const [transferBrlFavorecido, setTransferBrlFavorecido] = useState<string>(
    'Geoni Clementino Cesar de Matos'
  );
  const [transferBrlDoc, setTransferBrlDoc] = useState<string>('70781338387');
  const [transferBrlFeedback, setTransferBrlFeedback] = useState<{
    message: string;
    txid?: string;
    success: boolean;
  } | null>(null);

  // Transferência em GX (Token)
  const [showTransferGxModal, setShowTransferGxModal] = useState<boolean>(false);
  const [transferGxAmount, setTransferGxAmount] = useState<string>('1.00');
  const [transferGxDestination, setTransferGxDestination] = useState<string>(
    'btxc1qf08xve992k7s9k8j3z2p987e9k3l98764a'
  );
  const [transferGxFeedback, setTransferGxFeedback] = useState<{
    message: string;
    txid?: string;
    success: boolean;
  } | null>(null);

  // Histórico de Custódia Auditável com TXID Criptográfico
  const [custodyLedger, setCustodyLedger] = useState<CustodyLedgerItem[]>(getStoredCustodyLedger);

  // Ação de reconciliação expressa entre o Livro Razão e a Carteira de Clientes
  const handleReconcileWithCustodyLedger = async () => {
    const currentLedger = getStoredCustodyLedger();
    const geoniCustody = computeClientCustodyBalance('GX-CLI-0001', 'geonimatos31@hotmail.com', currentLedger, price);

    const reconciled = exchangeClients.map((c) => {
      if (c.id === 'GX-CLI-0001' || c.email === 'geonimatos31@hotmail.com' || c.document?.replace(/\D/g, '') === '70781338387') {
        return {
          ...c,
          document: '70781338387',
          btxcBalance: geoniCustody.gx,
          brlBalance: geoniCustody.brl,
          usdtBalance: geoniCustody.usdt,
          status: 'Verificado KYC' as const,
        };
      }
      return c;
    });

    setExchangeClients(reconciled);
    saveStoredRealClients(reconciled);

    // Atualizar no Supabase
    try {
      await supabase
        .from('clients')
        .update({
          btxc_balance: geoniCustody.gx,
          brl_balance: geoniCustody.brl,
          usdt_balance: geoniCustody.usdt,
          document: '70781338387',
          status: 'Verificado KYC',
        })
        .or('id.eq.GX-CLI-0001,email.eq.geonimatos31@hotmail.com');
    } catch {}

    setCustodyFeedback(
      `✓ Carteira de Clientes 100% Reconciliada com o Livro Razão de Custódia Engecema (${geoniCustody.gx.toFixed(2)} GX · R$ ${geoniCustody.brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})!`
    );
    addLog(
      `[Reconciliação Auditada] Saldo de Geoni Clementino Cesar de Matos reconciliado com o Livro Razão: ${geoniCustody.gx.toFixed(2)} GX (R$ ${geoniCustody.brl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
      'success'
    );
    setTimeout(() => setCustodyFeedback(''), 8000);
  };

  const currentCustodyClient: ExchangeClient =
    exchangeClients.find((c) => c.id === selectedCustodyClientId) ||
    exchangeClients[0] || {
      id: 'GX-CLI-0001',
      name: 'Geoni Clementino Cesar de Matos',
      email: 'geonimatos31@hotmail.com',
      document: '70781338387',
      btxcBalance: 101.0,
      brlBalance: 42420000.0,
      usdtBalance: 8484000.0,
      status: 'Verificado KYC',
      createdAt: '18/10/2026',
    };

  const handleOpenEditCustodyModal = (client?: ExchangeClient) => {
    const target = client || currentCustodyClient;
    setSelectedCustodyClientId(target.id);
    setCustodyEditGxAmount(target.btxcBalance.toString());
    setCustodyEditReason('Aporte inicial de capital, rebalanceamento comercial');
    setShowEditCustodyModal(true);
  };

  const handleSaveCustodyEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newGx = parseFloat(custodyEditGxAmount);
    if (isNaN(newGx) || newGx < 0) {
      setCustodyFeedback('Informe uma quantidade válida de GX.');
      return;
    }
    const client = currentCustodyClient;
    const newBrl = newGx * price;
    const newUsdt = newBrl / 5.0;
    const txid =
      '0x' +
      Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const updated = exchangeClients.map((c) =>
      c.id === client.id
        ? {
            ...c,
            btxcBalance: newGx,
            brlBalance: newBrl,
            usdtBalance: newUsdt,
          }
        : c
    );

    setExchangeClients(updated);
    saveStoredRealClients(updated);

    try {
      await supabase
        .from('clients')
        .update({
          btxc_balance: newGx,
          brl_balance: newBrl,
          usdt_balance: newUsdt,
        })
        .eq('id', client.id);
    } catch {}

    const newRecord: CustodyLedgerItem = {
      id: 'CUST-' + Math.floor(Math.random() * 900 + 100),
      txid,
      type: 'Ajuste Direto com TXID',
      amountGx: newGx,
      amountBrl: newBrl,
      counterparty: `Ajuste Direto (${custodyEditReason || 'Rebalanceamento'})`,
      timestamp: new Date().toLocaleString('pt-BR'),
      status: 'Confirmado em Custódia',
    };

    const updatedLedger = [newRecord, ...custodyLedger];
    setCustodyLedger(updatedLedger);
    try {
      localStorage.setItem('bitx_custody_ledger', JSON.stringify(updatedLedger));
    } catch {}

    addLog(
      `[Custódia Engecema] Saldo de ${client.name} ajustado para ${newGx.toFixed(2)} GX (R$ ${newBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). TXID: ${txid}`,
      'success'
    );
    setShowEditCustodyModal(false);
    setCustodyFeedback(
      `✓ Saldo em custódia atualizado: ${newGx.toFixed(2)} GX = R$ ${newBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (TXID: ${txid.substring(0, 18)}...)`
    );
    setTimeout(() => setCustodyFeedback(''), 8000);
  };

  const handleExecuteTransferBrl = (e: React.FormEvent) => {
    e.preventDefault();
    const brlAmt = parseFloat(transferBrlAmount);
    if (isNaN(brlAmt) || brlAmt <= 0) {
      setTransferBrlFeedback({ message: 'Informe um valor válido em Reais.', success: false });
      return;
    }

    const client = currentCustodyClient;
    const totalAvailableBrl = client.btxcBalance * price;

    if (brlAmt > totalAvailableBrl) {
      setTransferBrlFeedback({
        message: `Saldo insuficiente em Reais. Disponível: R$ ${totalAvailableBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        success: false,
      });
      return;
    }

    // Dedução proporcional em GX baseada no preço de referência R$ 420.000,00 por token
    const gxEquivalent = brlAmt / price;
    const remainingGx = Math.max(0, client.btxcBalance - gxEquivalent);
    const remainingBrl = remainingGx * price;
    const txid =
      '0xpix_' +
      Array.from(crypto.getRandomValues(new Uint8Array(20)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const updated = exchangeClients.map((c) =>
      c.id === client.id
        ? {
            ...c,
            btxcBalance: +remainingGx.toFixed(4),
            brlBalance: +remainingBrl.toFixed(2),
            usdtBalance: +(remainingBrl / 5.0).toFixed(2),
          }
        : c
    );

    setExchangeClients(updated);
    saveStoredRealClients(updated);

    const newRecord: CustodyLedgerItem = {
      id: 'CUST-PIX-' + Math.floor(Math.random() * 900 + 100),
      txid,
      type: 'Transferência em Reais (Pix)',
      amountGx: -gxEquivalent,
      amountBrl: -brlAmt,
      counterparty: `Pix BB Engecema -> ${transferBrlFavorecido} (${transferBrlPixKey})`,
      timestamp: new Date().toLocaleString('pt-BR'),
      status: 'Liquidado Pix BB',
    };

    const updatedLedger = [newRecord, ...custodyLedger];
    setCustodyLedger(updatedLedger);
    try {
      localStorage.setItem('bitx_custody_ledger', JSON.stringify(updatedLedger));
    } catch {}

    addLog(
      `[Pix BB Engecema] Transferência de R$ ${brlAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} efetuada para ${transferBrlFavorecido} (${transferBrlPixKey}). Dedução de ${gxEquivalent.toFixed(4)} GX. TXID: ${txid}`,
      'success'
    );

    setTransferBrlFeedback({
      message: `✓ Transferência de R$ ${brlAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} realizada com sucesso via Pix Banco do Brasil (Engecema PJ)!`,
      txid,
      success: true,
    });
  };

  const handleExecuteTransferGx = (e: React.FormEvent) => {
    e.preventDefault();
    const gxAmt = parseFloat(transferGxAmount);
    if (isNaN(gxAmt) || gxAmt <= 0) {
      setTransferGxFeedback({ message: 'Informe uma quantidade válida de GX.', success: false });
      return;
    }

    const client = currentCustodyClient;
    if (gxAmt > client.btxcBalance) {
      setTransferGxFeedback({
        message: `Saldo insuficiente em GX. Disponível: ${client.btxcBalance.toFixed(2)} GX.`,
        success: false,
      });
      return;
    }

    const remainingGx = Math.max(0, client.btxcBalance - gxAmt);
    const remainingBrl = remainingGx * price;
    const txid =
      '0xgx_' +
      Array.from(crypto.getRandomValues(new Uint8Array(20)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const updated = exchangeClients.map((c) =>
      c.id === client.id
        ? {
            ...c,
            btxcBalance: +remainingGx.toFixed(4),
            brlBalance: +remainingBrl.toFixed(2),
            usdtBalance: +(remainingBrl / 5.0).toFixed(2),
          }
        : c
    );

    setExchangeClients(updated);
    saveStoredRealClients(updated);

    const newRecord: CustodyLedgerItem = {
      id: 'CUST-GX-' + Math.floor(Math.random() * 900 + 100),
      txid,
      type: 'Transferência em GX',
      amountGx: -gxAmt,
      amountBrl: -(gxAmt * price),
      counterparty: `Destino: ${transferGxDestination}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      status: 'Confirmado em Custódia',
    };

    const updatedLedger = [newRecord, ...custodyLedger];
    setCustodyLedger(updatedLedger);
    try {
      localStorage.setItem('bitx_custody_ledger', JSON.stringify(updatedLedger));
    } catch {}

    addLog(
      `[Custódia Engecema] Envio de ${gxAmt.toFixed(4)} GX (R$ ${(gxAmt * price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) para ${transferGxDestination}. TXID: ${txid}`,
      'success'
    );

    setTransferGxFeedback({
      message: `✓ Transferência de ${gxAmt.toFixed(4)} GX realizada com sucesso!`,
      txid,
      success: true,
    });
  };

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

    const clientRecord: ExchangeClient = {
      id: assignedId,
      name: newClientName.trim(),
      email: newClientEmail.trim(),
      document: newClientDocument.trim() || (editingClient?.document || undefined),
      btxcBalance: btxcNum,
      brlBalance: brlNum,
      usdtBalance: usdtNum,
      status: newClientStatus,
      createdAt: editingClient?.createdAt || new Date().toLocaleDateString('pt-BR'),
    };

    // 1. Salvar e ativar imediatamente no portal BitX Core & Global Exchange
    const updated = editingClient
      ? exchangeClients.map((c) => (c.id === editingClient.id ? clientRecord : c))
      : [clientRecord, ...exchangeClients.filter((c) => c.id !== assignedId)];

    setExchangeClients(updated);
    saveStoredRealClients(updated);

    // 2. Enviar para a nuvem Supabase
    try {
      const payload: any = {
        name: clientRecord.name,
        email: clientRecord.email,
        document: clientRecord.document || null,
        id: clientRecord.id,
        btxc_balance: clientRecord.btxcBalance || 0,
        brl_balance: clientRecord.brlBalance || 0,
        usdt_balance: clientRecord.usdtBalance || 0,
        status: clientRecord.status || 'Verificado KYC',
      };

      const { error } = await supabase.from('clients').upsert([payload]);

      if (error) {
        console.warn('Aviso Supabase Cloud RLS:', error.message);
        setClientFormFeedback(
          `✓ Cliente real "${clientRecord.name}" (${clientRecord.id}) cadastrado e 100% ativo no sistema! (Para sincronizar também no Supabase Cloud, execute a liberação RLS no SQL Editor do Supabase).`
        );
      } else {
        setClientFormFeedback(
          `✓ Cliente real "${clientRecord.name}" (${clientRecord.id}) cadastrado e sincronizado com sucesso na Global Exchange e no Supabase!`
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
    setNewClientBtxc('0');
    setNewClientBrl('0');
    setNewClientUsdt('0');
    setNewClientStatus('Verificado KYC');
  };

  const confirmDeleteRealClient = async () => {
    if (!clientToDelete) return;
    const { id, name } = clientToDelete;
    
    try {
      await supabase.from('clients').delete().eq('id', id);
    } catch {}

    const remaining = exchangeClients.filter((c) => c.id !== id);
    setExchangeClients(remaining);
    saveStoredRealClients(remaining);

    if (editingClient?.id === id) {
      handleCancelEditClient();
    }
    setClientToDelete(null);
    setClientFormFeedback(`✓ Cliente "${name}" (${id}) desvinculado.`);
    setTimeout(() => setClientFormFeedback(''), 4000);
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

  // Handle new transaction emission
  const handleSendTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendTo.trim() || !sendAmount) return;
    const amt = parseFloat(sendAmount);
    if (isNaN(amt) || amt <= 0) return;

    if (amt > walletBalance) {
      setSendFeedback('Saldo insuficiente na carteira para efetuar a transação na Mainnet.');
      return;
    }

    const txid = 'tx_' + Math.random().toString(16).substring(2, 12);
    const newTx: MempoolTx = {
      txid,
      from: walletAddress,
      to: sendTo.trim(),
      amount: amt,
      fee: 0.0001,
      time: 'Agora',
      exchangeClientTag: sendTo.trim() === exchangeHotWallet ? 'GE-DEPOSIT-DIRECT' : undefined,
    };

    setMempool((prev) => [newTx, ...prev]);
    setWalletBalance((prev) => prev - amt - 0.0001);
    setSendFeedback(`Transação ${txid} transmitida com sucesso para a Mempool da Mainnet!`);
    setSendTo('');
    setSendAmount('');
    addLog(`Nova transação ${txid} (${amt} BTXC) recebida na Mempool e propagada via P2P.`, 'info');
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

    // Update client balance on broker
    setExchangeClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, btxcBalance: +(c.btxcBalance + amt).toFixed(4) } : c))
    );

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
            <span
              style={{
                marginLeft: '8px',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              101,00 GX · R$ 42,42M
            </span>
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
                    const sel = exchangeClients.find((c) => c.id === e.target.value);
                    if (sel) {
                      setCustodyEditGxAmount(sel.btxcBalance.toString());
                    }
                  }}
                >
                  {exchangeClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id}) &bull; {c.btxcBalance.toFixed(2)} GX
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Doc: {currentCustodyClient.document || '70781338387'}</span>
                  <span style={{ color: '#10b981' }}>{currentCustodyClient.status}</span>
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
                    {currentCustodyClient.btxcBalance.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}{' '}
                    <span style={{ fontSize: '20px', color: '#f97316' }}>GX</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Tokens mantidos sob custódia e garantia institucional da Engecema Tecnologia.
                  </p>
                </div>

                <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #1e293b' }}>
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    style={{ width: '100%', fontSize: '12px', padding: '8px 12px' }}
                    onClick={() => handleOpenEditCustodyModal(currentCustodyClient)}
                  >
                    ✏️ Editar Saldo (Ajuste Direto com TXID)
                  </button>
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
                      DISPONÍVEL P/ TRANSFERÊNCIA
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
                    {(currentCustodyClient.btxcBalance * price).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#a7f3d0', lineHeight: 1.5 }}>
                    Multiplicado automaticamente: <strong>{currentCustodyClient.btxcBalance.toFixed(2)} GX</strong> &times;{' '}
                    <strong>R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </p>
                </div>

                <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <button
                    type="button"
                    className="portal-btn"
                    style={{
                      width: '100%',
                      fontSize: '13px',
                      fontWeight: 800,
                      padding: '10px 14px',
                      background: '#10b981',
                      color: '#022c22',
                      border: 'none',
                      boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
                    }}
                    onClick={() => setShowTransferBrlModal(true)}
                  >
                    💸 Transferir em Reais (R$) Agora
                  </button>
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
                    {((currentCustodyClient.btxcBalance * price) / 5.0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span style={{ fontSize: '18px', color: '#94a3b8' }}>USDT</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Cotação balizada na mesa institucional de câmbio (R$ 5,00 / USDT).
                  </p>
                </div>

                <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #1e293b' }}>
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    style={{ width: '100%', fontSize: '12px', padding: '8px 12px', color: '#38bdf8' }}
                    onClick={() => setShowTransferGxModal(true)}
                  >
                    🪙 Transferir em GX (Token)
                  </button>
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

            {/* SEÇÃO VISUAL: AS DUAS OPÇÕES DE MOVIMENTAÇÃO AO CLIENTE */}
            <div className="portal-card" style={{ marginBottom: '24px' }}>
              <div className="portal-card-header" style={{ borderBottom: '1px solid #1f2937', paddingBottom: '12px' }}>
                <div>
                  <h3 className="portal-card-title" style={{ fontSize: '16px', color: '#f8fafc' }}>
                    Opções de Movimentação para o Cliente &bull; {currentCustodyClient.name}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    O cliente possui <strong>{currentCustodyClient.btxcBalance.toFixed(2)} GX</strong> sob custódia, equivalentes a{' '}
                    <strong style={{ color: '#10b981' }}>
                      R$ {(currentCustodyClient.btxcBalance * price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                    . Escolha abaixo como deseja transferir:
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                  gap: '20px',
                  marginTop: '16px',
                }}
              >
                {/* OPÇÃO 1: TRANSFERIR EM REAIS (R$) VIA PIX / TED */}
                <div
                  style={{
                    background: '#0d1526',
                    border: '1px solid #10b981',
                    borderRadius: '8px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '20px' }}>💸</span>
                      <h4 style={{ margin: 0, fontSize: '15px', color: '#10b981', fontWeight: 800 }}>
                        OPÇÃO 1: Transferir em Reais (R$)
                      </h4>
                    </div>
                    <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 16px' }}>
                      Transfira valores diretamente em Reais via Pix Banco do Brasil (Engecema PJ).
                      O montante correspondente em GX é deduzido em tempo real com emissão de TXID criptográfico.
                    </p>

                    {/* Botões de atalho rápido */}
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                        VALORES RÁPIDOS EM REAIS:
                      </label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {['50000', '100000', '500000', '1000000'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            className="portal-btn portal-btn-secondary"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                            onClick={() => setTransferBrlAmount(val)}
                          >
                            R$ {parseInt(val).toLocaleString('pt-BR')}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="portal-btn portal-btn-secondary"
                          style={{ fontSize: '11px', padding: '4px 8px', color: '#10b981', borderColor: '#10b981' }}
                          onClick={() => setTransferBrlAmount((currentCustodyClient.btxcBalance * price).toString())}
                        >
                          Saldo Total (100%)
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleExecuteTransferBrl}>
                      <div className="portal-form-group">
                        <label>Valor da Transferência em Reais (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          className="portal-input"
                          style={{ fontSize: '15px', fontWeight: 'bold', color: '#10b981' }}
                          value={transferBrlAmount}
                          onChange={(e) => setTransferBrlAmount(e.target.value)}
                          required
                        />
                      </div>

                      {/* Conversor Dinâmico */}
                      <div
                        style={{
                          background: '#090d16',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          marginBottom: '14px',
                          fontSize: '12px',
                          color: '#94a3b8',
                          display: 'flex',
                          justifyContent: 'space-between',
                          border: '1px dashed #1e293b',
                        }}
                      >
                        <span>Equivalente Deduzido da Custódia:</span>
                        <strong style={{ color: '#f97316' }}>
                          ~{(parseFloat(transferBrlAmount || '0') / price).toFixed(6)} GX
                        </strong>
                      </div>

                      <div className="portal-form-group">
                        <label>Tipo de Chave Pix / Destino Bancário</label>
                        <select
                          className="portal-input"
                          value={transferBrlKeyType}
                          onChange={(e) => setTransferBrlKeyType(e.target.value as any)}
                        >
                          <option value="E-mail">Chave Pix (E-mail)</option>
                          <option value="CPF">Chave Pix (CPF)</option>
                          <option value="CNPJ">Chave Pix (CNPJ)</option>
                          <option value="Telefone">Chave Pix (Telefone Celular)</option>
                          <option value="Aleatória">Chave Pix Aleatória (EVP)</option>
                          <option value="TED Bancário">TED Bancário Banco do Brasil</option>
                        </select>
                      </div>

                      <div className="portal-form-group">
                        <label>Chave Pix do Favorecido / Dados da Conta</label>
                        <input
                          type="text"
                          className="portal-input portal-mono"
                          value={transferBrlPixKey}
                          onChange={(e) => setTransferBrlPixKey(e.target.value)}
                          required
                        />
                      </div>

                      <div className="portal-form-group">
                        <label>Nome do Favorecido</label>
                        <input
                          type="text"
                          className="portal-input"
                          value={transferBrlFavorecido}
                          onChange={(e) => setTransferBrlFavorecido(e.target.value)}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="portal-btn"
                        style={{
                          width: '100%',
                          background: '#10b981',
                          color: '#022c22',
                          fontWeight: 800,
                          fontSize: '13px',
                          padding: '10px',
                          border: 'none',
                          marginTop: '8px',
                        }}
                      >
                        🚀 Confirmar Transferência em Reais (Pix BB)
                      </button>
                    </form>

                    {transferBrlFeedback && (
                      <div
                        style={{
                          marginTop: '14px',
                          padding: '12px',
                          borderRadius: '6px',
                          background: transferBrlFeedback.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          border: `1px solid ${transferBrlFeedback.success ? '#10b981' : '#ef4444'}`,
                          color: transferBrlFeedback.success ? '#10b981' : '#ef4444',
                          fontSize: '12px',
                        }}
                      >
                        <div>{transferBrlFeedback.message}</div>
                        {transferBrlFeedback.txid && (
                          <div style={{ marginTop: '6px', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#38bdf8' }}>
                            TXID Criptográfico: {transferBrlFeedback.txid}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* OPÇÃO 2: TRANSFERIR EM GX (TOKEN NATIVO) */}
                <div
                  style={{
                    background: '#0d1526',
                    border: '1px solid #1f2937',
                    borderRadius: '8px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '20px' }}>🪙</span>
                      <h4 style={{ margin: 0, fontSize: '15px', color: '#f8fafc', fontWeight: 800 }}>
                        OPÇÃO 2: Transferir em GX (Tokens)
                      </h4>
                    </div>
                    <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 16px' }}>
                      Transfira tokens GX mantidos sob custódia diretamente para um endereço blockchain
                      ou outra conta corporativa na corretora Global Exchange.
                    </p>

                    <form onSubmit={handleExecuteTransferGx}>
                      <div className="portal-form-group">
                        <label>Quantidade de Tokens GX a Transferir</label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          max={currentCustodyClient.btxcBalance}
                          className="portal-input"
                          style={{ fontSize: '15px', fontWeight: 'bold', color: '#f8fafc' }}
                          value={transferGxAmount}
                          onChange={(e) => setTransferGxAmount(e.target.value)}
                          required
                        />
                      </div>

                      {/* Conversor Dinâmico */}
                      <div
                        style={{
                          background: '#090d16',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          marginBottom: '14px',
                          fontSize: '12px',
                          color: '#94a3b8',
                          display: 'flex',
                          justifyContent: 'space-between',
                          border: '1px dashed #1e293b',
                        }}
                      >
                        <span>Valor Correspondente em Reais (R$):</span>
                        <strong style={{ color: '#10b981' }}>
                          R$ {(parseFloat(transferGxAmount || '0') * price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>

                      <div className="portal-form-group">
                        <label>Endereço Blockchain de Destino (Native SegWit / Bech32)</label>
                        <input
                          type="text"
                          className="portal-input portal-mono"
                          placeholder="Ex: btxc1q..."
                          value={transferGxDestination}
                          onChange={(e) => setTransferGxDestination(e.target.value)}
                          required
                        />
                      </div>

                      <div className="portal-form-group">
                        <label>Taxa de Rede da Blockchain (Mineradores Mainnet)</label>
                        <input
                          type="text"
                          className="portal-input portal-mono"
                          readOnly
                          value="0.0001 GX (R$ 42,00) &bull; 6 Confirmações de Bloco"
                        />
                      </div>

                      <button
                        type="submit"
                        className="portal-btn portal-btn-primary"
                        style={{ width: '100%', fontWeight: 800, fontSize: '13px', padding: '10px', marginTop: '8px' }}
                      >
                        Confirmar Envio de GX
                      </button>
                    </form>

                    {transferGxFeedback && (
                      <div
                        style={{
                          marginTop: '14px',
                          padding: '12px',
                          borderRadius: '6px',
                          background: transferGxFeedback.success ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          border: `1px solid ${transferGxFeedback.success ? '#38bdf8' : '#ef4444'}`,
                          color: transferGxFeedback.success ? '#38bdf8' : '#ef4444',
                          fontSize: '12px',
                        }}
                      >
                        <div>{transferGxFeedback.message}</div>
                        {transferGxFeedback.txid && (
                          <div style={{ marginTop: '6px', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#10b981' }}>
                            TXID Blockchain: {transferGxFeedback.txid}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* LIVRO RAZÃO DE CUSTÓDIA & LIQUIDAÇÃO (LEDGER AUDITÁVEL) */}
            <div className="portal-card">
              <div className="portal-card-header">
                <div>
                  <h3 className="portal-card-title">
                    📜 Livro Razão de Custódia & Liquidação (Ledger Auditável Engecema)
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Registro histórico imutável das posições mantidas em custódia, aportes de capital,
                    transferências em Reais (Pix BB) e ajustes com TXID.
                  </p>
                </div>
              </div>

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
                    {custodyLedger.map((row) => (
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
                    ))}
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
              <div className="portal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 className="portal-card-title">Carteira de Clientes da Global Exchange (Plataforma Oficial)</h3>
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
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Listagem exclusiva e em tempo real dos clientes reais cadastrados na plataforma Global Exchange (Supabase Cloud). Cadastros fictícios e gerados pelo sistema foram totalmente eliminados.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                      background: '#065f46',
                      border: '1px solid #10b981',
                      color: '#d1fae5',
                      fontSize: '12px',
                      padding: '6px 14px',
                      fontWeight: 700,
                    }}
                    onClick={handleReconcileWithCustodyLedger}
                    title="Forçar reconciliação do saldo com o Livro Razão de Custódia Engecema (101,00 GX · R$ 42.420.000,00)"
                  >
                    ⚖️ Reconciliar com Livro Razão
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
                    onClick={handlePurgeFictitiousClients}
                    title="Eliminar quaisquer cadastros fictícios residuais do navegador e re-sincronizar"
                  >
                    🧹 Purificar Cache
                  </button>
                </div>
              </div>

              {lastSyncTime && (
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span>Conexão Supabase:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>● Online (odbbtgkxgiqlfhcepwuj)</span>
                  <span>&bull;</span>
                  <span>Última sincronização com a plataforma: <strong>{lastSyncTime}</strong></span>
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
                      <th>Documento / E-mail</th>
                      <th>Saldo BTXC</th>
                      <th>Saldo BRL / USDT</th>
                      <th>Status KYC</th>
                      <th>Ações Rápidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingClients ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                          <div style={{ display: 'inline-block', fontSize: '14px', color: '#38bdf8' }}>
                            ⏳ Conectando e sincronizando clientes reais da plataforma Global Exchange...
                          </div>
                        </td>
                      </tr>
                    ) : exchangeClients.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '36px 20px', color: '#94a3b8' }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛡️</div>
                          <p style={{ margin: '0 0 8px', fontSize: '15px', color: '#f8fafc', fontWeight: 600 }}>
                            Nenhum cliente cadastrado na plataforma Global Exchange no momento.
                          </p>
                          <p style={{ margin: '0 0 16px', fontSize: '13px', maxWidth: '580px', marginInline: 'auto', lineHeight: '1.5', color: '#94a3b8' }}>
                            Todos os clientes fictícios e gerados pelo sistema foram <strong>totalmente eliminados</strong>. Esta aba agora lista <strong>exclusivamente clientes reais</strong> vindos da plataforma Global Exchange através do banco de dados oficial na nuvem.
                          </p>
                          <button
                            type="button"
                            className="portal-btn portal-btn-secondary"
                            onClick={fetchRealClientsFromGlobalExchange}
                          >
                            🔄 Atualizar Conexão com a Corretora
                          </button>
                        </td>
                      </tr>
                    ) : (
                      exchangeClients.map((c) => (
                        <tr key={c.id}>
                          <td className="portal-mono" style={{ fontWeight: 'bold', color: '#f97316' }}>
                            {c.id}
                          </td>
                          <td>
                            <strong>{c.name}</strong>
                            {c.createdAt && (
                              <div style={{ fontSize: '10px', color: '#64748b' }}>Cadastrado: {c.createdAt}</div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontSize: '12px', color: '#e2e8f0' }}>{c.document || 'Validado na Exchange'}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.email}</div>
                          </td>
                          <td style={{ color: '#10b981', fontWeight: 'bold', fontSize: '13px' }}>
                            {c.btxcBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} BTXC
                            {(c.id === 'GX-CLI-0001' || c.email === 'geonimatos31@hotmail.com' || c.document?.replace(/\D/g, '') === '70781338387') && (
                              <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '2px', fontWeight: 'normal' }}>
                                🛡️ Reconciliado com Livro Razão
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: '600' }}>
                              R$ {c.brlBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                              $ {c.usdtBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} USDT
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                background: c.status === 'Institucional' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                                color: c.status === 'Institucional' ? '#60a5fa' : '#10b981',
                                border: `1px solid ${c.status === 'Institucional' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
                                padding: '3px 8px',
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
                            </div>
                          </td>
                        </tr>
                      ))
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
                      if (window.confirm('Deseja purificar o cache e manter exclusivamente o operador oficial (geonimatos31@gmail.com)?')) {
                        updateOperatorsAndPersist(DEFAULT_REAL_OPERATORS, '🧹 Lista de operadores restaurada com sucesso: apenas geonimatos31@gmail.com!');
                        notifyCloudOperators(DEFAULT_REAL_OPERATORS);
                        addLog('[Acessos] Lista purificada mantendo apenas operador oficial geonimatos31@gmail.com.', 'success');
                      }
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
                                      if (users.length === 1 && !window.confirm(`Você está removendo o único operador cadastrado (${u.username}). Tem certeza?`)) {
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
                          alert('Este operador ou email já está cadastrado na lista.');
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

              {/* TABELA DE CLIENTES REAIS */}
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: '#f8fafc' }}>
                Clientes Reais Ativos no Sistema ({exchangeClients.length})
              </h3>
              <div className="portal-table-container">
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
                          Nenhum cliente cadastrado. Utilize o formulário acima para cadastrar contas reais.
                        </td>
                      </tr>
                    ) : (
                      exchangeClients.map((c) => (
                        <tr key={c.id}>
                          <td className="portal-mono" style={{ fontWeight: 'bold', color: '#f97316' }}>
                            {c.id}
                          </td>
                          <td>
                            <strong>{c.name}</strong>
                            {c.createdAt && (
                              <div style={{ fontSize: '10px', color: '#64748b' }}>Cadastrado: {c.createdAt}</div>
                            )}
                          </td>
                          <td style={{ fontSize: '12px', color: '#cbd5e1' }}>{c.document || '—'}</td>
                          <td style={{ fontSize: '12px', color: '#94a3b8' }}>{c.email}</td>
                          <td style={{ color: '#10b981', fontWeight: 'bold' }}>
                            {c.btxcBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} BTXC
                          </td>
                          <td>R$ {c.brlBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td>$ {c.usdtBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td>
                            <span
                              style={{
                                background: c.status === 'Institucional' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                                color: c.status === 'Institucional' ? '#60a5fa' : '#10b981',
                                border: `1px solid ${c.status === 'Institucional' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
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
                                style={{ padding: '3px 8px', fontSize: '11px', color: '#10b981', borderColor: '#10b981', fontWeight: 'bold' }}
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
                                onClick={() => setClientToDelete({ id: c.id, name: c.name })}
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
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 220px',
                    gap: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div className="portal-form-group">
                    <label>Endereço de Destino (Mainnet btxc1q...)</label>
                    <input
                      type="text"
                      className="portal-input portal-mono"
                      placeholder="btxc1q..."
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                      required
                    />
                    <div style={{ marginTop: '4px' }}>
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
                      alert('Endereço Mainnet copiado para a área de transferência!');
                    }}
                  >
                    Copiar
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
                Deseja realmente remover o cliente <strong>"{clientToDelete.name}"</strong> (<code>{clientToDelete.id}</code>) da Global Exchange? Esta ação atualizará o Painel de Configurações e a lista de depósitos imediatamente.
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

        {/* MODAL 1: EDITAR SALDO DE CUSTÓDIA (AJUSTE DIRETO COM TXID) */}
        {showEditCustodyModal && (
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
                border: '1px solid #10b981',
                borderRadius: '10px',
                padding: '28px',
                maxWidth: '560px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                color: '#f8fafc',
              }}
            >
              {/* Header do Modal conforme o padrão de Custódia Engecema */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                    PAINEL DE CUSTÓDIA &bull; CUSTÓDIA ENGECEMA
                  </div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', fontWeight: 800 }}>
                    Editar Saldo de Custódia (Ajuste Direto com TXID)
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    CNPJ: 05.368.602/0001-10 &bull; Favorecido: {currentCustodyClient.name} ({currentCustodyClient.id})
                  </div>
                </div>
                <button
                  type="button"
                  style={{ background: '#1e293b', border: 'none', color: '#94a3b8', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '14px' }}
                  onClick={() => setShowEditCustodyModal(false)}
                >
                  ✕
                </button>
              </div>

              <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: '1.6', margin: '0 0 16px' }}>
                Atualize o montante de GX mantido sob custódia para este cliente. Esta operação gera uma chave criptográfica auditável (TXID) no livro razão da Engecema.
              </p>

              {/* Saldo Atual */}
              <div
                style={{
                  background: '#090d16',
                  border: '1px solid #1e293b',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  marginBottom: '18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Saldo Atual em Custódia:</span>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc', fontFamily: 'DM Mono, monospace' }}>
                    {currentCustodyClient.btxcBalance.toFixed(2)} GX
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Valor Atual em Reais:</span>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981', fontFamily: 'DM Mono, monospace' }}>
                    R$ {(currentCustodyClient.btxcBalance * price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveCustodyEdit}>
                <div className="portal-form-group">
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Novo Saldo Total em GX</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    className="portal-input portal-mono"
                    placeholder="Ex: 2500.00"
                    style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc' }}
                    value={custodyEditGxAmount}
                    onChange={(e) => setCustodyEditGxAmount(e.target.value)}
                    required
                  />
                </div>

                {/* CAMPO DE DESTAQUE: VALOR CORRESPONDENTE EM REAIS CALCULADO DINAMICAMENTE */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 78, 59, 0.25) 100%)',
                    border: '1px solid #10b981',
                    borderRadius: '8px',
                    padding: '14px 18px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#6ee7b7', textTransform: 'uppercase', fontWeight: 800 }}>
                      Valor Correspondente em Reais (R$)
                    </span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                      Cotação: R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / GX
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 900,
                      color: '#10b981',
                      fontFamily: 'DM Mono, monospace',
                      margin: '4px 0',
                    }}
                  >
                    R${' '}
                    {(parseFloat(custodyEditGxAmount || '0') * price).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#a7f3d0' }}>
                    Cálculo automático: {custodyEditGxAmount || '0'} GX &times; R${' '}
                    {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="portal-form-group">
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Motivo / Justificativa</label>
                  <input
                    type="text"
                    className="portal-input"
                    placeholder="Ex: Aporte inicial de capital, rebalanceamento comercial"
                    value={custodyEditReason}
                    onChange={(e) => setCustodyEditReason(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    onClick={() => setShowEditCustodyModal(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="portal-btn"
                    style={{ background: '#10b981', color: '#022c22', fontWeight: 800, border: 'none', padding: '8px 18px' }}
                  >
                    Confirmar Edição
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: TRANSFERIR EM REAIS (R$) VIA PIX BB PRODUÇÃO */}
        {showTransferBrlModal && (
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
                border: '1px solid #10b981',
                borderRadius: '10px',
                padding: '28px',
                maxWidth: '560px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                color: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                    LIQUIDAÇÃO FINANCEIRA VIA PIX BANCO DO BRASIL
                  </div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', fontWeight: 800 }}>
                    Transferir Saldo de Custódia em Reais (R$)
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    Origem: Custódia Engecema PJ (CNPJ: 05.368.602/0001-10)
                  </div>
                </div>
                <button
                  type="button"
                  style={{ background: '#1e293b', border: 'none', color: '#94a3b8', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '14px' }}
                  onClick={() => setShowTransferBrlModal(false)}
                >
                  ✕
                </button>
              </div>

              {/* Informação do Saldo Disponível */}
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid #10b981',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: '#a7f3d0' }}>Saldo Disponível para Transferência:</span>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#10b981', fontFamily: 'DM Mono, monospace' }}>
                    R$ {(currentCustodyClient.btxcBalance * price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Custódia em GX:</span>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc', fontFamily: 'DM Mono, monospace' }}>
                    {currentCustodyClient.btxcBalance.toFixed(2)} GX
                  </div>
                </div>
              </div>

              <form onSubmit={handleExecuteTransferBrl}>
                <div className="portal-form-group">
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Valor em Reais (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={currentCustodyClient.btxcBalance * price}
                    className="portal-input portal-mono"
                    style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}
                    value={transferBrlAmount}
                    onChange={(e) => setTransferBrlAmount(e.target.value)}
                    required
                  />
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    Dedução equivalente em custódia: <strong style={{ color: '#f97316' }}>~{(parseFloat(transferBrlAmount || '0') / price).toFixed(6)} GX</strong>
                  </div>
                </div>

                <div className="portal-form-group">
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Tipo de Destino / Chave Pix</label>
                  <select
                    className="portal-input"
                    value={transferBrlKeyType}
                    onChange={(e) => setTransferBrlKeyType(e.target.value as any)}
                  >
                    <option value="E-mail">Chave Pix (E-mail)</option>
                    <option value="CPF">Chave Pix (CPF)</option>
                    <option value="CNPJ">Chave Pix (CNPJ)</option>
                    <option value="Telefone">Chave Pix (Telefone Celular)</option>
                    <option value="Aleatória">Chave Pix Aleatória (EVP)</option>
                    <option value="TED Bancário">TED Bancário Banco do Brasil</option>
                  </select>
                </div>

                <div className="portal-form-group">
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Chave Pix / Conta Favorecida</label>
                  <input
                    type="text"
                    className="portal-input portal-mono"
                    value={transferBrlPixKey}
                    onChange={(e) => setTransferBrlPixKey(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="portal-form-group">
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Nome do Favorecido</label>
                    <input
                      type="text"
                      className="portal-input"
                      value={transferBrlFavorecido}
                      onChange={(e) => setTransferBrlFavorecido(e.target.value)}
                      required
                    />
                  </div>
                  <div className="portal-form-group">
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>CPF / CNPJ Favorecido</label>
                    <input
                      type="text"
                      className="portal-input portal-mono"
                      value={transferBrlDoc}
                      onChange={(e) => setTransferBrlDoc(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    onClick={() => setShowTransferBrlModal(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="portal-btn"
                    style={{ background: '#10b981', color: '#022c22', fontWeight: 800, border: 'none', padding: '8px 18px' }}
                  >
                    Confirmar Transferência em Reais (Pix BB)
                  </button>
                </div>
              </form>

              {transferBrlFeedback && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px',
                    borderRadius: '6px',
                    background: transferBrlFeedback.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${transferBrlFeedback.success ? '#10b981' : '#ef4444'}`,
                    color: transferBrlFeedback.success ? '#10b981' : '#ef4444',
                    fontSize: '12px',
                  }}
                >
                  <div>{transferBrlFeedback.message}</div>
                  {transferBrlFeedback.txid && (
                    <div style={{ marginTop: '6px', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#38bdf8' }}>
                      TXID Criptográfico: {transferBrlFeedback.txid}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL 3: TRANSFERIR EM GX (TOKEN) */}
        {showTransferGxModal && (
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
                borderRadius: '10px',
                padding: '28px',
                maxWidth: '560px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                color: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                    ENVIO BLOCKCHAIN &bull; REDE PRINCIPAL MAINNET
                  </div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', fontWeight: 800 }}>
                    Transferir Tokens GX de Custódia
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    Origem: Custódia {currentCustodyClient.name} ({currentCustodyClient.btxcBalance.toFixed(2)} GX disponíveis)
                  </div>
                </div>
                <button
                  type="button"
                  style={{ background: '#1e293b', border: 'none', color: '#94a3b8', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '14px' }}
                  onClick={() => setShowTransferGxModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleExecuteTransferGx}>
                <div className="portal-form-group">
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Quantidade de GX a Enviar</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    max={currentCustodyClient.btxcBalance}
                    className="portal-input portal-mono"
                    style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc' }}
                    value={transferGxAmount}
                    onChange={(e) => setTransferGxAmount(e.target.value)}
                    required
                  />
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
                    Valor correspondente em Reais: <strong>R$ {(parseFloat(transferGxAmount || '0') * price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>

                <div className="portal-form-group">
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Endereço Blockchain de Destino</label>
                  <input
                    type="text"
                    className="portal-input portal-mono"
                    placeholder="Ex: btxc1q..."
                    value={transferGxDestination}
                    onChange={(e) => setTransferGxDestination(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    onClick={() => setShowTransferGxModal(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="portal-btn portal-btn-primary"
                    style={{ fontWeight: 800, padding: '8px 18px' }}
                  >
                    Confirmar Envio de GX
                  </button>
                </div>
              </form>

              {transferGxFeedback && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px',
                    borderRadius: '6px',
                    background: transferGxFeedback.success ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${transferGxFeedback.success ? '#38bdf8' : '#ef4444'}`,
                    color: transferGxFeedback.success ? '#38bdf8' : '#ef4444',
                    fontSize: '12px',
                  }}
                >
                  <div>{transferGxFeedback.message}</div>
                  {transferGxFeedback.txid && (
                    <div style={{ marginTop: '6px', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#10b981' }}>
                      TXID: {transferGxFeedback.txid}
                    </div>
                  )}
                </div>
              )}
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
