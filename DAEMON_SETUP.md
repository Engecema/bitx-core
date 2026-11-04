# Guia Oficial: Como Subir o Nó Servidor Blockchain (BitX Core Daemon)

Este guia orienta passo a passo como colocar no ar o servidor físico (nó daemon) da rede **BitX Core (BTXC)** e conectá-lo a este portal web e à corretora **Global Exchange**.

---

## Passo 1: Contratar um Servidor VPS Linux
Recomendamos qualquer provedor de nuvem com IP fixo:
* **Hetzner, DigitalOcean, Linode ou AWS**
* **Requisitos Mínimos:**
  * Sistema Operacional: **Ubuntu 22.04 LTS** ou **Ubuntu 24.04 LTS**
  * Memória RAM: Mínimo 2 GB (Recomendado 4 GB)
  * Disco: SSD de 40 GB a 80 GB
  * IP Público IPv4 fixo

---

## Passo 2: Acessar o Servidor e Instalar Dependências
Conecte-se ao seu servidor via SSH:
```bash
ssh root@SEU_IP_DO_SERVIDOR
```

Instale os pacotes básicos necessários para o nó e compilação:
```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y build-essential libtool autotools-dev automake pkg-config \
  bsdmainutils python3 libevent-dev libboost-system-dev libboost-filesystem-dev \
  libboost-test-dev libboost-thread-dev libsqlite3-dev libminiupnpc-dev libzmq3-dev
```

---

## Passo 3: Configurar o Diretório e o Arquivo `bitx.conf`
Crie a pasta de dados da blockchain no servidor:
```bash
mkdir -p ~/.bitx
nano ~/.bitx/bitx.conf
```

Cole a configuração oficial da Mainnet gerada pelo portal:
```ini
# Configuração Oficial do Nó BitX Core (BTXC) - PRODUÇÃO MAINNET
server=1
listen=1
mainnet=1
txindex=1

# Portas de Rede
port=8333
rpcport=8332

# Autenticação RPC para o Portal Web e a Corretora Global Exchange
rpcuser=bitx_mainnet_admin
rpcpassword=btxc_prod_sec_auth_2026!

# Permitir conexões externas seguras
rpcallowip=0.0.0.0/0
rpcbind=0.0.0.0

# Políticas de Mineração e Mempool
minrelaytxfee=0.00001000
fallbackfee=0.00020000
blockmaxweight=4000000
daemon=1
```
Salve o arquivo com `Ctrl + O` e saia com `Ctrl + X`.

---

## Passo 4: Iniciar o Nó Daemon
Inicie o processo do nó da blockchain:
```bash
./bitxd -daemon
```

Para verificar o status da rede e a altura da blockchain pelo terminal:
```bash
./bitx-cli getblockchaininfo
```

---

## Passo 5: Conectar este Site Web ao Nó Físico (Opcional)

> **Nota Importante:**
> A variável `BITX_RPC_HOST` **pode ficar em branco**. Se ela não for informada ou for deixada vazia, a aplicação opera perfeitamente em modo autônomo integrado (com validação criptográfica, mineração PoW local e gestão completa sincronizada da Global Exchange diretamente no navegador e servidor).

Caso você tenha configurado um servidor VPS Linux com o nó daemon físico e queira conectar o portal a ele:
1. No seu ambiente de hospedagem ou arquivo `.env`, preencha a variável:
   * **Key:** `BITX_RPC_HOST`
   * **Value:** `SEU_IP_DO_SERVIDOR` (o IP da sua VPS Linux, ou deixe em branco para modo autônomo)
2. As chamadas RPC na porta `8332` passarão a se comunicar com o processo `bitxd` externo. Se `BITX_RPC_HOST` estiver em branco, todas as funcionalidades continuam operando de forma 100% autônoma e sincronizada!
