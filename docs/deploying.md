# Deployment Guide: Vercel Frontend & Hosted Fastify API

This guide provides step-by-step instructions for deploying the **Quiza** frontend to **Vercel** and the backend API with PostgreSQL to **Render** (or any container runtime).

---

## 1. Architecture Overview

Quiza operates as a decoupled architecture:
1. **Frontend**: Vite Single Page Application (React 19) hosted as static assets on **Vercel**.
2. **Backend API**: Fastify Node.js server with Stellar SDK & HMAC verification hosted on **Render** (Docker runtime).
3. **Database**: Managed PostgreSQL instance attached to the backend via `DATABASE_URL`.
4. **Smart Contract**: Soroban WASM contract deployed to the **Stellar Testnet / Mainnet**.

The frontend communicates with the backend via `VITE_API_URL` (direct cross-origin HTTPS requests with CORS). No Vercel `/api` rewrites are required.

---

## 2. Backend Deployment (Render)

### Option A: Automatic Deployment via Blueprint (`render.yaml`)
1. Push your branch to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New** > **Blueprint**.
3. Connect your Quiza repository. Render will automatically parse [render.yaml](../render.yaml) to provision:
   - A managed PostgreSQL database (`quiza-db`).
   - A Docker web service (`quiza-api`) using [apps/api/Dockerfile](../apps/api/Dockerfile).
4. Fill in the sensitive environment variables marked with `sync: false` in the Render UI:
   - `QUIZA_ROUND_SECRET`
   - `QUIZA_VERIFIER_SECRET_KEY`
5. Click **Apply**.

### Option B: Manual Web Service Setup
1. Create a **PostgreSQL** database on Render (version 16).
2. Create a **Web Service** pointing to `apps/api/Dockerfile`.
3. Set the Health Check Path to `/health`.
4. Add all environment variables listed in the backend table below.

### Database SSL & Certificate Requirements
- In production (`NODE_ENV=production`), the backend requires `DATABASE_URL` and ensures `sslmode=require` via the URL API without duplicating query strings.
- Certificate validation is **not** globally disabled.
- **Provider CA Guidance**:
  - **Render Managed PostgreSQL / Supabase / Neon**: These use trusted publicly signed certificates (e.g. Let's Encrypt / DigiCert); `sslmode=require` works immediately with no extra CA configuration.
  - **AWS RDS / Aurora**: Uses Amazon's private RDS Certificate Authority. To validate, download the Amazon RDS Global Certificate Bundle (`global-bundle.pem`) and pass `sslrootcert=/path/to/global-bundle.pem` in `DATABASE_URL` or mount the CA bundle in your container.
  - **DigitalOcean Managed Databases**: Downloads a cluster-specific CA cert (`ca-certificate.crt`) from the DO Cloud console. Pass `sslrootcert` to point to the downloaded cert.
  - **Heroku Postgres / Self-Signed Clusters**: If the provider uses self-signed certificates, strict default Node TLS validation will fail unless the custom root certificate is provided.

### Free-Tier Hosting Caveats & Cold Starts
> [!IMPORTANT]
> **Cold Starts on Free Container Hosts**: On free-tier platforms (such as Render Free, Koyeb, or Railway trial), web services automatically spin down after 15 minutes of inactivity. The initial incoming request can take 30 to 60 seconds to spin up the container. While Quiza's frontend `apiFetch` uses 20s timeouts with automatic retry on GET `/api/question-stats` and `/api/leaderboard`, cold starts can still trigger retry attempts. For production or uninterrupted demo experiences, use a persistent plan (e.g., Render Starter at $7/mo) or a periodic uptime ping to keep the service warm.
>
> **PostgreSQL Free-Tier Limits**: Free PostgreSQL tiers frequently enforce strict constraints, including connection caps (typically 20–50 pooled connections), CPU throttling, and automatic database deletion or suspension after 30–90 days (e.g., Render free databases expire after 30 days). Always review your provider's current terms and upgrade to a persistent managed tier for production data.

---

## 3. Frontend Deployment (Vercel)

1. In the [Vercel Dashboard](https://vercel.com/), click **Add New** > **Project** and select your repository.
2. Configure build settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `.`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Configure Environment Variables: Add every variable from the Frontend table below.
4. Deploy the project. Note the production URL (e.g., `https://quiza-alpha.vercel.app`).
5. Ensure `ALLOWED_ORIGINS` on your Render backend includes your exact Vercel URL to allow CORS headers.

---

## 4. Environment Variables Reference

### Frontend Environment Variables (Vercel)

| Variable | Required | Description / Testnet Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | **Yes** | Fully qualified HTTPS URL of your deployed backend (e.g. `https://quiza-api.onrender.com`). |
| `VITE_QUIZA_CONTRACT_ID` | **Yes** | Stellar Soroban contract ID (e.g. `CBD7PCUZDB22HJV7LHO4QHRIEZXSWED5OHJ256623PVLT46XGSKSC7IV`). |
| `VITE_XLM_CONTRACT_ID` | **Yes** | Native XLM Stellar Asset Contract ID (`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` on Testnet). |
| `VITE_USDC_CONTRACT_ID` | **Yes** | USDC Stellar Asset Contract ID on Testnet. |
| `VITE_USDC_ISSUER` | **Yes** | Testnet USDC issuing account (`GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`). |
| `VITE_STELLAR_NETWORK` | **Yes** | `testnet` |
| `VITE_STELLAR_NETWORK_PASSPHRASE` | **Yes** | `"Test SDF Network ; September 2015"` |
| `VITE_HORIZON_URL` | **Yes** | `https://horizon-testnet.stellar.org` |
| `VITE_SOROBAN_RPC_URL` | **Yes** | `https://soroban-testnet.stellar.org` |
| `VITE_USE_CONTRACT_MOCK` | **Yes** | `false` |

### Backend Environment Variables (Render / Container Host)

| Variable | Sensitive | Description / Example |
| :--- | :--- | :--- |
| `NODE_ENV` | No | `production` |
| `PORT` | No | `3001` |
| `HOST` | No | `0.0.0.0` |
| `TRUST_PROXY` | No | `1` (number of reverse proxy hops: default `0` locally, set to `1` on Render or behind reverse proxies for rate limiting by client IP) |
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://user:pass@host:5432/quiza?sslmode=require`). |
| `QUIZA_ROUND_SECRET` | **Yes** | 32+ character random secret used for session challenge HMAC generation. |
| `QUIZA_VERIFIER_SECRET_KEY`| **Yes** | Stellar secret seed (`S...`) for the automated verifier wallet. |
| `QUIZA_VERIFIER_PUBLIC_KEY`| No | Stellar public key (`G...`) for the verifier wallet. |
| `QUIZA_ADMIN_PUBLIC_KEY` | No | Stellar public key (`G...`) for the contract administrator. |
| `QUIZA_CONTRACT_ID` | No | Contract ID (`CBD7...`). |
| `ALLOWED_ORIGINS` | No | Comma-separated allowed CORS origins (e.g. `https://quiza-alpha.vercel.app,http://localhost:5173`). |
| `PUBLIC_BASE_URL` | No | Production frontend origin for social cards (e.g. `https://quiza-alpha.vercel.app`). |
| `STELLAR_NETWORK` | No | `testnet` |
| `STELLAR_NETWORK_PASSPHRASE` | No | `"Test SDF Network ; September 2015"` |
| `HORIZON_URL` | No | `https://horizon-testnet.stellar.org` |
| `SOROBAN_RPC_URL` | No | `https://soroban-testnet.stellar.org` |
