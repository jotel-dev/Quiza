 # Quiza 🧠 — Stake. Play. Win.

> **A real-money trivia dApp on [Stellar](https://stellar.org)** — stake XLM or USDC, answer 10 questions, and get paid out from a **Soroban smart contract**. Non-custodial, fast, and fee-light.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contracts-purple)](https://soroban.stellar.org)
[![Freighter](https://img.shields.io/badge/Wallet-Freighter-orange)](https://freighter.app)

---

## 🌟 Overview

**Quiza** is a fast, mobile-first Web3 trivia game where players stake **XLM** or **USDC** to test their knowledge across Math, Geography, History, and General Knowledge. Score high enough to win back your stake plus progressive bonus payouts, settled on Stellar through a Soroban escrow contract.

Stellar's ~5 second finality and near-zero fees make small-stake gameplay practical, and wallet sign-in through **Freighter** keeps everything **non-custodial**: only public keys (`G...`) are ever stored, and secret keys are never requested.

---

## ✨ Key Features

- 🎮 **Multiple Game Modes**
  - **Stake & Win**: Pick a category and difficulty tier.
  - **Daily Challenge**: 10 fresh questions daily competing for the top global ranking.
  - **Practice Mode**: Risk-free gameplay before staking.
- 💰 **Progressive Multipliers**
  - **7 / 10 Correct**: **1.2x** payout
  - **8-9 / 10 Correct**: **1.5x** payout
  - **10 / 10 Perfect Score**: **2.0x** payout (double your stake!)
- 🔮 **Soroban Escrow Contract**: Stakes are held in a Rust/Wasm contract (`contracts/quiza`) until a round is resolved.
- 🔒 **100% Non-Custodial**: Only public keys are stored. Players sign every stake and withdrawal in Freighter.
- 🔑 **StrKey Validation**: Public key checksums are validated at the API boundary.
- 🛡️ **Timeout Refund Guarantee**: If the backend verifier never resolves a round within 2 hours, players can call `claim_timeout` and reclaim their full stake from the contract.
- 🕵️ **Anti-Cheat Off-Chain Scoring**: Answer keys never leave the backend. Answers are scored server-side and only the result is submitted on-chain.
- 🪄 **Wallet (DID) Sign-In**: Challenge-based Freighter sign-in with single-use, expiring nonces.
- 💸 **Fee-Bump Sponsorship Ready**: Architecture supports Stellar fee-bump transactions so a sponsor can cover fees for new players.
- 🎨 **Dynamic Social Sharing**: Generated share cards (`/api/og`) and preview pages (`/api/share-card`) for X, Telegram, and WhatsApp.
- 🧪 **Automated Test Suite**: Vitest for the API and `cargo test` for the contract.

---

## 🎮 How It Works

```mermaid
sequenceDiagram
    autonumber
    actor Player as 🧑 Player (Freighter)
    participant Contract as 📜 Quiza Contract (Soroban)
    participant Backend as ⚡ Verifier API

    Player->>Contract: stake(token, amount) — signed in Freighter
    Contract-->>Player: Staked event (round_id)
    Backend->>Player: Deliver 10 questions (answers hidden)
    Player->>Backend: Submit answers + round_id + session token
    Backend->>Backend: Score answers off-chain
    Backend->>Contract: resolve(round_id, won, score)
    Contract->>Contract: Credit payout to player balance
    Player->>Contract: withdraw(token) → wallet payout
```

1. **Connect**: Sign in with your Freighter wallet.
2. **Stake**: Choose **XLM** or **USDC** (e.g. 5 XLM).
3. **Play**: Answer 10 randomized trivia questions against the clock.
4. **Win**: Score 7/10 or higher to win up to **2.0x** your stake.
5. **Withdraw**: Winnings accumulate in the contract and are withdrawable any time.

---

## 📜 Smart Contract (Soroban)

The core contract lives in [`contracts/quiza`](contracts/quiza) and manages staking, verifier resolution, balance tracking, and withdrawals. XLM and USDC are both handled through Stellar Asset Contract (SAC) token interfaces.

| Network | Contract ID | Explorer |
|---|---|---|
| **Stellar Testnet** | Set via `QUIZA_CONTRACT_ID` in `.env` | [Stellar Expert (Testnet) ↗](https://stellar.expert/explorer/testnet) |
| **Stellar Mainnet** | _Not deployed yet_ | [Stellar Expert ↗](https://stellar.expert/explorer/public) |

### Core Methods

- `stake(player, token, amount)` — Lock a stake and open a new quiz round.
- `resolve(round_id, won, score)` — Called by the authorized backend verifier to credit winnings using the multiplier tiers.
- `claim_timeout(round_id)` — Refund 100% of the stake if a round stays unresolved for 2 hours.
- `withdraw(player, token)` — Send accumulated winnings to the player's wallet.

---

## 🗂 Project Structure

```
quiza/
├── apps/
│   ├── web/                   # Next.js + React + Tailwind CSS dashboard & game UI
│   └── api/                   # Node.js + Fastify REST API (verifier, leaderboard, share cards)
├── contracts/
│   └── quiza/                 # Soroban smart contract (Rust → Wasm)
├── packages/
│   └── shared/                # Shared TypeScript types & Stellar helpers
├── scripts/
│   ├── deploy-contract.ts     # Build & deploy the contract to Stellar networks
│   ├── fund-verifier.ts       # Fund the verifier account via Friendbot (testnet)
│   └── seed-questions.ts      # Seed question bank into PostgreSQL
├── docs/                      # Architecture & API documentation
├── docker-compose.yml         # Local PostgreSQL
├── CONTRIBUTING.md
├── ROADMAP.md
└── LICENSE
```

---

## 🛠️ Tech Stack

- **Blockchain**: Stellar (Horizon + Soroban RPC), Testnet by default
- **Smart Contracts**: Rust, Soroban SDK, compiled to Wasm
- **Wallet**: Freighter (`@stellar/freighter-api`), `@stellar/stellar-sdk`
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js, TypeScript, Fastify REST API
- **Database**: PostgreSQL (rounds, sessions, leaderboards)
- **Tooling**: Turborepo monorepo, Vitest, Docker Compose

---

## 🚀 Quick Start

### Prerequisites

| Tool             | Version                |
| ---------------- | ---------------------- |
| Node.js          | ≥ 20.x                 |
| npm              | Latest                 |
| Docker           | For local PostgreSQL   |
| Rust + Cargo     | Latest stable (for contracts) |
| Stellar CLI      | Latest                 |
| Freighter Wallet | Browser extension      |

### 1. Clone & Install

```bash
git clone https://github.com/your-username/quiza.git
cd quiza
npm install
```

### 2. Start Local Database

```bash
docker compose up -d
npm run db:push
```

### 3. Configure Environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### 4. Launch the Stack

```bash
npx turbo dev
```

Or run components individually:

```bash
npm run dev:api   # Fastify API on http://localhost:3001
npm run dev:web   # Next.js app on http://localhost:3000
```

### 5. Build & Deploy the Contract (Testnet)

```bash
cd contracts/quiza
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/quiza.wasm \
  --source verifier-dev \
  --network testnet
```

Copy the returned contract ID into `QUIZA_CONTRACT_ID` in both `.env` files.

---

## 🔑 Environment Variables

### Web (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_QUIZA_CONTRACT_ID=your_contract_id
```

### API (`apps/api/.env`)

```env
PORT=3001
DATABASE_URL=postgresql://quiza:quiza_dev@localhost:5432/quiza
JWT_SECRET=replace-with-a-long-random-secret
STELLAR_NETWORK=testnet
HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
QUIZA_CONTRACT_ID=your_contract_id
QUIZA_VERIFIER_PUBLIC_KEY=G...
QUIZA_VERIFIER_SECRET=S...   # server-side only, authorizes resolve() calls
ALLOWED_ORIGINS=http://localhost:3000
```

> ⚠️ The verifier secret is the **only** secret key in the system and belongs to the backend operator. Player secret keys are never requested or stored.

---

## 🧪 Get Testnet XLM

1. Install [Freighter Wallet](https://freighter.app).
2. Switch to **Testnet** in Freighter settings.
3. Fund your public key with [Stellar Friendbot](https://friendbot.stellar.org).
4. Receive 10,000 test XLM instantly.

To fund the verifier account:

```bash
npx tsx scripts/fund-verifier.ts
```

---

## 🧪 Testing

| Suite              | Command                         | Notes                               |
| ------------------ | ------------------------------- | ----------------------------------- |
| API unit tests     | `npm run test:api`              | Vitest                              |
| Web unit tests     | `npm run test:web`              | Component and hook tests            |
| Contract tests     | `cd contracts/quiza && cargo test` | Soroban SDK test environment     |
| Lint               | `npm run lint`                  | ESLint + TypeScript typecheck       |

---

## 📚 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — System design, data flow, and database schema
- **[docs/contract-deployment.md](docs/contract-deployment.md)** — Deploying the Soroban contract
- **[docs/api-documentation.md](docs/api-documentation.md)** — REST API reference
- **[docs/environment-variables.md](docs/environment-variables.md)** — Full variable list and validation rules

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) to get started. All skill levels welcome!

## 🗺 Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features.

## 💬 Community & Support

Join our community to ask questions, chat with maintainers, and follow new releases:

👉 **[Join Quiza on Telegram](t.me/nullifiersystem/1)**

## 📄 License

Released under the [MIT License](LICENSE).