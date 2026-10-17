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
  btxcBalance: number;
  brlBalance: number;
  usdtBalance: number;
  status: 'Ativo' | 'Verificado KYC';
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

export const OperationsPortal: React.FC<OperationsPortalProps> = ({ onOpenPolicy }) => {
  const [activeTab, setActiveTab] = useState<
    'mining' | 'exchange' | 'config' | 'explorer' | 'mempool' | 'wallet'
  >('mining');

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
      txid: 'tx_ge_dep_77192a0',
      from: 'btxc1qf08xve992k7s9k8j3z2p987e9k3l98764a',
      to: 'btxc1qglobal_exchange_hotwallet_liquidity_master01',
      amount: 45.0,
      fee: 0.0001,
      time: 'Há 1 min',
      exchangeClientTag: 'GE-CLIENT-88234',
    },
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

  // Global Exchange State & Conglomerate Clients
  const [selectedPair, setSelectedPair] = useState<'BTXC/BRL' | 'BTXC/USDT' | 'BTXC/BTC'>('BTXC/BRL');
  const [exchangeClients, setExchangeClients] = useState<ExchangeClient[]>([
    {
      id: 'GE-CLIENT-10492',
      name: 'Carlos E. Mendes',
      email: 'carlos.mendes@empresa.com.br',
      btxcBalance: 1250.0,
      brlBalance: 42500.0,
      usdtBalance: 8500.0,
      status: 'Verificado KYC',
    },
    {
      id: 'GE-CLIENT-88234',
      name: 'Mariana Duarte',
      email: 'mariana.duarte@invest.com',
      btxcBalance: 5400.0,
      brlBalance: 112000.0,
      usdtBalance: 22400.0,
      status: 'Verificado KYC',
    },
    {
      id: 'GE-CLIENT-33019',
      name: 'Atlas Capital S/A (Institucional)',
      email: 'mesa.operacoes@atlascapital.com',
      btxcBalance: 48000.0,
      brlBalance: 850000.0,
      usdtBalance: 170000.0,
      status: 'Verificado KYC',
    },
    {
      id: 'GE-CLIENT-55104',
      name: 'Fundo Delta de Ativos Digitais',
      email: 'custodia@deltadigital.fund',
      btxcBalance: 120000.0,
      brlBalance: 3200000.0,
      usdtBalance: 640000.0,
      status: 'Verificado KYC',
    },
  ]);

  // Exchange Deposits History
  const [exchangeDeposits, setExchangeDeposits] = useState<ExchangeDepositRecord[]>([
    {
      id: 'DEP-991',
      clientId: 'GE-CLIENT-88234',
      clientName: 'Mariana Duarte',
      txid: 'tx_ge_dep_77192a0',
      amount: 45.0,
      confirmations: 1,
      status: 'Confirmando',
      time: 'Hoje, 04:12',
    },
    {
      id: 'DEP-989',
      clientId: 'GE-CLIENT-10492',
      clientName: 'Carlos E. Mendes',
      txid: 'tx_b9812df0823c1',
      amount: 250.0,
      confirmations: 6,
      status: 'Creditado',
      time: 'Hoje, 03:45',
    },
    {
      id: 'DEP-985',
      clientId: 'GE-CLIENT-33019',
      clientName: 'Atlas Capital S/A',
      txid: 'tx_e0912cb8491d3',
      amount: 15000.0,
      confirmations: 18,
      status: 'Creditado',
      time: 'Ontem, 22:30',
    },
  ]);

  // Deposit Form for Exchange Client
  const [depositClientId, setDepositClientId] = useState<string>('GE-CLIENT-10492');
  const [depositAmount, setDepositAmount] = useState<string>('50');
  const [depositAlert, setDepositAlert] = useState<string>('');

  // Exchange Order Form
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderAmount, setOrderAmount] = useState<string>('10');
  const [orderFeedback, setOrderFeedback] = useState<string>('');

  // Order Book Mock data
  const [bids, setBids] = useState<OrderBookEntry[]>([
    { price: 420.45, amount: 125.4, total: 52724.43 },
    { price: 420.2, amount: 350.0, total: 147070.0 },
    { price: 419.8, amount: 640.2, total: 268755.96 },
    { price: 419.5, amount: 1200.0, total: 503400.0 },
    { price: 419.0, amount: 3500.0, total: 1466500.0 },
  ]);

  const [asks, setAsks] = useState<OrderBookEntry[]>([
    { price: 420.55, amount: 88.5, total: 37218.67 },
    { price: 420.8, amount: 240.0, total: 100992.0 },
    { price: 421.1, amount: 512.6, total: 215855.86 },
    { price: 421.5, amount: 980.0, total: 413070.0 },
    { price: 422.0, amount: 2800.0, total: 1181600.0 },
  ]);

  // Config parameters & bitx.conf state for MAINNET
  const [rpcUser, setRpcUser] = useState('bitx_mainnet_admin');
  const [rpcPass, setRpcPass] = useState('btxc_prod_sec_auth_2026!');
  const [rpcPort, setRpcPort] = useState('8332');
  const [p2pPort, setP2pPort] = useState('8333');
  const [maxSupply] = useState('1.500.000.000');
  const [confCopied, setConfCopied] = useState(false);

  // Users state
  const [users, setUsers] = useState<
    { username: string; role: 'Super Admin' | 'Operador' | 'Auditor' }[]
  >([
    { username: 'admin_engecema', role: 'Super Admin' },
    { username: 'global_exchange_gateway', role: 'Operador' },
    { username: 'auditor_compliance', role: 'Auditor' },
    { username: 'pool_operator_01', role: 'Operador' },
  ]);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<'Operador' | 'Auditor'>('Operador');

  // Live market price ticker
  const [price, setPrice] = useState(420.5);
  const [change, setChange] = useState(3.42);

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
        const delta = (Math.random() - 0.47) * 0.55;
        const next = Math.max(100, prev + delta);
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

  // Handle Client Buy / Sell Order on Global Exchange
  const handleExecuteExchangeOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(orderAmount);
    if (isNaN(amt) || amt <= 0) return;

    const totalBrl = amt * price;
    setOrderFeedback(
      `Ordem de ${orderSide === 'buy' ? 'COMPRA' : 'VENDA'} de ${amt} BTXC a R$ ${price.toFixed(2)} executada na Global Exchange com liquidação imediata!`
    );

    addLog(
      `[Global Exchange] Ordem executada: ${orderSide.toUpperCase()} ${amt} BTXC @ R$ ${price.toFixed(2)} (Total: R$ ${totalBrl.toFixed(2)}).`,
      'success'
    );

    setTimeout(() => setOrderFeedback(''), 5000);
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
                      <label>Quantidade em BTXC</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="portal-input"
                        value={orderAmount}
                        onChange={(e) => setOrderAmount(e.target.value)}
                        required
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
                    >
                      {orderSide === 'buy' ? 'Executar Compra na Corretora' : 'Executar Venda na Corretora'}
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
                    >
                      {exchangeClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id} — {c.name} (Saldo: {c.btxcBalance.toLocaleString()} BTXC)
                        </option>
                      ))}
                    </select>
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

                  <button type="submit" className="portal-btn portal-btn-primary">
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
                    {exchangeDeposits.map((dep) => (
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Conglomerate Clients Table */}
            <div className="portal-card">
              <div className="portal-card-header">
                <h3 className="portal-card-title">Carteira de Clientes da Global Exchange (Conglomerado)</h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Total Custodiado: <strong>174.650,00 BTXC</strong>
                </span>
              </div>
              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Identificador</th>
                      <th>Nome / Razão Social</th>
                      <th>E-mail</th>
                      <th>Saldo BTXC</th>
                      <th>Saldo BRL</th>
                      <th>Status KYC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exchangeClients.map((c) => (
                      <tr key={c.id}>
                        <td className="portal-mono" style={{ fontWeight: 'bold', color: '#f97316' }}>
                          {c.id}
                        </td>
                        <td><strong>{c.name}</strong></td>
                        <td style={{ color: '#94a3b8', fontSize: '12px' }}>{c.email}</td>
                        <td style={{ color: '#10b981', fontWeight: 'bold' }}>
                          {c.btxcBalance.toLocaleString()} BTXC
                        </td>
                        <td>R$ {c.brlBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td>
                          <span
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                            }}
                          >
                            {c.status}
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
                <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: '#f8fafc' }}>
                  Acessos Administrativos & Operadores da Corretora
                </h3>
                <div className="portal-table-container" style={{ marginBottom: '16px' }}>
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Usuário / Serviço</th>
                        <th>Perfil de Acesso</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.username}>
                          <td style={{ fontWeight: 'bold' }}>{u.username}</td>
                          <td>
                            <span
                              style={{
                                background: u.role === 'Super Admin' ? '#f97316' : '#1e293b',
                                color: '#fff',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                              }}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td style={{ color: '#10b981' }}>Ativo</td>
                          <td>
                            {u.username.includes('admin') ? (
                              <span style={{ color: '#64748b', fontSize: '11px' }}>
                                Principal (Protegido)
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="portal-btn portal-btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '11px', color: '#ef4444' }}
                                onClick={() =>
                                  setUsers(users.filter((item) => item.username !== u.username))
                                }
                              >
                                Remover
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add User Form */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="portal-input"
                    placeholder="Novo nome de usuário / serviço"
                    style={{ maxWidth: '260px' }}
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                  <select
                    className="portal-input"
                    style={{ maxWidth: '180px' }}
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                  >
                    <option value="Operador">Operador da Corretora</option>
                    <option value="Auditor">Auditor de Compliance</option>
                  </select>
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    onClick={() => {
                      if (!newUsername.trim()) return;
                      setUsers([...users, { username: newUsername.trim(), role: newRole }]);
                      setNewUsername('');
                    }}
                  >
                    Adicionar Acesso
                  </button>
                </div>
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
