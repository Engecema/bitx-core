import React from 'react';
import '../styles/site.css';

interface InstitutionalSiteProps {
  onNavigateToPanel: () => void;
  onNavigateToWallet: () => void;
  onOpenPolicy: (policy: 'privacidade' | 'termos' | 'cookies') => void;
}

export const InstitutionalSite: React.FC<InstitutionalSiteProps> = ({
  onNavigateToPanel,
  onNavigateToWallet,
  onOpenPolicy,
}) => {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="site-theme">
      <header className="site-shell site-topbar">
        <button
          type="button"
          className="site-wordmark"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="BitX Core, início"
        >
          <span className="site-logo-coin">BX</span>
          <span>
            BITX CORE <small> / BTXC MAINNET</small>
          </span>
        </button>

        <nav className="site-nav" aria-label="Navegação principal">
          <button type="button" onClick={() => scrollToSection('projeto')}>
            A Rede
          </button>
          <button type="button" onClick={() => scrollToSection('exchange')}>
            Global Exchange
          </button>
          <button type="button" className="site-nav-cta" onClick={onNavigateToWallet}>
            Acessar Carteira
          </button>
          <button type="button" className="site-nav-panel" onClick={onNavigateToPanel}>
            Portal de Operações
          </button>
        </nav>
      </header>

      <main>
        <section className="site-shell site-hero" id="inicio">
          <div>
            <div className="site-eyebrow">Rede Principal de Produção · Ativo BTXC</div>
            <h1>
              Uma rede robusta.
              <br />
              <span>Moeda em produção.</span>
            </h1>
            <p className="site-intro">
              Conheça a rede principal BitX Core (BTXC) em ambiente real de produção. Transacione com
              autocustódia BIP-84, minere blocos via PoW SHA-256d e opere com liquidez garantida na
              corretora Global Exchange do mesmo conglomerado.
            </p>
            <div className="site-actions">
              <button
                type="button"
                className="site-button site-button-orange"
                onClick={onNavigateToPanel}
              >
                Portal de Operações &rarr;
              </button>
              <button
                type="button"
                className="site-button"
                onClick={onNavigateToWallet}
              >
                Acessar Carteira Mainnet
              </button>
              <button
                type="button"
                className="site-button site-button-secondary"
                onClick={() => scrollToSection('exchange')}
              >
                Corretora Global Exchange
              </button>
            </div>
          </div>

          <div
            className="site-visual"
            role="img"
            aria-label="Símbolo BTXC em uma composição geométrica"
          >
            <div className="site-coin" aria-hidden="true">
              BX
            </div>
            <span className="site-visual-label">BitX Core · BTXC Mainnet</span>
          </div>
        </section>

        <section className="site-facts" id="projeto" aria-label="Sobre o projeto">
          <div className="site-shell site-facts-inner">
            <div className="site-fact">
              <strong>BitX Core</strong>
              <span>Blockchain PoW SHA-256d Ativa</span>
            </div>
            <div className="site-fact">
              <strong>BTXC</strong>
              <span>1.500.000.000 Fornecimento Máximo</span>
            </div>
            <div className="site-fact">
              <strong>Global Exchange</strong>
              <span>Liquidez & Custódia Institucional</span>
            </div>
          </div>
        </section>

        {/* Highlight Section for Global Exchange Broker */}
        <section className="site-shell site-section" id="exchange" style={{ paddingBottom: '30px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: '8px',
              padding: '36px',
              border: '1px solid #334155',
              borderLeft: '4px solid #f97316',
              color: '#f3f4f6',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '24px',
              }}
            >
              <div>
                <span
                  style={{
                    color: '#f97316',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  INTEGRAÇÃO INSTITUCIONAL DO CONGLOMERADO
                </span>
                <h2
                  style={{
                    margin: '8px 0 10px',
                    fontFamily: 'Georgia, serif',
                    fontSize: '28px',
                    color: '#fff',
                  }}
                >
                  Corretora Global Exchange & BitX Core
                </h2>
                <p style={{ margin: 0, color: '#94a3b8', maxWidth: '620px', fontSize: '14px', lineHeight: 1.6 }}>
                  A corretora Global Exchange integra a rede BitX Core diretamente aos seus livros de
                  ofertas nos pares <strong>BTXC/BRL</strong>, <strong>BTXC/USDT</strong> e <strong>BTXC/BTC</strong>.
                  Clientes contam com depósitos imediatos via blockchain, liquidez contínua, taxas
                  reduzidas e infraestrutura de alta disponibilidade mantida pela Engecema Fomento e Tecnologia.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onNavigateToPanel}
                  style={{
                    background: '#f97316',
                    color: '#fff',
                    padding: '14px 24px',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 6px rgba(249, 115, 22, 0.25)',
                  }}
                >
                  Acessar Gateway da Global Exchange &rarr;
                </button>
                <button
                  type="button"
                  onClick={onNavigateToWallet}
                  style={{
                    background: '#1e293b',
                    color: '#cbd5e1',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '13px',
                    border: '1px solid #475569',
                    cursor: 'pointer',
                  }}
                >
                  Abrir Carteira Mainnet
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Steps for Production Mainnet */}
        <section className="site-shell site-section" id="comecar">
          <div className="site-section-heading">
            <div>
              <div className="site-eyebrow">Ecossistema em Produção</div>
              <h2>
                Como operar na
                <br />
                Rede Principal.
              </h2>
            </div>
            <p>
              Opere com segurança utilizando a carteira de autocustódia, minere blocos na Mainnet
              e negocie com os clientes da Global Exchange em tempo real.
            </p>
          </div>

          <div className="site-steps">
            <article className="site-step">
              <span className="site-step-number">01 / AUTOCUSTÓDIA</span>
              <h3>Carteira SegWit BIP-84</h3>
              <p>
                Crie ou recupere sua carteira com derivação nativa BIP-84 (endereços <code>btxc1...</code>).
                Cifragem local AES-256-GCM no seu dispositivo.
              </p>
            </article>

            <article className="site-step">
              <span className="site-step-number">02 / GLOBAL EXCHANGE</span>
              <h3>Liquidez e Negociação</h3>
              <p>
                Deposite e retire fundos instantaneamente entre sua carteira BitX Core e sua conta
                na corretora Global Exchange com confirmações rápidas.
              </p>
            </article>

            <article className="site-step">
              <span className="site-step-number">03 / MINERAÇÃO POW</span>
              <h3>Emissão e Validação PoW</h3>
              <p>
                Minere em pool Stratum ou execute seu próprio nó validador independente com o teto
                máximo de 1.500.000.000 BTXC.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-shell site-footer-inner">
          <div className="site-footer-brand">
            <strong>BitX Core · BTXC Mainnet</strong>
            <span>Ecossistema integrado à corretora Global Exchange.</span>
          </div>

          <address className="site-footer-company">
            <strong>Engecema Engenharia Fomento e Tecnologia Ltda</strong>
            <br />
            CNPJ: 05.368.602/0002-09
            <br />
            Rua José de Moraes Rego, 1299, Sala A, Centro
            <br />
            Campinas do Piauí, CEP 64730-000
          </address>

          <nav className="site-footer-policies" aria-label="Políticas e termos">
            <button type="button" onClick={() => onOpenPolicy('privacidade')}>
              Política de Privacidade
            </button>
            <button type="button" onClick={() => onOpenPolicy('termos')}>
              Termos de Uso
            </button>
            <button type="button" onClick={() => onOpenPolicy('cookies')}>
              Política de Cookies
            </button>
          </nav>
        </div>
      </footer>
    </div>
  );
};
