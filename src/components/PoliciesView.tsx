import React from 'react';

interface PoliciesViewProps {
  policy: 'privacidade' | 'termos' | 'cookies';
  onClose: () => void;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({ policy, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '8px',
          padding: '28px',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          color: '#e5e7eb',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #1f2937',
            paddingBottom: '12px',
            marginBottom: '18px',
          }}
        >
          <h2 style={{ margin: 0, color: '#f97316', fontSize: '18px' }}>
            {policy === 'privacidade' && 'Política de Privacidade'}
            {policy === 'termos' && 'Termos de Uso'}
            {policy === 'cookies' && 'Política de Cookies'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: '#374151',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Fechar ✕
          </button>
        </div>

        {policy === 'privacidade' && (
          <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#9ca3af' }}>
            <p>
              A presente <strong>Política de Privacidade</strong> descreve o compromisso do{' '}
              <strong>BitX Core</strong> com a segurança e a soberania dos dados do usuário em ambiente
              de testes (Regtest).
            </p>
            <h4 style={{ color: '#f3f4f6', margin: '14px 0 6px' }}>1. Não Coleta de Chaves Privadas</h4>
            <p>
              O BitX Core opera sob a premissa de <em>autocustódia estrita</em>. Suas frases de
              recuperação BIP-39 e chaves privadas nunca são transmitidas a nenhum servidor externo.
              Todo o processo criptográfico (derivação BIP-84, assinaturas e cifras) é realizado
              exclusivamente no seu navegador local.
            </p>
            <h4 style={{ color: '#f3f4f6', margin: '14px 0 6px' }}>2. Armazenamento Local Seguro</h4>
            <p>
              Quando você opta por manter sua carteira salva neste dispositivo, as chaves são cifradas
              usando derivação PBKDF2 (310.000 iterações com SHA-256) e algoritmo AES-256-GCM antes de
              qualquer escrita no Web Storage (localStorage).
            </p>
            <h4 style={{ color: '#f3f4f6', margin: '14px 0 6px' }}>3. Logs e Diagnóstico</h4>
            <p>
              Em ambiente regtest, dados de transações locais e conexões RPC com nós BitX locais não
              são rastreados nem compartilhados com terceiros.
            </p>
          </div>
        )}

        {policy === 'termos' && (
          <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#9ca3af' }}>
            <p>
              Ao utilizar o <strong>Painel e Carteira BitX Core</strong>, você concorda com os seguintes
              termos e condições:
            </p>
            <h4 style={{ color: '#f3f4f6', margin: '14px 0 6px' }}>1. Finalidade Experimental e de Testes</h4>
            <p>
              Esta aplicação destina-se a desenvolvimento, auditoria e simulação de redes de teste
              regtest. Quaisquer tokens ou moedas demonstrados (BTXC) são puramente demonstrativos e{' '}
              <strong>não possuem valor monetário</strong>.
            </p>
            <h4 style={{ color: '#f3f4f6', margin: '14px 0 6px' }}>2. Isenção de Responsabilidade</h4>
            <p>
              Nunca utilize frases mnemônicas contendo fundos de redes principais (Mainnet) nesta
              interface de testes. O software é fornecido "no estado em que se encontra" (AS-IS), sem
              garantias explícitas ou implícitas de adequação comercial.
            </p>
            <h4 style={{ color: '#f3f4f6', margin: '14px 0 6px' }}>3. Responsabilidade pelas Credenciais</h4>
            <p>
              O usuário é exclusivamente responsável pela guarda segura de suas senhas locais e frases
              de recuperação de 12 ou 24 palavras.
            </p>
          </div>
        )}

        {policy === 'cookies' && (
          <div style={{ fontSize: '13px', lineHeight: '1.7', color: '#9ca3af' }}>
            <p>
              O <strong>BitX Core</strong> prioriza a privacidade e não utiliza cookies de rastreamento
              publicitário nem serviços de terceiros intrusivos.
            </p>
            <h4 style={{ color: '#f3f4f6', margin: '14px 0 6px' }}>1. Armazenamento Funcional</h4>
            <p>
              Utilizamos exclusivamente o <code>sessionStorage</code> e o <code>localStorage</code> do
              navegador para manter o estado da sua sessão autenticada do painel e o contêiner cifrado da
              carteira local, sem transferência para rastreadores analíticos.
            </p>
            <h4 style={{ color: '#f3f4f6', margin: '14px 0 6px' }}>2. Limpeza de Dados</h4>
            <p>
              Você pode apagar todos os dados armazenados a qualquer momento utilizando o botão "Apagar
              carteira deste navegador" na aba Segurança da carteira ou limpando os dados de navegação.
            </p>
          </div>
        )}

        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              background: '#f97316',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 18px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px',
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
