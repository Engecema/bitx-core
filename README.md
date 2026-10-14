# BitX Core (BTXC) - Web App

Aplicação web completa em React com TypeScript e Vite para o ecossistema **BitX Core (BTXC)** em rede Regtest.

## Funcionalidades

### 1. Painel de Controle BitX Core
- **Autenticação Administrativa**: Acesso seguro com credenciais locais (`admin`/`bitx123`) e alternância de visibilidade de senha.
- **Cotação em Tempo Real (Ticker)**: Monitoramento da cotação e variação percentual de 24 horas do BTXC com atualização dinâmica contínua.
- **Transferência Rápida**: Simulação e registro de transferências de BTXC para endereços regtest (`bxrt1q...`) com geração de ID de transação e lista de histórico de transações.
- **Gerenciamento de Acessos**: Cadastro, listagem e remoção de usuários com persistência em armazenamento local e proteção de conta mestre de administrador.
- **Central de Políticas**: Acesso direto às Políticas de Privacidade, Termos de Uso e Política de Cookies.

### 2. Carteira BitX Core (Client Wallet)
- **Autocustódia Estrita**: As chaves privadas nunca saem do navegador e não são transmitidas a servidores.
- **Geração de Frase BIP-39**: Criação de frase mnemônica de recuperação com 12 palavras em padrão internacional.
- **Cifragem Local Segura**: Criptografia da frase com PBKDF2 (310.000 iterações com SHA-256) e algoritmo autenticado AES-256-GCM.
- **Derivação BIP-84**: Derivação hierárquica determinística no caminho `m/84'/1'/0'` para endereços nativos SegWit com prefixo `bxrt1...`.
- **Visão Geral**: Consulta de saldo regtest e visualização com cópia rápida do endereço atual.
- **Recebimento e Geração Sequencial**: Cópia do endereço regtest e geração sequencial de novos endereços determinísticos.
- **Envio de Teste**: Formulário de envio com validação de endereço e quantidade em BTXC.
- **Histórico e Segurança**: Detalhes técnicos da derivação de chaves e opção de exclusão definitiva da carteira do navegador.

## Execução

```bash
npm install
npm run dev
```

A aplicação roda em `http://localhost:3000`.
