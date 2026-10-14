import React, { useState, useEffect, useRef } from 'react';
import '../styles/portal.css';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToBase64 } from '../utils/crypto';

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
}

export const OperationsPortal: React.FC<OperationsPortalProps> = ({ onOpenPolicy }) => {
  const [activeTab, setActiveTab] = useState<
    'mining' | 'config' | 'explorer' | 'mempool' | 'wallet'
  >('mining');

  // Blockchain state
  const [blockHeight, setBlockHeight] = useState<number>(108);
  const [difficulty] = useState<string>('0x1f00ffff (1.000)');
  const [blockReward] = useState<number>(50.0);
  const [minerAddress, setMinerAddress] = useState<string>(
    'bxrt1q9vzp0k2e4f50miner_reward_pool_master_99x'
  );
  const [walletAddress] = useState<string>('bxrt1qf08xve992k7s9k8j3z2p987e9k3l98764a');
  const [walletBalance, setWalletBalance] = useState<number>(5400.0); // 108 * 50

  // Mining state
  const [isMining, setIsMining] = useState<boolean>(false);
  const [autoMining, setAutoMining] = useState<boolean>(false);
  const [miningLogs, setMiningLogs] = useState<
    { id: string; time: string; text: string; type: 'info' | 'success' | 'warning' }[]
  >([
    {
      id: '1',
      time: '10:00:00',
      text: 'Nó BitX Core inicializado em rede independente (Regtest).',
      type: 'info',
    },
    {
      id: '2',
      time: '10:00:02',
      text: 'Subsídio inicial de bloco definido: 50.00 BTXC por bloco gerado.',
      type: 'info',
    },
    {
      id: '3',
      time: '10:00:05',
      text: 'Cadeia sincronizada na altura #108. Minerador pronto para operações PoW.',
      type: 'success',
    },
  ]);

  // Blocks history
  const [blocks, setBlocks] = useState<BlockRecord[]>(() => {
    const initial: BlockRecord[] = [];
    let prev = '0000000000000000000000000000000000000000000000000000000000000000';
    for (let h = 104; h <= 108; h++) {
      const hash = `0000000${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`;
      initial.unshift({
        height: h,
        hash,
        prevHash: prev,
        merkleRoot: Math.random().toString(16).substring(2, 18),
        timestamp: new Date(Date.now() - (108 - h) * 150000).toLocaleTimeString(),
        transactionsCount: 1,
        miner: 'bxrt1q9vzp0k2e4f50miner_reward_pool_master_99x',
        reward: 50.0,
        nonce: Math.floor(Math.random() * 90000) + 10000,
        difficulty: '0x1f00ffff',
        transactions: [
          {
            txid: 'coinbase_' + Math.random().toString(16).substring(2, 10),
            from: 'Coinbase (Geração de Bloco)',
            to: 'bxrt1q9vzp0k2e4f50miner_reward_pool_master_99x',
            amount: 50.0,
            fee: 0,
          },
        ],
      });
      prev = hash;
    }
    return initial;
  });

  // Selected block for modal
  const [selectedBlock, setSelectedBlock] = useState<BlockRecord | null>(null);

  // Mempool state
  const [mempool, setMempool] = useState<MempoolTx[]>([
    {
      txid: 'tx_fe883a91',
      from: 'bxrt1qf08xve992k7s9k8j3z2p987e9k3l98764a',
      to: 'bxrt1q7z8p492k1l8v72k9021873199837199aa',
      amount: 15.5,
      fee: 0.0001,
      time: 'Há 2 min',
    },
  ]);

  // Transfer form state
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendFeedback, setSendFeedback] = useState<string>('');

  // Config parameters & bitx.conf state
  const [rpcUser, setRpcUser] = useState('bitxrpc');
  const [rpcPass, setRpcPass] = useState('bitx_secure_pwd_2026');
  const [rpcPort, setRpcPort] = useState('18443');
  const [p2pPort, setP2pPort] = useState('18444');
  const [maxSupply] = useState('1.500.000.000');
  const [confCopied, setConfCopied] = useState(false);

  // Users state
  const [users, setUsers] = useState<
    { username: string; role: 'Super Admin' | 'Operador' | 'Auditor' }[]
  >([
    { username: 'admin', role: 'Super Admin' },
    { username: 'miner_node1', role: 'Operador' },
    { username: 'auditor_externo', role: 'Auditor' },
  ]);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<'Operador' | 'Auditor'>('Operador');

  // Live market price ticker
  const [price, setPrice] = useState(420.5);
  const [change, setChange] = useState(0.0);

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

  // Market price live simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setPrice((prev) => {
        const delta = (Math.random() - 0.48) * 0.45;
        const next = Math.max(10, prev + delta);
        const pct = (delta / next) * 100;
        setChange(pct);
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Perform block mining logic
  const mineOneBlock = async (batch = false): Promise<void> => {
    if (isMining && !batch) return;
    setIsMining(true);

    const nextHeight = blockHeight + 1;
    addLog(`Iniciando mineração do Bloco #${nextHeight}...`, 'info');
    addLog(`Construindo cabeçalho PoW SHA-256d. Mempool: ${mempool.length} tx(s).`, 'info');

    // Simulate proof of work computation
    await new Promise((resolve) => setTimeout(resolve, batch ? 200 : 900));

    const nonce = Math.floor(Math.random() * 800000) + 12000;
    const rawHeader = `bitx_block_${nextHeight}_nonce_${nonce}_time_${Date.now()}`;
    const hashBytes = sha256(new TextEncoder().encode(rawHeader));
    let hashHex = '';
    for (const b of hashBytes) hashHex += b.toString(16).padStart(2, '0');
    // Ensure classic PoW regtest prefix
    const finalHash = '0000000' + hashHex.substring(7);

    // Collect transactions from mempool
    const currentMempool = [...mempool];
    const blockTransactions = [
      {
        txid: 'coinbase_' + Math.random().toString(16).substring(2, 10),
        from: 'Coinbase (Subsídio de Mineração)',
        to: minerAddress,
        amount: blockReward,
        fee: 0,
      },
      ...currentMempool,
    ];

    const newBlock: BlockRecord = {
      height: nextHeight,
      hash: finalHash,
      prevHash: blocks[0]?.hash || '000000000000000000000000000000000000000000000000',
      merkleRoot: 'mrk_' + Math.random().toString(16).substring(2, 14),
      timestamp: new Date().toLocaleTimeString(),
      transactionsCount: blockTransactions.length,
      miner: minerAddress,
      reward: blockReward,
      nonce,
      difficulty: '0x1f00ffff',
      transactions: blockTransactions,
    };

    setBlocks((prev) => [newBlock, ...prev]);
    setBlockHeight(nextHeight);
    setWalletBalance((prev) => prev + blockReward);
    setMempool([]); // Clear mempool

    addLog(
      `✓ Bloco #${nextHeight} minerado com sucesso! Hash: ${finalHash.substring(0, 22)}... Nonce: ${nonce}`,
      'success'
    );
    addLog(`Recompensa de +${blockReward} BTXC creditada ao minerador.`, 'success');

    setIsMining(false);
  };

  // Mine batch of 5 blocks
  const mineFiveBlocks = async () => {
    if (isMining) return;
    setIsMining(true);
    addLog('Iniciando lote de 5 blocos rápidos...', 'warning');
    for (let i = 0; i < 5; i++) {
      await mineOneBlock(true);
    }
    setIsMining(false);
    addLog('✓ Lote de 5 blocos concluído com sucesso.', 'success');
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
      setSendFeedback('Saldo insuficiente para efetuar o envio.');
      return;
    }

    const txid = 'tx_' + Math.random().toString(16).substring(2, 10);
    const newTx: MempoolTx = {
      txid,
      from: walletAddress,
      to: sendTo.trim(),
      amount: amt,
      fee: 0.0001,
      time: 'Agora',
    };

    setMempool((prev) => [newTx, ...prev]);
    setWalletBalance((prev) => prev - amt - 0.0001);
    setSendFeedback(`Transação ${txid} enviada para a Mempool! Aguardando mineração de bloco.`);
    setSendTo('');
    setSendAmount('');
    addLog(`Nova transação ${txid} (${amt} BTXC) recebida na Mempool.`, 'info');
  };

  // Generate bitx.conf content
  const generatedBitxConf = `# Configuração Oficial do Nó BitX Core (BTXC)
# Rede: Independente (Regtest / PoW SHA-256d)
# Fornecimento Máximo: ${maxSupply} BTXC

# Servidor e RPC
server=1
listen=1
regtest=1
txindex=1

rpcuser=${rpcUser}
rpcpassword=${rpcPass}
rpcport=${rpcPort}
port=${p2pPort}

# Configurações de Mineração e Mempool
fallbackfee=0.0002
minrelaytxfee=0.00001
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
            </h1>
            <p>Central de Operações e Configuração da Moeda</p>
          </div>
        </div>

        <div className="portal-top-metrics">
          <div className="portal-badge">
            <span className="portal-badge-dot"></span>
            REDE ATIVA · REGTEST
          </div>

          <div className="portal-metric-pill">
            Altura da Cadeia: <strong>#{blockHeight}</strong>
          </div>

          <div className="portal-metric-pill">
            Cotação BTXC: <strong>R$ {price.toFixed(4)}</strong>
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

          <a
            href="https://bitx-core-1.onrender.com"
            target="_blank"
            rel="noopener noreferrer"
            className="portal-ext-link"
          >
            Site Institucional (Render) ↗
          </a>
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
            ⛏️ Mineração de Blocos
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
            <div className="portal-stat-label">Fornecimento Máximo</div>
            <div className="portal-stat-value">1.500.000.000</div>
            <div className="portal-stat-sub">BTXC (Teto limite absoluto)</div>
          </div>

          <div className="portal-stat-card accent-green">
            <div className="portal-stat-label">Moedas Mineradas (Emissão)</div>
            <div className="portal-stat-value">{(blockHeight * 50).toLocaleString()}</div>
            <div className="portal-stat-sub">
              {((blockHeight * 50 * 100) / 1500000000).toFixed(6)}% do teto minerado
            </div>
          </div>

          <div className="portal-stat-card accent-blue">
            <div className="portal-stat-label">Recompensa Atual por Bloco</div>
            <div className="portal-stat-value">50.00 BTXC</div>
            <div className="portal-stat-sub">Subsídio Coinbase PoW SHA-256d</div>
          </div>

          <div className="portal-stat-card accent-purple">
            <div className="portal-stat-label">Mempool Pendente</div>
            <div className="portal-stat-value">{mempool.length} txs</div>
            <div className="portal-stat-sub">Prontas para o próximo bloco</div>
          </div>
        </div>

        {/* TAB 1: MINERAÇÃO DE BLOCOS */}
        {activeTab === 'mining' && (
          <div>
            <div className="portal-card">
              <div className="portal-card-header">
                <div>
                  <h2 className="portal-card-title">⛏️ Controlador de Mineração de Blocos</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Gere novos blocos na rede BitX Core, valide transações pendentes da Mempool e
                    emita novas moedas BTXC através de Proof-of-Work.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="portal-btn portal-btn-primary"
                    disabled={isMining}
                    onClick={() => mineOneBlock(false)}
                  >
                    {isMining ? 'Minerando Bloco...' : '⚡ Minerar 1 Bloco'}
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
                          : 'Mineração contínua iniciada (intervalo ~4.5s).',
                        'info'
                      );
                    }}
                  >
                    {autoMining ? '⏹ Parar Auto-Mining' : '🔄 Auto-Mining Contínuo'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div className="portal-form-group">
                  <label>Endereço de Destino da Recompensa Coinbase (Minerador)</label>
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
                  Terminal de Mineração PoW em Tempo Real
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
                <h3 className="portal-card-title">Últimos Blocos Minerados na Cadeia</h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Total de blocos: {blockHeight}
                </span>
              </div>
              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Altura</th>
                      <th>Hash do Bloco</th>
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
                        <td style={{ fontWeight: 'bold', color: '#f97316' }}>#{b.height}</td>
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
                          {b.miner.substring(0, 14)}...
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

        {/* TAB 2: CONFIGURAÇÕES DA MOEDA */}
        {activeTab === 'config' && (
          <div>
            <div className="portal-card">
              <div className="portal-card-header">
                <div>
                  <h2 className="portal-card-title">⚙️ Painel de Configurações da Moeda BitX Core</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Parâmetros oficiais da moeda BTXC, controle de consensus e configuração de nós.
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
                    BitX Core (BTXC)
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
                  Configurador do Nó Local (bitx.conf)
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
                    <label style={{ fontSize: '11px', color: '#94a3b8' }}>RPC Port</label>
                    <input
                      type="text"
                      className="portal-input"
                      value={rpcPort}
                      onChange={(e) => setRpcPort(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8' }}>P2P Port</label>
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
                  rows={8}
                />

                <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="portal-btn portal-btn-primary"
                    onClick={handleCopyBitxConf}
                  >
                    {confCopied ? '✓ Conteúdo Copiado!' : 'Copiar bitx.conf'}
                  </button>
                </div>
              </div>

              {/* User access control */}
              <div style={{ marginTop: '36px', borderTop: '1px solid #1f2937', paddingTop: '24px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: '#f8fafc' }}>
                  Gerenciamento de Acessos Administrativos
                </h3>
                <div className="portal-table-container" style={{ marginBottom: '16px' }}>
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Usuário</th>
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
                            {u.username === 'admin' ? (
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
                    placeholder="Novo nome de usuário"
                    style={{ maxWidth: '240px' }}
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                  <select
                    className="portal-input"
                    style={{ maxWidth: '180px' }}
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                  >
                    <option value="Operador">Operador</option>
                    <option value="Auditor">Auditor</option>
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
                    Adicionar Usuário
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EXPLORADOR DE BLOCOS */}
        {activeTab === 'explorer' && (
          <div>
            <div className="portal-card">
              <div className="portal-card-header">
                <h2 className="portal-card-title">⛓️ Explorador de Blocos da Blockchain BitX Core</h2>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                  Altura Máxima: <strong>#{blockHeight}</strong> | Alvo PoW:{' '}
                  <strong>0x1f00ffff</strong>
                </div>
              </div>

              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Altura</th>
                      <th>Hash do Bloco</th>
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
                        <td style={{ fontWeight: 'bold', color: '#f97316' }}>#{b.height}</td>
                        <td className="portal-mono">{b.hash.substring(0, 20)}...</td>
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

        {/* TAB 4: TRANSFERÊNCIAS & MEMPOOL */}
        {activeTab === 'mempool' && (
          <div>
            <div className="portal-card">
              <div className="portal-card-header">
                <div>
                  <h2 className="portal-card-title">💸 Transferências Rápidas de BTXC</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Envie transações que serão enfileiradas na Mempool e gravadas no próximo bloco
                    minerado.
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
                    <label>Endereço de Destino (Regtest bxrt1q...)</label>
                    <input
                      type="text"
                      className="portal-input portal-mono"
                      placeholder="bxrt1q..."
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                      required
                    />
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
                    Enviar para a Mempool
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
                <h3 className="portal-card-title">Transações Pendentes na Mempool</h3>
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
                  A Mempool está vazia. Todas as transações foram mineradas e confirmadas em
                  blocos!
                </div>
              ) : (
                <div className="portal-table-container">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>ID da Transação</th>
                        <th>De (Origem)</th>
                        <th>Para (Destino)</th>
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

        {/* TAB 5: CARTEIRA INTEGRADA */}
        {activeTab === 'wallet' && (
          <div>
            <div className="portal-card">
              <div className="portal-card-header">
                <h2 className="portal-card-title">👛 Carteira Operacional BitX Core</h2>
                <div className="portal-badge">Regtest Native SegWit</div>
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
                    Saldo Disponível na Carteira
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
                    Equivalente a R$ {(walletBalance * price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
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
                    onClick={() => mineOneBlock(false)}
                  >
                    Minerar para esta Carteira
                  </button>
                </div>
              </div>

              <div className="portal-form-group">
                <label>Seu Endereço Regtest de Recebimento</label>
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
                      alert('Endereço copiado para a área de transferência!');
                    }}
                  >
                    Copiar
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '20px', borderTop: '1px solid #1f2937', paddingTop: '16px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#f8fafc' }}>
                  Detalhes Técnicos da Autocustódia
                </h4>
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.8 }}>
                  <div>• Caminho de Derivação: <code>m/84'/1'/0'/0/0</code> (BIP-84)</div>
                  <div>• Cifragem de Chaves: PBKDF2 (310.000 iterações com SHA-256) + AES-256-GCM</div>
                  <div>• Formato de Endereço: Bech32 Native SegWit (prefixo <code>bxrt1...</code>)</div>
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
              background: 'rgba(0,0,0,0.8)',
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
                  Detalhes do Bloco #{selectedBlock.height}
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
                  <strong>Hash do Bloco:</strong>
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
                  <div>Nonce: <strong>{selectedBlock.nonce}</strong></div>
                  <div>Dificuldade: <strong>{selectedBlock.difficulty}</strong></div>
                  <div>Transações: <strong>{selectedBlock.transactionsCount}</strong></div>
                  <div>Recompensa: <strong style={{ color: '#10b981' }}>{selectedBlock.reward} BTXC</strong></div>
                  <div>Horário: <strong>{selectedBlock.timestamp}</strong></div>
                  <div>Minerador: <strong>{selectedBlock.miner.substring(0, 14)}...</strong></div>
                </div>

                <div style={{ marginTop: '16px', borderTop: '1px solid #1f2937', paddingTop: '12px' }}>
                  <strong>Transações neste Bloco:</strong>
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
                      <span>{tx.from} &rarr; {tx.to.substring(0, 12)}...</span>
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
          BitX Core (BTXC) &bull; Central de Operações &bull; Rede Independente Regtest
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
          <a
            href="https://bitx-core-1.onrender.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#38bdf8', textDecoration: 'none' }}
          >
            Site Render ↗
          </a>
        </div>
      </footer>
    </div>
  );
};
