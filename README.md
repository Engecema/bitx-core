# BitX Core (BTXC) — Rede Principal & Global Exchange

Aplicação web completa em React com TypeScript e Vite para o ecossistema **BitX Core (BTXC)** em **Rede Principal de Produção (Mainnet)**, com autocustódia BIP-84, mineração Proof-of-Work SHA-256d e integração direta com a corretora **Global Exchange** (Conglomerado Engecema Fomento e Tecnologia).

## Funcionalidades Principais

### 1. Portal de Operações e Mineração PoW (Mainnet)
- **Mineração em Tempo Real**: Suporte para mineração de blocos na Mainnet via Nó Validador Solo ou Pool Stratum da Global Exchange (`stratum+tcp://mining.globalexchange.com:3333`).
- **Fornecimento Máximo**: Teto limite fixado em **1.500.000.000 BTXC** com subsídio Coinbase de 50.00 BTXC por bloco gerado.
- **Explorador de Blocos & Mempool**: Rastreamento de altura da cadeia, hashes PoW SHA-256d, merkle root e transmissão peer-to-peer de transações.
- **Configurador `bitx.conf`**: Configuração do nó para produção com nós seed da rede e gateway da corretora (`mainnet=1`, P2P porta `8333`, RPC porta `8332`).

### 2. Módulo de Integração com a Corretora Global Exchange
- **Gateway de Liquidez & Custódia**: Conexão em tempo real aos nós da corretora Global Exchange.
- **Pares de Negociação Ativos**: Cotação e Livro de Ofertas (*Order Book* com Bids e Asks ao vivo) nos pares `BTXC/BRL`, `BTXC/USDT` e `BTXC/BTC`.
- **Depósitos de Clientes da Corretora**: Hot Wallet institucional (`btxc1qglobal_exchange_hotwallet_liquidity_master01`) com identificação por Tag de Cliente (ex.: `GE-CLIENT-10492`) e confirmação automática em blocos minerados.
- **Negociação Instantânea**: Execução direta de ordens de compra e venda com liquidação na blockchain.

### 3. Carteira de Autocustódia (Client Wallet)
- **Segurança Criptográfica Local**: Autocustódia estrita utilizando derivação BIP-84 no caminho `m/84'/0'/0'` (SegWit Nativo com prefixo `btxc1q...`).
- **Cifragem de Chaves no Navegador**: PBKDF2 (310.000 iterações com SHA-256) e algoritmo autenticado AES-256-GCM.
- **Envio e Recebimento na Mainnet**: Envio de transações com cálculo automático de taxa e atalho rápido de depósito na Global Exchange.

### 4. Site Institucional
- Apresentação corporativa da rede BTXC e da parceria estratégica com a corretora Global Exchange e o conglomerado Engecema Fomento e Tecnologia Ltda.

## Execução Local

```bash
npm install
npm run dev
```

A aplicação roda em `http://localhost:3000`.

## Build para Produção & GitHub Pages

```bash
npm run build
```

Os arquivos estáticos otimizados são gerados na pasta `./dist`.
