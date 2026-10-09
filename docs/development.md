# Local Development & Contributor Guide

This guide walks through setting up a complete local development environment for **Quiza**, including the Fastify backend, Vite frontend, PostgreSQL database, and Soroban smart contract development environment.

---

## 1. Prerequisites & Version Requirements

| Dependency | Minimum Version | Installation Command / Link |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` (LTS) | [nodejs.org](https://nodejs.org/) or via `nvm install 20` |
| **npm** | `>= 10.0.0` | Included with Node.js |
| **Docker & Compose** | Latest | [docker.com](https://www.docker.com/) |
| **Rust & Cargo** | Stable (1.80+) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Wasm32 Target** | `wasm32v1-none` | `rustup target add wasm32v1-none` |
| **Stellar CLI** | `>= 22.0.0` | `cargo install --locked stellar-cli --features opt` |
| **Freighter Wallet** | Browser extension | [freighter.app](https://www.freighter.app/) |

---

## 2. Initial Setup

### 2.1. Clone the Repository
```bash
git clone https://github.com/jotel-dev/Quiza.git
cd Quiza
```

### 2.2. Install Node Dependencies
Install root dependencies and Fastify backend dependencies:
```bash
# 1. Install frontend and toolchain dependencies
npm install

# 2. Install backend Fastify dependencies
npm --prefix apps/api install
```

### 2.3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure the following minimal variables are configured for Testnet development:
```env
# Frontend Vite Variables
VITE_QUIZA_CONTRACT_ID=CBD7PCUZDB22HJV7LHO4QHRIEZXSWED5OHJ256623PVLT46XGSKSC7IV
VITE_XLM_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
VITE_USDC_CONTRACT_ID=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
VITE_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
VITE_STELLAR_NETWORK=testnet
VITE_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_USE_CONTRACT_MOCK=false

# Backend Fastify API Variables
PORT=3001
DATABASE_URL=postgresql://quiza:quiza_dev@localhost:5432/quiza
QUIZA_CONTRACT_ID=CBD7PCUZDB22HJV7LHO4QHRIEZXSWED5OHJ256623PVLT46XGSKSC7IV
QUIZA_VERIFIER_PUBLIC_KEY=GCMKX5CZ4UCWKKUMGQ3WDEJ4AFCNCCJW5R54IWZH7BE6RK6H2KG45QCU
QUIZA_VERIFIER_SECRET_KEY=SDXKNQHYD24GLMXASVWXZ23UZ6XXMCKBDRJ7KM6A6OSZC5YF65KKIEO3
STELLAR_NETWORK=testnet
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

---

## 3. Database Initialization

Launch the local PostgreSQL database using Docker Compose:

```bash
docker compose up -d
```

Verify that the container is healthy:
```bash
docker compose ps
```

The database container runs on `localhost:5432` with username `quiza`, password `quiza_dev`, and database name `quiza`. Migrations in `apps/api/src/db/migrations/` apply automatically when the Fastify API starts up.

---

## 4. Running the Development Stack

### Unified Dev Runner (`npm run dev`)
The repository includes a custom, resilient orchestrator in [`scripts/dev-runner.js`](../scripts/dev-runner.js). It handles Windows PowerShell child process execution, sets proper environment isolation, prefixes stdout/stderr with color-coded tags (`[api]` and `[vite]`), and cleans up all processes on `Ctrl+C`:

```bash
npm run dev
```

Output:
```text
Starting Quiza backend API (port 3001) & Vite frontend (port 5173)...
[api] Fastify server listening on http://0.0.0.0:3001
[vite] VITE v8.1.3 ready in 250 ms
[vite] ➜ Local: http://localhost:5173/
```

### Running Services Independently
If you prefer running frontend and backend in separate terminal tabs:

```bash
# Terminal 1: Backend Fastify API
npm --prefix apps/api run dev

# Terminal 2: Frontend Vite
npm run dev:vite
```

---

## 5. Working with Soroban Smart Contracts

The smart contract workspace is located in [`contracts/quiza`](../contracts/quiza).

### 5.1. Running Rust Contract Tests
```bash
cd contracts/quiza
cargo test
```

### 5.2. Running Clippy Linter
```bash
cd contracts/quiza
cargo clippy --all-targets -- -D warnings
```

### 5.3. Building the Contract WebAssembly Binary
```bash
cd contracts/quiza
stellar contract build
```
The compiled Wasm artifact is output to `target/wasm32v1-none/release/quiza.wasm`.

### 5.4. Deploying to Testnet
```bash
# 1. Generate and fund a throwaway deployer identity
stellar keys generate deployer --fund --network testnet

# 2. Deploy the Wasm binary
stellar contract deploy \
  --wasm target/wasm32v1-none/release/quiza.wasm \
  --source deployer \
  --network testnet
```

---

## 6. Code Formatting & Linting

Before pushing your changes, run our standardized linting tools:

```bash
# 1. Run root Oxlint linter
npm run lint

# 2. Run API integration tests
npm --prefix apps/api test

# 3. Test production bundle build
npm run build
```
