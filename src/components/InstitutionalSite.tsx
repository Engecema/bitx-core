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
            BITX CORE <small> / BTXC</small>
          </span>
        </button>

        <nav className="site-nav" aria-label="Navegação principal">
          <button type="button" onClick={() => scrollToSection('projeto')}>
            A rede
          </button>
          <button type="button" className="site-nav-cta" onClick={onNavigateToWallet}>
            Acessar carteira
          </button>
          <button type="button" className="site-nav-panel" onClick={onNavigateToPanel}>
            Painel de Configurações
          </button>
        </nav>
      </header>

      <main>
        <section className="site-shell site-hero" id="inicio">
          <div>
            <div className="site-eyebrow">Software aberto · Rede BTXC</div>
            <h1>
              Uma rede.
              <br />
              <span>Código aberto.</span>
            </h1>
            <p className="site-intro">
              Conheça a rede BitX Core e acesse a carteira experimental BTXC. A carteira deste site
              funciona somente em regtest, um ambiente local de testes sem valor monetário.
            </p>
            <div className="site-actions">
              <button
                type="button"
                className="site-button site-button-orange"
                onClick={onNavigateToPanel}
              >
                Painel de Configurações &rarr;
              </button>
              <button
                type="button"
                className="site-button"
                onClick={onNavigateToWallet}
              >
                Acessar carteira de testes
              </button>
              <button
                type="button"
                className="site-button site-button-secondary"
                onClick={() => scrollToSection('projeto')}
              >
                Conhecer a rede
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
            <span className="site-visual-label">BitX Core · BTXC</span>
          </div>
        </section>

        <section className="site-facts" id="projeto" aria-label="Sobre o projeto">
          <div className="site-shell site-facts-inner">
            <div className="site-fact">
              <strong>BitX Core</strong>
              <span>Software da rede BTXC</span>
            </div>
            <div className="site-fact">
              <strong>BTXC</strong>
              <span>Ativo nativo da rede BitX Core</span>
            </div>
            <div className="site-fact">
              <strong>Regtest</strong>
              <span>Ambiente local de testes</span>
            </div>
          </div>
        </section>

        {/* Highlight Section for Painel de Configurações */}
        <section className="site-shell site-section" style={{ paddingBottom: '40px' }}>
          <div
            style={{
              background: '#111827',
              borderRadius: '8px',
              padding: '36px',
              border: '1px solid #1f2937',
              color: '#f3f4f6',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
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
                  PAINEL ADMINISTRATIVO E CONFIGURAÇÃO
                </span>
                <h2
                  style={{
                    margin: '8px 0 10px',
                    fontFamily: 'Georgia, serif',
                    fontSize: '28px',
                    color: '#fff',
                  }}
                >
                  Configuração da Moeda BitX Core
                </h2>
                <p style={{ margin: 0, color: '#9ca3af', maxWidth: '560px', fontSize: '14px', lineHeight: 1.6 }}>
                  Acesse os parâmetros da rede regtest, consulte o fornecimento máximo de 1.500.000.000 BTXC, monitore o ticker de cotação em tempo real e gerencie usuários com controle administrativo total.
                </p>
              </div>
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
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#ea580c')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#f97316')}
              >
                Abrir Painel de Configurações &rarr;
              </button>
            </div>
          </div>
        </section>

        <section className="site-shell site-section" id="comecar">
          <div className="site-section-heading">
            <div>
              <div className="site-eyebrow">Carteira de testes</div>
              <h2>
                Comece com
                <br />
                segurança.
              </h2>
            </div>
            <p>
              A carteira é experimental e usa uma frase de recuperação protegida no navegador. Use
              apenas palavras criadas para testes e nunca informe uma frase de uma carteira real.
            </p>
          </div>

          <div className="site-steps">
            <article className="site-step">
              <span className="site-step-number">01 / CARTEIRA</span>
              <h3>Crie uma carteira de teste</h3>
              <p>
                Gere ou recupere uma carteira regtest. As chaves ficam no navegador e não são enviadas
                ao servidor.
              </p>
            </article>

            <article className="site-step">
              <span className="site-step-number">02 / REGTEST</span>
              <h3>Use somente ativos de teste</h3>
              <p>
                Endereços regtest não pertencem à rede principal e os ativos de teste não têm valor
                monetário.
              </p>
            </article>

            <article className="site-step">
              <span className="site-step-number">03 / CONEXÃO</span>
              <h3>Consulte o estado do nó</h3>
              <p>
                Saldo, histórico e envio dependem da conexão com o nó regtest local; não use esta
                versão para fundos reais.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-shell site-footer-inner">
          <div className="site-footer-brand">
            <strong>BitX Core · BTXC</strong>
            <span>Carteira experimental para clientes.</span>
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
