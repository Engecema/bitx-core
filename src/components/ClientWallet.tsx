import React, { useState, useEffect } from 'react';
import '../styles/wallet.css';
import {
  generateMnemonicPhrase,
  validateMnemonicPhrase,
  deriveAddressFromMnemonic,
  encryptMnemonic,
  decryptMnemonic,
  readStoredWallet,
  saveStoredWallet,
  removeStoredWallet,
  EncryptedWalletRecord,
} from '../utils/crypto';

interface ClientWalletProps {
  onNavigateToSite: () => void;
  onNavigateToPanel: () => void;
}

type WalletPanelView = 'overview' | 'receive' | 'send' | 'activity' | 'security';
type WalletEntryView = 'welcome' | 'recovery' | 'restore';

export const ClientWallet: React.FC<ClientWalletProps> = ({
  onNavigateToSite,
  onNavigateToPanel,
}) => {
  // Stored wallet record from localStorage
  const [storedRecord, setStoredRecord] = useState<EncryptedWalletRecord | null>(null);

  // Unlocked wallet state in memory
  const [unlockedMnemonic, setUnlockedMnemonic] = useState<string>('');
  const [receiveIndex, setReceiveIndex] = useState<number>(0);
  const [currentAddress, setCurrentAddress] = useState<string>('Gerando endereço…');

  // Navigation state
  const [entryView, setEntryView] = useState<WalletEntryView>('welcome');
  const [panelView, setPanelView] = useState<WalletPanelView>('overview');

  // Forms state
  const [pendingMnemonic, setPendingMnemonic] = useState<string>('');
  const [savedSeedChecked, setSavedSeedChecked] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [createError, setCreateError] = useState('');

  const [restorePhrase, setRestorePhrase] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreError, setRestoreError] = useState('');

  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');

  // Send form
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  };

  // Check stored wallet on mount
  useEffect(() => {
    const rec = readStoredWallet();
    if (rec) {
      setStoredRecord(rec);
    }
  }, []);

  // Update derived address whenever mnemonic or receiveIndex changes
  useEffect(() => {
    if (!unlockedMnemonic) return;
    let isCurrent = true;
    deriveAddressFromMnemonic(unlockedMnemonic, 0, receiveIndex)
      .then((addr) => {
        if (isCurrent) setCurrentAddress(addr);
      })
      .catch(() => {
        if (isCurrent) setCurrentAddress('Erro ao derivar endereço');
      });
    return () => {
      isCurrent = false;
    };
  }, [unlockedMnemonic, receiveIndex]);

  const handleStartCreate = () => {
    if (!crypto?.getRandomValues || !crypto?.subtle) {
      showToast('Este navegador não oferece criptografia segura para a carteira.');
      return;
    }
    const phrase = generateMnemonicPhrase();
    setPendingMnemonic(phrase);
    setSavedSeedChecked(false);
    setNewPassword('');
    setConfirmPassword('');
    setCreateError('');
    setEntryView('recovery');
  };

  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedSeedChecked) return;
    if (newPassword.length < 12) {
      setCreateError('Use uma senha com pelo menos 12 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setCreateError('As senhas não coincidem.');
      return;
    }

    try {
      const record = await encryptMnemonic(pendingMnemonic, newPassword);
      saveStoredWallet(record);
      setStoredRecord(record);
      setUnlockedMnemonic(pendingMnemonic);
      setReceiveIndex(0);
      setPendingMnemonic('');
      setEntryView('welcome');
      setPanelView('overview');
      showToast('Carteira regtest criada e cifrada neste navegador.');
    } catch {
      setCreateError('Não foi possível cifrar a carteira neste navegador.');
    }
  };

  const handleConfirmRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    const mnemonic = restorePhrase.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!validateMnemonicPhrase(mnemonic)) {
      setRestoreError('A frase não é uma frase BIP-39 válida.');
      return;
    }
    if (restorePassword.length < 12) {
      setRestoreError('Use uma senha com pelo menos 12 caracteres.');
      return;
    }

    try {
      await deriveAddressFromMnemonic(mnemonic, 0, 0);
      const record = await encryptMnemonic(mnemonic, restorePassword);
      saveStoredWallet(record);
      setStoredRecord(record);
      setUnlockedMnemonic(mnemonic);
      setReceiveIndex(0);
      setRestorePhrase('');
      setRestorePassword('');
      setEntryView('welcome');
      setPanelView('overview');
      showToast('Carteira regtest recuperada neste navegador.');
    } catch {
      setRestoreError('Não foi possível recuperar a carteira de teste.');
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storedRecord) {
      showToast('Não há carteira cifrada neste navegador.');
      return;
    }
    try {
      const mnemonic = await decryptMnemonic(storedRecord, unlockPassword);
      if (!validateMnemonicPhrase(mnemonic)) {
        throw new Error('Invalid recovery phrase');
      }
      setUnlockError('');
      setUnlockPassword('');
      setUnlockedMnemonic(mnemonic);
      setReceiveIndex(typeof storedRecord.receiveIndex === 'number' ? storedRecord.receiveIndex : 0);
      setPanelView('overview');
      showToast('Carteira desbloqueada.');
    } catch {
      setUnlockError('Senha incorreta ou carteira local inválida.');
    }
  };

  const handleLock = () => {
    setUnlockedMnemonic('');
    setUnlockPassword('');
    setUnlockError('');
    setEntryView('welcome');
    showToast('Carteira bloqueada.');
  };

  const handleForgetWallet = () => {
    if (
      !confirm(
        'Apagar a carteira cifrada deste navegador? Você precisará da frase de recuperação para restaurá-la.'
      )
    ) {
      return;
    }
    removeStoredWallet();
    setStoredRecord(null);
    setUnlockedMnemonic('');
    setEntryView('welcome');
    showToast('Carteira local apagada.');
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(currentAddress);
      showToast('Endereço copiado.');
    } catch {
      showToast('Não foi possível copiar o endereço neste navegador.');
    }
  };

  const handleGenerateNextAddress = () => {
    const nextIdx = receiveIndex + 1;
    setReceiveIndex(nextIdx);
    if (storedRecord) {
      const updated = { ...storedRecord, receiveIndex: nextIdx };
      saveStoredWallet(updated);
      setStoredRecord(updated);
    }
    showToast(`Gerado endereço #${nextIdx}`);
  };

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('O nó regtest ainda não está conectado.');
  };

  // Determine page title
  const getPageTitle = () => {
    if (!unlockedMnemonic) {
      if (entryView === 'recovery') return 'Criar carteira';
      if (entryView === 'restore') return 'Recuperar carteira';
      return 'Sua carteira de testes';
    }
    switch (panelView) {
      case 'overview':
        return 'Visão geral da carteira';
      case 'receive':
        return 'Receber BTXC';
      case 'send':
        return 'Enviar BTXC';
      case 'activity':
        return 'Atividade da carteira';
      case 'security':
        return 'Segurança da carteira';
    }
  };

  return (
    <div className="wallet-theme">
      <div className="wallet-app-shell">
        <aside className="wallet-sidebar">
          <button
            type="button"
            className="wallet-brand"
            onClick={onNavigateToPanel}
            aria-label="BitX Core, ir para o painel"
          >
            <span className="wallet-brand-mark" aria-hidden="true">
              BX
            </span>
            <span>
              BITX CORE
              <small>CARTEIRA BTXC</small>
            </span>
          </button>

          <div className="wallet-network-label">
            <span className="wallet-status-dot"></span> REGTEST · TESTES
          </div>

          {unlockedMnemonic && (
            <nav className="wallet-nav" aria-label="Navegação da carteira">
              <button
                type="button"
                className={`wallet-nav-item ${panelView === 'overview' ? 'is-active' : ''}`}
                onClick={() => setPanelView('overview')}
              >
                <span aria-hidden="true">⌂</span> Visão geral
              </button>
              <button
                type="button"
                className={`wallet-nav-item ${panelView === 'receive' ? 'is-active' : ''}`}
                onClick={() => setPanelView('receive')}
              >
                <span aria-hidden="true">↓</span> Receber
              </button>
              <button
                type="button"
                className={`wallet-nav-item ${panelView === 'send' ? 'is-active' : ''}`}
                onClick={() => setPanelView('send')}
              >
                <span aria-hidden="true">↑</span> Enviar
              </button>
              <button
                type="button"
                className={`wallet-nav-item ${panelView === 'activity' ? 'is-active' : ''}`}
                onClick={() => setPanelView('activity')}
              >
                <span aria-hidden="true">↻</span> Atividade
              </button>
              <button
                type="button"
                className={`wallet-nav-item ${panelView === 'security' ? 'is-active' : ''}`}
                onClick={() => setPanelView('security')}
              >
                <span aria-hidden="true">◇</span> Segurança
              </button>
            </nav>
          )}

          <div className="wallet-sidebar-bottom">
            <span>Chaves protegidas neste navegador</span>
            <button type="button" onClick={onNavigateToSite}>
              Site Institucional ↗
            </button>
            <button type="button" onClick={onNavigateToPanel} style={{ color: '#c5ed80', fontWeight: 'bold' }}>
              Painel de Configurações ↗
            </button>
          </div>
        </aside>

        <main className="wallet-main-content">
          <header className="wallet-topbar">
            <div>
              <span className="wallet-eyebrow">PORTAL DO CLIENTE</span>
              <h1>{getPageTitle()}</h1>
            </div>
            {unlockedMnemonic && (
              <button
                type="button"
                className="wallet-button wallet-button-quiet"
                onClick={handleLock}
              >
                Bloquear carteira
              </button>
            )}
          </header>

          <div className="wallet-test-warning" role="status">
            <strong>Ambiente de testes regtest.</strong>
            <span>Os ativos aqui não têm valor. Nunca use uma frase de recuperação de uma carteira real.</span>
          </div>

          <section className="wallet-node-status" aria-live="polite">
            <span className="wallet-status-dot wallet-status-dot-muted"></span>
            <div>
              <strong>Nó BitX não conectado</strong>
              <span>Saldo, histórico e envio ficam indisponíveis até conectar ao nó local regtest.</span>
            </div>
          </section>

          {/* If wallet is locked or not yet open */}
          {!unlockedMnemonic ? (
            <>
              {entryView === 'welcome' && (
                <section className="wallet-welcome-view">
                  <div className="wallet-welcome-copy">
                    <span className="wallet-eyebrow">AUTOCUSTÓDIA</span>
                    <h2>
                      Suas chaves ficam
                      <br />
                      com você.
                    </h2>
                    <p>
                      Crie uma carteira de teste ou recupere uma existente. A frase de recuperação é
                      cifrada no navegador e não é enviada ao servidor.
                    </p>
                  </div>
                  <div className="wallet-options">
                    <button
                      type="button"
                      className="wallet-option-row"
                      onClick={handleStartCreate}
                    >
                      <span className="wallet-option-icon" aria-hidden="true">
                        ＋
                      </span>
                      <span>
                        <strong>Criar carteira</strong>
                        <small>Gerar nova frase de recuperação</small>
                      </span>
                      <span className="wallet-option-arrow" aria-hidden="true">
                        →
                      </span>
                    </button>

                    <button
                      type="button"
                      className="wallet-option-row"
                      onClick={() => {
                        setRestorePhrase('');
                        setRestorePassword('');
                        setRestoreError('');
                        setEntryView('restore');
                      }}
                    >
                      <span className="wallet-option-icon wallet-option-icon-outline" aria-hidden="true">
                        ↗
                      </span>
                      <span>
                        <strong>Recuperar carteira</strong>
                        <small>Usar frase de recuperação existente</small>
                      </span>
                      <span className="wallet-option-arrow" aria-hidden="true">
                        →
                      </span>
                    </button>

                    {storedRecord && (
                      <form className="wallet-unlock-form" onSubmit={handleUnlock}>
                        <label htmlFor="unlockPassword">Desbloquear carteira neste dispositivo</label>
                        <div className="wallet-input-action">
                          <input
                            id="unlockPassword"
                            type="password"
                            autoComplete="current-password"
                            required
                            placeholder="Senha local"
                            value={unlockPassword}
                            onChange={(e) => setUnlockPassword(e.target.value)}
                          />
                          <button type="submit" className="wallet-button">
                            Desbloquear
                          </button>
                        </div>
                        {unlockError && (
                          <p className="wallet-form-error" role="alert">
                            {unlockError}
                          </p>
                        )}
                      </form>
                    )}
                  </div>
                </section>
              )}

              {entryView === 'recovery' && (
                <section className="wallet-recovery-view">
                  <button
                    type="button"
                    className="wallet-back-link"
                    onClick={() => {
                      setPendingMnemonic('');
                      setEntryView('welcome');
                    }}
                  >
                    ← Voltar
                  </button>
                  <span className="wallet-eyebrow">FASE 1 · ANOTE SUA FRASE</span>
                  <h2>
                    Guarde estas palavras
                    <br />
                    em um lugar seguro.
                  </h2>
                  <p className="wallet-section-intro">
                    Elas são a única forma de recuperar sua carteira. Não compartilhe com ninguém e
                    não salve em capturas de tela.
                  </p>

                  <ol className="wallet-seed-words" aria-label="Frase de recuperação de teste">
                    {pendingMnemonic.split(' ').map((word, idx) => (
                      <li key={idx}>
                        <span>{String(idx + 1).padStart(2, '0')}</span>
                        {word}
                      </li>
                    ))}
                  </ol>

                  <label className="wallet-check-row">
                    <input
                      type="checkbox"
                      checked={savedSeedChecked}
                      onChange={(e) => setSavedSeedChecked(e.target.checked)}
                    />
                    <span>Anotei a frase e entendo que ela dá acesso à carteira de teste.</span>
                  </label>

                  <form className="wallet-password-form" onSubmit={handleConfirmCreate}>
                    <label htmlFor="newWalletPassword">Defina uma senha local</label>
                    <input
                      id="newWalletPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      placeholder="Pelo menos 12 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />

                    <label htmlFor="confirmWalletPassword">Confirme a senha</label>
                    <input
                      id="confirmWalletPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      placeholder="Digite novamente"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />

                    {createError && (
                      <p className="wallet-form-error" role="alert">
                        {createError}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="wallet-button wallet-button-primary"
                      disabled={!savedSeedChecked}
                    >
                      Cifrar e abrir carteira
                    </button>
                  </form>
                </section>
              )}

              {entryView === 'restore' && (
                <section className="wallet-restore-view">
                  <button
                    type="button"
                    className="wallet-back-link"
                    onClick={() => {
                      setRestorePhrase('');
                      setRestorePassword('');
                      setRestoreError('');
                      setEntryView('welcome');
                    }}
                  >
                    ← Voltar
                  </button>
                  <span className="wallet-eyebrow">RECUPERAÇÃO LOCAL</span>
                  <h2>Recupere uma carteira regtest.</h2>
                  <p className="wallet-section-intro">
                    A frase é processada neste navegador. Use somente uma frase de teste neste
                    portal.
                  </p>

                  <form className="wallet-password-form" onSubmit={handleConfirmRestore}>
                    <label htmlFor="recoveryPhrase">Frase de recuperação</label>
                    <textarea
                      id="recoveryPhrase"
                      rows={3}
                      autoComplete="off"
                      spellCheck={false}
                      required
                      placeholder="Digite as 12 ou 24 palavras separadas por espaço"
                      value={restorePhrase}
                      onChange={(e) => setRestorePhrase(e.target.value)}
                    />

                    <label htmlFor="restorePassword">Crie uma senha local</label>
                    <input
                      id="restorePassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      placeholder="Pelo menos 12 caracteres"
                      value={restorePassword}
                      onChange={(e) => setRestorePassword(e.target.value)}
                    />

                    {restoreError && (
                      <p className="wallet-form-error" role="alert">
                        {restoreError}
                      </p>
                    )}

                    <button type="submit" className="wallet-button wallet-button-primary">
                      Cifrar e recuperar
                    </button>
                  </form>
                </section>
              )}
            </>
          ) : (
            /* Active Wallet Application Panels */
            <div className="wallet-app">
              {panelView === 'overview' && (
                <div>
                  <div className="wallet-balance-heading">
                    <div>
                      <span className="wallet-eyebrow">SALDO DISPONÍVEL</span>
                      <p className="wallet-balance-value">Aguardando nó</p>
                      <span className="wallet-balance-unit">BTXC · regtest</span>
                    </div>
                    <span className="wallet-balance-mark" aria-hidden="true">
                      BX
                    </span>
                  </div>

                  <div className="wallet-overview-grid">
                    <section className="wallet-content-section">
                      <div className="wallet-section-title">
                        <div>
                          <span className="wallet-eyebrow">CARTEIRA LOCAL</span>
                          <h2>Seu endereço de recebimento</h2>
                        </div>
                        <button
                          type="button"
                          className="wallet-text-button"
                          onClick={() => setPanelView('receive')}
                        >
                          Ver opções →
                        </button>
                      </div>
                      <div className="wallet-address-strip">
                        <code>{currentAddress}</code>
                        <button
                          type="button"
                          className="wallet-icon-button"
                          onClick={handleCopyAddress}
                          aria-label="Copiar endereço"
                          title="Copiar endereço"
                        >
                          ⧉
                        </button>
                      </div>
                      <p className="wallet-helper-text">
                        Endereço derivado localmente da sua carteira (índice #{receiveIndex}). A
                        consulta à rede requer o nó regtest conectado.
                      </p>
                    </section>

                    <section className="wallet-content-section">
                      <div className="wallet-section-title">
                        <div>
                          <span className="wallet-eyebrow">MOVIMENTAÇÕES</span>
                          <h2>Atividade recente</h2>
                        </div>
                        <button
                          type="button"
                          className="wallet-text-button"
                          onClick={() => setPanelView('activity')}
                        >
                          Ver tudo →
                        </button>
                      </div>
                      <div className="wallet-empty-state">
                        <span className="wallet-empty-mark" aria-hidden="true">
                          ↻
                        </span>
                        <strong>Nó ainda não conectado</strong>
                        <p>As transações aparecerão aqui quando o serviço local estiver disponível.</p>
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {panelView === 'receive' && (
                <section className="wallet-detail-section">
                  <span className="wallet-eyebrow">RECEBER BTXC · REGTEST</span>
                  <h2>Endereço da carteira</h2>
                  <p className="wallet-section-intro">
                    Compartilhe somente com quem vai enviar ativos de teste para você.
                  </p>

                  <div className="wallet-receive-address">
                    <code>{currentAddress}</code>
                    <button
                      type="button"
                      className="wallet-button wallet-button-secondary"
                      onClick={handleCopyAddress}
                    >
                      Copiar endereço
                    </button>
                  </div>

                  <div className="wallet-notice">
                    <strong>Aviso:</strong> este endereço pertence à rede regtest. Ativos de outras
                    redes não serão reconhecidos aqui.
                  </div>

                  <button
                    type="button"
                    className="wallet-text-button"
                    onClick={handleGenerateNextAddress}
                  >
                    Gerar próximo endereço (atual: #{receiveIndex}) →
                  </button>
                </section>
              )}

              {panelView === 'send' && (
                <section className="wallet-detail-section">
                  <span className="wallet-eyebrow">ENVIAR BTXC · REGTEST</span>
                  <h2>Enviar ativos de teste</h2>
                  <p className="wallet-section-intro">
                    A assinatura será feita localmente com a chave da carteira. O envio só será
                    habilitado após conectar e validar o nó regtest.
                  </p>

                  <form className="wallet-send-form" onSubmit={handleSendSubmit}>
                    <label htmlFor="sendAddress">Endereço de destino</label>
                    <input
                      id="sendAddress"
                      type="text"
                      autoComplete="off"
                      placeholder="Endereço bxrt1…"
                      value={sendAddress}
                      onChange={(e) => setSendAddress(e.target.value)}
                    />

                    <label htmlFor="sendAmount">Quantidade</label>
                    <div className="wallet-amount-input">
                      <input
                        id="sendAmount"
                        type="number"
                        min="0.00000001"
                        step="0.00000001"
                        placeholder="0,00000000"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                      />
                      <span>BTXC</span>
                    </div>

                    <button className="wallet-button wallet-button-primary" type="submit">
                      Conectar nó para continuar
                    </button>
                  </form>
                </section>
              )}

              {panelView === 'activity' && (
                <section className="wallet-detail-section">
                  <span className="wallet-eyebrow">HISTÓRICO</span>
                  <h2>Atividade da carteira</h2>
                  <div className="wallet-empty-state">
                    <span className="wallet-empty-mark" aria-hidden="true">
                      ↻
                    </span>
                    <strong>Histórico indisponível</strong>
                    <p>
                      Conecte o nó regtest local para consultar transações confirmadas e pendentes.
                    </p>
                  </div>
                </section>
              )}

              {panelView === 'security' && (
                <section className="wallet-detail-section">
                  <span className="wallet-eyebrow">SEGURANÇA LOCAL</span>
                  <h2>Controle da sua carteira</h2>
                  <dl className="wallet-security-list">
                    <div>
                      <dt>Rede</dt>
                      <dd>Regtest · ambiente de teste sem valor monetário</dd>
                    </div>
                    <div>
                      <dt>Derivação</dt>
                      <dd>BIP-84 · m/84'/1'/0' (SegWit Nativo bech32 'bxrt')</dd>
                    </div>
                    <div>
                      <dt>Proteção neste navegador</dt>
                      <dd>Frase cifrada com PBKDF2 e AES-256-GCM (310.000 iterações)</dd>
                    </div>
                    <div>
                      <dt>Chaves privadas</dt>
                      <dd>Não são enviadas ao servidor</dd>
                    </div>
                  </dl>

                  <div className="wallet-notice">
                    <strong>Não use mainnet.</strong> Este portal é experimental, exclusivo para
                    regtest e ainda não foi auditado para proteger ativos reais.
                  </div>

                  <button
                    type="button"
                    className="wallet-button wallet-button-secondary"
                    onClick={handleForgetWallet}
                  >
                    Apagar carteira deste navegador
                  </button>
                </section>
              )}
            </div>
          )}

          {toastMessage && (
            <div className="wallet-toast" role="status">
              {toastMessage}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
