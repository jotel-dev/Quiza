# Deployment & Operations Guide

This guide covers the end-to-end deployment procedures for the **Quiza** protocol across both Stellar Testnet and Stellar Mainnet. It includes smart contract deployment, backend infrastructure provisioning, and frontend static asset delivery.

---

## 1. Smart Contract Deployment (Soroban)

### 1.1. Prerequisites
- `stellar-cli` installed and up to date (`stellar --version` $\ge 22.0$).
- Rust toolchain with `wasm32v1-none` target.
- Funded deployer account on target network.

### 1.2. Building the Contract Binary
Compile the smart contract to an optimized WebAssembly artifact:

```bash
cd contracts/quiza
stellar contract build
```

The output file is located at:
`contracts/quiza/target/wasm32v1-none/release/quiza.wasm`.

### 1.3. Deploying the Wasm to Testnet
Using Stellar CLI with an identity configured in the CLI keystore:

```bash
# 1. Deploy the contract
stellar contract deploy \
  --wasm target/wasm32v1-none/release/quiza.wasm \
  --source deployer \
  --network testnet
```

This returns the contract address (e.g. `CBD7PCUZDB22HJV7LHO4QHRIEZXSWED5OHJ256623PVLT46XGSKSC7IV`). Record this address as `QUIZA_CONTRACT_ID`.

### 1.4. Contract Initialization & Whitelisting
Execute the one-time initialization sequence via CLI or deployment script:

```bash
# 1. Initialize admin, verifier, and stake limits
stellar contract invoke \
  --id $QUIZA_CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin $ADMIN_ADDRESS \
  --verifier $VERIFIER_ADDRESS \
  --min_stake 100000 \
  --max_stake 1000000000

# 2. Add Native XLM to the token allowlist
stellar contract invoke \
  --id $QUIZA_CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- add_token \
  --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

# 3. Add USDC to the token allowlist
stellar contract invoke \
  --id $QUIZA_CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- add_token \
  --token CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA

# 4. Fund initial house liquidity pool for XLM (e.g., 500 XLM = 5,000,000,000 stroops)
stellar contract invoke \
  --id $QUIZA_CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- fund_pool \
  --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --amount 5000000000
```

---

## 2. Backend API Deployment (`apps/api`)

### 2.1. Containerized Docker Deployment
The Fastify backend can be deployed using standard Docker containers to cloud providers such as AWS ECS, Railway, Fly.io, or Google Cloud Run.

#### Example Production `Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api/tsconfig.json ./
COPY apps/api/src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY apps/api/package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY apps/api/src/db/migrations ./dist/db/migrations
COPY apps/api/data ./data

EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### 2.2. PostgreSQL Production Database
- Recommended: AWS RDS (PostgreSQL 16) or Supabase / Neon with automated daily backups and read replicas.
- Configure connection pooling with a maximum of 20 connections per API instance.

### 2.3. Secrets Management
Never write raw secrets to disk or docker images. Supply runtime secrets via AWS Secrets Manager, Doppler, or Kubernetes Secrets:
- `QUIZA_VERIFIER_SECRET_KEY`: Ed25519 seed string (`S...`).
- `DATABASE_URL`: TLS-enabled connection string (`sslmode=require`).
- `ALLOWED_ORIGINS`: Comma-separated list of allowed frontend origins (e.g. `https://quiza.app`).

---

## 3. Frontend Deployment (`src/`)

### 3.1. Building the Static Bundle
```bash
npm run build
```
Vite generates optimized production assets in the `dist/` directory.

### 3.2. Hosting Providers (Cloudflare Pages / AWS S3 + CloudFront / Netlify)
- **Root Directory**: `.`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **SPA Routing**: Single Page Apps require all non-static paths to route to `/index.html`. Ensure hosting rewrites redirect non-asset routes to `index.html`.

---

## 4. Post-Deployment Verification & Smoke Testing

After deploying to a new environment, execute the following smoke verification sequence:

1. **Health Check**: Call `GET https://<api-domain>/health` and verify `rpcConnected: true` and `database.connected: true`.
2. **Challenge Flow Verification**: Request a challenge nonce from `/api/challenge` and verify valid expiration.
3. **Contract State Read**: Query `get_accounting` on the contract using Stellar Expert or CLI to confirm `pool > 0`.
4. **End-to-End Test Round**: Connect a testnet Freighter wallet, stake 1 XLM, submit answers, confirm the verifier resolves on-chain, and verify withdrawal.
