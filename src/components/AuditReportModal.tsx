import React, { useState, useEffect } from 'react';
import {
  runCrossPlatformAudit,
  executeManualBalanceCorrection,
  AuditReport,
  AuditComparisonItem,
} from '../utils/auditTool';

interface AuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  officialPrice: number;
  onAdjustmentApplied?: () => void;
}

export const AuditReportModal: React.FC<AuditReportModalProps> = ({
  isOpen,
  onClose,
  officialPrice,
  onAdjustmentApplied,
}) => {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'comparativo' | 'tabelas' | 'ajuste' | 'relatorio'>('comparativo');

  // Formulário de Ajuste Manual
  const [adjustClientId, setAdjustClientId] = useState<string>('GX-CLI-0001');
  const [adjustBtxc, setAdjustBtxc] = useState<string>('16.75');
  const [adjustBrl, setAdjustBrl] = useState<string>('420072.14');
  const [adjustUsdt, setAdjustUsdt] = useState<string>('84014.43');
  const [adjustAddress, setAdjustAddress] = useState<string>('bxrt1qnkach2pvm79qljf5rxdg863utw4s0zey');
  const [adjustFeedback, setAdjustFeedback] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);

  const executeAudit = async () => {
    setIsRunning(true);
    try {
      const res = await runCrossPlatformAudit(officialPrice);
      setReport(res);
    } catch (e: any) {
      console.warn('[Audit tool error]:', e);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      executeAudit();
    }
  }, [isOpen, officialPrice]);

  if (!isOpen) return null;

  const handleCopyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.summaryMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadReport = () => {
    if (!report) return;
    const blob = new Blob([report.summaryMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-auditoria-bitx-globalexchange-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdjusting(true);
    setAdjustFeedback('');
    try {
      const btxcNum = Math.max(0, parseFloat(adjustBtxc) || 0);
      const brlNum = Math.max(0, parseFloat(adjustBrl) || 0);
      const usdtNum = Math.max(0, parseFloat(adjustUsdt) || 0);

      const res = await executeManualBalanceCorrection({
        clientId: adjustClientId,
        btxcBalance: btxcNum,
        brlBalance: brlNum,
        usdtBalance: usdtNum,
        address: adjustAddress,
        price: officialPrice,
      });

      setAdjustFeedback(res.message);
      if (res.success) {
        await executeAudit();
        if (onAdjustmentApplied) onAdjustmentApplied();
      }
    } catch (err: any) {
      setAdjustFeedback('Erro ao aplicar ajuste: ' + (err?.message || err));
    } finally {
      setIsAdjusting(false);
      setTimeout(() => setAdjustFeedback(''), 8000);
    }
  };

  const fillQuickAdjustment = (item: AuditComparisonItem) => {
    if (item.field.includes('BRL')) {
      setAdjustBrl('420072.14');
      setAdjustUsdt('84014.43');
    }
    if (item.field.includes('BTXC')) {
      setAdjustBtxc('16.75');
    }
    if (item.field.includes('USDT')) {
      setAdjustUsdt('84014.43');
    }
    if (item.field.includes('Bech32')) {
      setAdjustAddress('bxrt1qnkach2pvm79qljf5rxdg863utw4s0zey');
    }
    setActiveTab('ajuste');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#0d1526',
          border: '2px solid #38bdf8',
          borderRadius: '12px',
          maxWidth: '1000px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 25px rgba(56, 189, 248, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(90deg, #090e1a 0%, #0d1526 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '26px' }}>🔍</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#f8fafc', fontWeight: 800 }}>
                Utilitário de Auditoria & Relatório de Discrepâncias
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Varredura cruzada: <strong>Rede BitX Core (Mainnet)</strong> ⇄ <strong>Global Exchange</strong> ⇄ <strong>Supabase Cloud</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                cursor: isRunning ? 'wait' : 'pointer',
              }}
              onClick={executeAudit}
              disabled={isRunning}
            >
              {isRunning ? '⏳ Auditando...' : '🔄 Re-executar Auditoria'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '22px',
                cursor: 'pointer',
                padding: '2px 8px',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div
          style={{
            padding: '14px 24px',
            background: '#0b1120',
            borderBottom: '1px solid #1e293b',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          <div style={{ background: '#090d16', padding: '10px 14px', borderRadius: '6px', borderLeft: report?.discrepanciesCount === 0 ? '4px solid #10b981' : '4px solid #ef4444' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>STATUS DA CONCILIAÇÃO</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: report?.discrepanciesCount === 0 ? '#10b981' : '#ef4444' }}>
              {report?.discrepanciesCount === 0 ? '● 100% EQUALIZADO' : `● ${report?.discrepanciesCount} DISCREPÂNCIA(S)`}
            </div>
          </div>

          <div style={{ background: '#090d16', padding: '10px 14px', borderRadius: '6px', borderLeft: '4px solid #38bdf8' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>PARÂMETROS VERIFICADOS</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>
              {report?.totalChecks || 0} Verificações ({report?.passedChecks || 0} Conciliados)
            </div>
          </div>

          <div style={{ background: '#090d16', padding: '10px 14px', borderRadius: '6px', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>TABELAS NO SUPABASE</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fbbf24' }}>
              {report?.tablesScanned.filter((t) => t.accessible).length || 0} Conectadas / {report?.tablesScanned.length || 0} Total
            </div>
          </div>

          <div style={{ background: '#090d16', padding: '10px 14px', borderRadius: '6px', borderLeft: '4px solid #a855f7' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>COTAÇÃO OFICIAL BITX</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#c084fc' }}>
              R$ {officialPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', background: '#080d1a', padding: '0 24px' }}>
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'comparativo' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('comparativo')}
            style={{ padding: '10px 18px', fontSize: '13px' }}
          >
            📊 Comparativo & Discrepâncias ({report?.discrepanciesCount || 0})
          </button>
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'ajuste' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('ajuste')}
            style={{ padding: '10px 18px', fontSize: '13px' }}
          >
            ⚙️ Painel de Ajuste Manual Direto
          </button>
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'tabelas' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('tabelas')}
            style={{ padding: '10px 18px', fontSize: '13px' }}
          >
            🗄️ Tabelas Supabase Cloud ({report?.tablesScanned.length || 0})
          </button>
          <button
            type="button"
            className={`portal-nav-tab ${activeTab === 'relatorio' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('relatorio')}
            style={{ padding: '10px 18px', fontSize: '13px' }}
          >
            📄 Relatório Formatado (Markdown)
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: COMPARATIVO */}
          {activeTab === 'comparativo' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
                  Auditoria cruzada dos saldos, livro razão de custódia e emissão blockchain:
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Data da auditoria: <strong>{report?.timestamp}</strong>
                </span>
              </div>

              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Entidade / Alvo</th>
                      <th>Parâmetro</th>
                      <th>Rede BitX Core</th>
                      <th>Global Exchange</th>
                      <th>Supabase Cloud</th>
                      <th>Divergência</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!report || isRunning ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#38bdf8' }}>
                          ⏳ Executando auditoria cruzada em tempo real...
                        </td>
                      </tr>
                    ) : (
                      report.items.map((item) => (
                        <tr
                          key={item.id}
                          style={{
                            background: item.hasDiscrepancy
                              ? 'rgba(239, 68, 68, 0.08)'
                              : undefined,
                          }}
                        >
                          <td style={{ fontWeight: 'bold', color: '#f8fafc' }}>
                            <div>{item.targetName}</div>
                            <span
                              style={{
                                fontSize: '10px',
                                background: '#1e293b',
                                color: '#94a3b8',
                                padding: '1px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {item.category}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: '#38bdf8' }}>{item.field}</td>
                          <td className="portal-mono" style={{ fontSize: '12px', color: '#cbd5e1' }}>
                            {item.bitxCoreValue}
                          </td>
                          <td className="portal-mono" style={{ fontSize: '12px', color: '#10b981' }}>
                            {item.globalExchangeValue}
                          </td>
                          <td className="portal-mono" style={{ fontSize: '12px', color: '#f59e0b' }}>
                            {item.supabaseValue}
                          </td>
                          <td className="portal-mono" style={{ fontSize: '12px', fontWeight: 'bold', color: item.hasDiscrepancy ? '#ef4444' : '#10b981' }}>
                            {item.difference === 0 ? '0,00' : item.difference.toLocaleString('pt-BR')}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                background: item.hasDiscrepancy ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                color: item.hasDiscrepancy ? '#ef4444' : '#10b981',
                                border: `1px solid ${item.hasDiscrepancy ? '#ef4444' : '#10b981'}`,
                              }}
                            >
                              {item.hasDiscrepancy ? '⚠️ DIVERGÊNCIA' : '✓ EQUALIZADO'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {item.hasDiscrepancy ? (
                              <button
                                type="button"
                                className="portal-btn"
                                style={{
                                  background: '#dc2626',
                                  border: '1px solid #ef4444',
                                  color: '#fff',
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  fontWeight: 700,
                                }}
                                onClick={() => fillQuickAdjustment(item)}
                                title="Corrigir discrepância no painel de ajuste manual"
                              >
                                Corrigir ✏️
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="portal-btn portal-btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                onClick={() => fillQuickAdjustment(item)}
                                title="Ajustar manualmente este parâmetro se necessário"
                              >
                                Ajustar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Box explicativo das regras oficiais */}
              <div
                style={{
                  marginTop: '16px',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid #0284c7',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '12px',
                  color: '#bae6fd',
                }}
              >
                <strong>Regras Oficiais Auditadas:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
                  <li><strong>Saldo com Liquidez em Reais (R$):</strong> O saldo bancário oficial em Reais do cliente na Global Exchange é exatamente <strong>R$ 420.072,14</strong> (Banco do Brasil).</li>
                  <li><strong>Saldo em Dólares (USDT):</strong> Fixado na paridade oficial de R$ 5,00 por USDT, totalizando <strong>$ 84.014,43 USDT</strong>.</li>
                  <li><strong>Saldo BTXC / GX:</strong> <strong>16,75 BTXC</strong> consolidados (13,00 GX do depósito CUST-TX-270 + 3,75 GX rastreados da Mempool no CUST-TX-375).</li>
                  <li><strong>Emissão PoW SHA-256d:</strong> Moedas mineradas (#348.912 × 50 BTXC = 17.445.600 BTXC) 100% equalizadas com o Ecossistema (Divergência: 0,0000 BTXC).</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: PAINEL DE AJUSTE MANUAL DIRETO */}
          {activeTab === 'ajuste' && (
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: 700 }}>
                  ⚙️ Ajuste Manual Direto e Sincronização Atômica
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  Insira os valores desejados para reescrever e equalizar simultaneamente a base do Supabase Cloud, o Livro Razão de Custódia e as carteiras locais.
                </p>
              </div>

              {adjustFeedback && (
                <div
                  style={{
                    background: adjustFeedback.includes('Erro') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    border: `1px solid ${adjustFeedback.includes('Erro') ? '#ef4444' : '#10b981'}`,
                    color: adjustFeedback.includes('Erro') ? '#fca5a5' : '#a7f3d0',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  {adjustFeedback}
                </div>
              )}

              <form
                onSubmit={handleApplyAdjustment}
                style={{
                  background: '#0a0f1d',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '20px',
                }}
              >
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
                      Identificador do Cliente
                    </label>
                    <input
                      type="text"
                      className="portal-input portal-mono"
                      value={adjustClientId}
                      onChange={(e) => setAdjustClientId(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#10b981', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                      Saldo BTXC / GX
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      className="portal-input"
                      value={adjustBtxc}
                      onChange={(e) => setAdjustBtxc(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#38bdf8', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                      Saldo Liquidez em Reais (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="portal-input"
                      value={adjustBrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAdjustBrl(val);
                        const num = parseFloat(val) || 0;
                        setAdjustUsdt((num / 5.0).toFixed(2));
                      }}
                      required
                    />
                    <small style={{ fontSize: '10px', color: '#64748b' }}>
                      Valor correto da Global Exchange: <strong>420072.14</strong>
                    </small>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#f59e0b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                      Saldo USDT ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="portal-input"
                      value={adjustUsdt}
                      onChange={(e) => setAdjustUsdt(e.target.value)}
                      required
                    />
                    <small style={{ fontSize: '10px', color: '#64748b' }}>
                      Paridade 5,00: <strong>84014.43</strong>
                    </small>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Endereço BitX Core Bech32 Oficial
                    </label>
                    <input
                      type="text"
                      className="portal-input portal-mono"
                      value={adjustAddress}
                      onChange={(e) => setAdjustAddress(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    onClick={() => {
                      setAdjustBtxc('16.75');
                      setAdjustBrl('420072.14');
                      setAdjustUsdt('84014.43');
                      setAdjustAddress('bxrt1qnkach2pvm79qljf5rxdg863utw4s0zey');
                    }}
                  >
                    Restaurar Valores Oficiais (R$ 420.072,14)
                  </button>

                  <button
                    type="submit"
                    className="portal-btn portal-btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      borderColor: '#10b981',
                      fontWeight: 800,
                      padding: '8px 24px',
                    }}
                    disabled={isAdjusting}
                  >
                    {isAdjusting ? '⏳ Gravando Ajuste...' : '✓ Gravar Ajuste e Sincronizar Tudo'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: TABELAS SUPABASE CLOUD */}
          {activeTab === 'tabelas' && (
            <div>
              <div style={{ marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#f8fafc', fontWeight: 700 }}>
                  🗄️ Diagnóstico das Tabelas no Banco Supabase Cloud (`odbbtgkxgiqlfhcepwuj`)
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  Verificação de conectividade, schema cache e contagem de registros na nuvem.
                </p>
              </div>

              <div className="portal-table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Nome da Tabela</th>
                      <th>Linhas (Rows)</th>
                      <th>Conectividade</th>
                      <th>Status Schema</th>
                      <th>Observações de Auditoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report?.tablesScanned.map((tab) => (
                      <tr key={tab.tableName}>
                        <td className="portal-mono" style={{ fontWeight: 'bold', color: '#38bdf8' }}>
                          {tab.tableName}
                        </td>
                        <td style={{ fontWeight: 700, color: '#f8fafc' }}>{tab.rowCount}</td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              background: tab.accessible ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: tab.accessible ? '#10b981' : '#ef4444',
                            }}
                          >
                            {tab.accessible ? '● Conectada' : '○ Indisponível'}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              color: tab.status === 'ok' ? '#10b981' : tab.status === 'missing' ? '#f59e0b' : '#ef4444',
                            }}
                          >
                            {tab.status === 'ok' ? '✓ OK' : tab.status === 'missing' ? '⚠️ Não Criada' : '❌ Erro'}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: '#94a3b8' }}>{tab.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: RELATÓRIO EM MARKDOWN */}
          {activeTab === 'relatorio' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
                  Relatório completo para compliance contábil e auditoria financeira:
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="portal-btn portal-btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={handleCopyReport}
                  >
                    {copied ? '✓ Copiado!' : '📋 Copiar Relatório'}
                  </button>
                  <button
                    type="button"
                    className="portal-btn portal-btn-primary"
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={handleDownloadReport}
                  >
                    ⬇️ Baixar (.md)
                  </button>
                </div>
              </div>

              <textarea
                className="portal-textarea portal-mono"
                style={{
                  width: '100%',
                  height: '340px',
                  fontSize: '12px',
                  background: '#070b14',
                  color: '#e2e8f0',
                  lineHeight: '1.6',
                }}
                readOnly
                value={report?.summaryMarkdown || ''}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#090e1a',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Auditoria Segura BitX Core &bull; Algoritmo SHA-256d &bull; Supabase Cloud
          </div>
          <button
            type="button"
            className="portal-btn portal-btn-secondary"
            onClick={onClose}
          >
            Fechar Utilitário
          </button>
        </div>
      </div>
    </div>
  );
};
