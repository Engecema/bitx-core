import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface OperationsConsoleProps {
  onOpenPolicy: (policy: 'privacidade' | 'termos' | 'cookies') => void;
  onOpenSiteModal?: () => void;
}

interface ClientRecord {
  id: string;
  name: string | null;
  email: string | null;
  status: string | null;
  btxc_balance: number | null;
  brl_balance: number | null;
  updated_at: string | null;
}

interface TransferRecord {
  id: string;
  txid: string | null;
  client_id: string | null;
  type: string;
  amount_gx: number;
  amount_brl: number;
  status: string | null;
  created_at: string | null;
}

const formatNumber = (value: number | null | undefined, digits = 2) =>
  Number.isFinite(value) ? Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits }) : '0';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR') : '—';

export const OperationsConsole: React.FC<OperationsConsoleProps> = ({ onOpenPolicy, onOpenSiteModal }) => {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadRecords = async () => {
      setIsLoading(true);
      setLoadError(null);
      const [clientResult, transferResult] = await Promise.all([
        supabase
          .from('clients')
          .select('id,name,email,status,btxc_balance,brl_balance,updated_at')
          .order('updated_at', { ascending: false }),
        supabase
          .from('transfers')
          .select('id,txid,client_id,type,amount_gx,amount_brl,status,created_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (!active) return;
      if (clientResult.error || transferResult.error) {
        console.warn('[OperationsConsole] Supabase read failed:', clientResult.error || transferResult.error);
        setLoadError('Não foi possível carregar os dados autorizados. Verifique a sessão e as políticas RLS.');
        setClients([]);
        setTransfers([]);
      } else {
        setClients((clientResult.data || []) as ClientRecord[]);
        setTransfers((transferResult.data || []) as TransferRecord[]);
      }
      setIsLoading(false);
    };

    void loadRecords();
    const channel = supabase
      .channel('bitx-admin-records')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => void loadRecords())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transfers' }, () => void loadRecords())
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main style={{ minHeight: '100vh', background: '#0b1118', color: '#e5edf2', padding: '28px clamp(16px, 4vw, 48px)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid #26333b', paddingBottom: 20 }}>
        <div>
          <p style={{ color: '#72d6bd', fontSize: 12, margin: '0 0 6px' }}>BITX CORE / OPERAÇÕES</p>
          <h1 style={{ fontSize: 24, margin: 0 }}>Visão administrativa</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {onOpenSiteModal && <button type="button" onClick={onOpenSiteModal}>Site público</button>}
          <button type="button" onClick={() => onOpenPolicy('privacidade')}>Privacidade</button>
          <button type="button" onClick={() => onOpenPolicy('termos')}>Termos</button>
          <button type="button" onClick={() => window.location.reload()} aria-label="Atualizar dados" title="Atualizar dados">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <section style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 0', color: '#a9bac2', fontSize: 13 }}>
        <ShieldAlert size={18} color="#e2b86b" />
        <p style={{ margin: 0 }}>Operações financeiras estão em modo somente leitura. Escritas exigem uma API/Edge Function com validação no servidor.</p>
      </section>

      {loadError && <p role="alert" style={{ color: '#ff9e9e' }}>{loadError}</p>}
      {isLoading && <p role="status">Carregando dados autorizados...</p>}

      <section aria-labelledby="clients-title" style={{ marginTop: 16 }}>
        <h2 id="clients-title" style={{ fontSize: 17 }}>Clientes ({clients.length})</h2>
        <div style={{ overflowX: 'auto', borderTop: '1px solid #26333b', borderBottom: '1px solid #26333b' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, textAlign: 'left' }}>
            <thead><tr>{['ID', 'Nome', 'E-mail', 'Status', 'BTXC', 'BRL', 'Atualizado'].map((label) => <th key={label} style={{ padding: '12px 10px', color: '#8fa3ad', fontSize: 12 }}>{label}</th>)}</tr></thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} style={{ borderTop: '1px solid #1d2a32' }}>
                  <td style={{ padding: 10 }}>{client.id}</td>
                  <td style={{ padding: 10 }}>{client.name || '—'}</td>
                  <td style={{ padding: 10 }}>{client.email || '—'}</td>
                  <td style={{ padding: 10 }}>{client.status || '—'}</td>
                  <td style={{ padding: 10 }}>{formatNumber(client.btxc_balance, 8)}</td>
                  <td style={{ padding: 10 }}>{formatNumber(client.brl_balance)}</td>
                  <td style={{ padding: 10 }}>{formatDate(client.updated_at)}</td>
                </tr>
              ))}
              {!isLoading && clients.length === 0 && <tr><td colSpan={7} style={{ padding: 18, color: '#8fa3ad' }}>Nenhum registro autorizado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="transfers-title" style={{ marginTop: 32 }}>
        <h2 id="transfers-title" style={{ fontSize: 17 }}>Transferências recentes ({transfers.length})</h2>
        <div style={{ overflowX: 'auto', borderTop: '1px solid #26333b', borderBottom: '1px solid #26333b' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, textAlign: 'left' }}>
            <thead><tr>{['ID', 'Cliente', 'Tipo', 'BTXC', 'BRL', 'Status', 'Data'].map((label) => <th key={label} style={{ padding: '12px 10px', color: '#8fa3ad', fontSize: 12 }}>{label}</th>)}</tr></thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id} style={{ borderTop: '1px solid #1d2a32' }}>
                  <td style={{ padding: 10 }}>{transfer.id}</td>
                  <td style={{ padding: 10 }}>{transfer.client_id || '—'}</td>
                  <td style={{ padding: 10 }}>{transfer.type}</td>
                  <td style={{ padding: 10 }}>{formatNumber(transfer.amount_gx, 8)}</td>
                  <td style={{ padding: 10 }}>{formatNumber(transfer.amount_brl)}</td>
                  <td style={{ padding: 10 }}>{transfer.status || '—'}</td>
                  <td style={{ padding: 10 }}>{formatDate(transfer.created_at)}</td>
                </tr>
              ))}
              {!isLoading && transfers.length === 0 && <tr><td colSpan={7} style={{ padding: 18, color: '#8fa3ad' }}>Nenhuma transferência autorizada.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};