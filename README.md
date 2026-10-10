# Quiza 🧠 — Stake. Play. Win.

> **High-throughput, non-custodial Web3 skill gaming on [Stellar](https://stellar.org)**. Stake XLM or USDC, test your knowledge in 10 fast-paced trivia questions, and claim progressive payouts directly from a **Soroban smart contract**. Zero custody, sub-5-second finality, and negligible fees.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-000000.svg)](https://fastify.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Stellar Testnet](https://img.shields.io/badge/Stellar-Testnet-08B5E5.svg)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-Rust%20Wasm-purple.svg)](https://soroban.stellar.org)
[![Freighter](https://img.shields.io/badge/Wallet-Freighter%20(Session%20Signing)-orange.svg)](https://freighter.app)
[![Security Status](https://img.shields.io/badge/Security-Unaudited%20%7C%20Testnet%20Only-red.svg)](#-security--testnet-notice)

---

> ⚠️ **Security & Testnet Notice**: Quiza is currently deployed on the **Stellar Testnet** for testing, evaluation, and demonstration purposes only. The smart contracts are **unaudited**. Do not risk real mainnet funds. **Public contract IDs only** are published below; no private keys or secrets (`S...`) are ever stored or committed to this repository.

---

## 🌟 Executive Overview

**Quiza** is an open-source decentralized trivia platform engineered for fast, mobile-friendly competitive gaming on the Stellar blockchain. Players stake native **XLM** or **USDC** across categories including Mathematics, Geography, History, and General Knowledge. Achieving 7 or more correct answers unlocks payouts up to **2.0x** funded from an automated house liquidity pool managed entirely by a Soroban smart contract.

### Architectural Highlights

- 🔒 **100% Non-Custodial & Session Signing**: Player secret keys (`S...`) are never requested or stored. All transactions and session challenges are signed directly inside the player's Freighter wallet extension using SEP-53 message signing with single-use nonces and 15-minute expiring session tokens (no repetitive popups for answering questions).
- 💾 **Dual Database Engine**: Fastify API in `apps/api` runs on **PGlite** locally (in-process WASM PostgreSQL with zero configuration or Docker required) and connects to PostgreSQL via `DATABASE_URL` in production.
- 📜 **Soroban Smart Contract**: Written in Rust in `contracts/quiza`, enforcing strict liquidity accounting invariants and mathematical payout bounds.
- 📐 **Strict Liquidity Accounting Invariant**: Real token balances in the contract are mathematically bounded at all times:
  $$\text{Contract Balance} == \text{pool} + \text{locked} + \text{owed}$$
- 🛡️ **Guaranteed Timeout Refund**: If a round remains unresolved after 2 hours (7,200 seconds), players can call `claim_timeout` directly on-chain to reclaim 100% of their stake without backend assistance.
- 🕵️ **Anti-Cheat Off-Chain Scoring**: Trivia question answer keys never leave the server. Player answer selections are evaluated by the backend verifier, which signs and submits the on-chain settlement.
- ⚡ **Sub-5-Second Settlement**: Native Stellar consensus ensures near-instant settlement without block reorgs.

---

## 🎮 Game Modes & Multiplier Tiers

| Game Mode | Mechanics | Target Audience |
| :--- | :--- | :--- |
| **Stake & Win** | Choose token (XLM / USDC), category, and stake amount. 10 timed questions. | Competitive players seeking crypto payouts |
| **Daily Challenge** | 10 synchronized daily questions. Global daily leaderboard competition. | Daily active users & community ranking |
| **Practice Mode** | Free-play mode without wallet popups or signatures. | Newcomers exploring gameplay |

### Payout Multipliers

| Final Score (out of 10) | Payout Multiplier | Net Profit |
| :--- | :--- | :--- |
| **10 / 10 (Perfect)** | **2.0x** | **+100%** (Double your stake) |
| **8 – 9 / 10** | **1.5x** | **+50%** |
| **7 / 10** | **1.2x** | **+20%** |
| **0 – 6 / 10** | **0.0x** | Stake retained in house liquidity pool |

---

## 🏗️ System Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Player as 🧑 Player (Freighter Wallet)
    participant UI as 🖥️ Vite Frontend (React 19)
    participant API as ⚡ Fastify Backend (Port 3001)
    participant DB as 💾 Database (PGlite / PostgreSQL)
    participant Contract as 📜 QuizaContract (Soroban Testnet)

    Note over Player,UI: 1. Authentication & Staking
    Player->>Contract: stake(player, token, amount) [Signed in Freighter]
    Contract-->>Player: RoundOpened (round_id)
    Player->>API: GET /api/challenge?address=G...
    API-->>Player: Challenge Nonce
    Player->>Player: Sign nonce via Freighter SEP-53
    Player->>API: POST /api/session (address, nonce, signature)
    API-->>Player: 15-min HMAC Session Token

    Note over Player,API: 2. Gameplay & Off-Chain Scoring
    Player->>API: POST /api/round-questions [Bearer Token]
    API->>DB: Fetch 10 questions (answers hidden)
    API-->>Player: Deliver 10 questions
    Player->>API: POST /api/verify-round [Bearer Token]
    API->>API: Score answers against source-of-truth bank
    
    Note over API,Contract: 3. Settlement & Payout
    API->>Contract: resolve(round_id, won, score) [Signed by Verifier]
    Contract->>Contract: Update Invariant (locked -= stake, owed += payout)
    Contract-->>API: RoundResolved Event
    API-->>Player: Final Score, Payout Status & Tx URL
    
    Note over Player,Contract: 4. Non-Custodial Withdrawal
    Player->>Contract: withdraw(player, token) [Signed in Freighter]
    Contract->>Player: Transfer token payout to player wallet
```

---

## 🗂 Monorepo Layout

```text
quiza/
├── apps/
│   └── api/                   # Fastify + TypeScript backend API (PGlite locally, PostgreSQL in prod)
│       ├── src/               # Routes, challenge auth, worker queue, retry sweeper
│       ├── test/              # Vitest API integration & security test suite
│       └── Dockerfile         # Production container definition for Render / Railway
├── contracts/
│   └── quiza/                 # Soroban Rust smart contract (contracts/quiza)
│       ├── src/lib.rs         # Staking, accounting invariant, timeout, withdrawal
│       ├── src/test.rs        # Comprehensive Soroban SDK test suite
│       └── Cargo.toml         # Contract dependencies & compiler flags
├── docs/                      # Technical documentation & architecture guides
│   ├── deploying.md           # Production deployment guide (Vercel + Render / PostgreSQL)
│   ├── contract-interface.md  # Detailed Soroban contract specifications & error codes
│   ├── architecture.md        # Deep dive into system components & data flows
│   ├── smart-contracts.md     # Soroban contract API, storage layout & invariants
│   ├── api.md                 # REST API endpoints, schemas & authentication
│   ├── mobile.md              # Responsive layout & Freighter mobile roadmap
│   ├── development.md         # Local development setup & dev-runner guide
│   ├── testing.md             # Vitest, Cargo, and mock testing guides
│   ├── troubleshooting.md     # Common error diagnostics & solutions
│   ├── coding-standards.md    # Style guides, linting, and error handling
│   ├── design-decisions.md    # Architecture Decision Records (ADRs)
│   └── known-limits.md        # Documented protocol constraints
├── src/                       # Vite + React 19 frontend application
│   ├── components/            # UI components (StakeModal, ShareModal, Navbar)
│   ├── lib/quizaContract.js   # Soroban RPC client, Freighter bridge, timeout recovery
│   └── pages/                 # Views (Home, Quiz, Results, Profile, Leaderboard)
├── scripts/                   # Development orchestrator & deployment scripts
│   └── dev-runner.js          # Concurrent Fastify + Vite process runner
├── .github/                   # CI/CD workflows, issue templates, community files
├── CONTRIBUTING.md            # Contributor onboarding & PR conventions
├── CODE_OF_CONDUCT.md         # Contributor Covenant v2.1
├── SECURITY.md                # Security policy & coordinated disclosure process
├── GOVERNANCE.md              # Project governance & RFC lifecycle
├── CHANGELOG.md               # Keep a Changelog version history
├── ROADMAP.md                 # Technical milestones & future phases
├── SUPPORT.md                 # Support channels & community guidelines
├── FAQ.md                     # Comprehensive player and developer FAQ
├── LICENSE                    # MIT License
└── package.json               # Root scripts and workspace dependencies
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

| Tool | Version Requirement | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` (LTS) | Frontend and Backend runtime |
| **npm** | `>= 10.0.0` | Package manager |
| **Freighter Wallet** | Browser extension | Stellar Testnet non-custodial wallet |
| **Rust & Cargo** | Stable (1.80+) *(Optional)* | Building Soroban contract in `contracts/quiza` |
| **Stellar CLI** | `>= 22.0.0` *(Optional)* | Testing and deploying Soroban contract |

> **💡 Zero Database Setup Locally**: `apps/api` automatically initializes an embedded **PGlite** (in-process WASM PostgreSQL) instance in development. You do **not** need Docker or an external PostgreSQL database running locally. In production, configure `DATABASE_URL` pointing to PostgreSQL.

### 1. Clone & Install

```powershell
# Clone the repository
git clone https://github.com/jotel-dev/Quiza.git
cd Quiza

# Install root dependencies and API dependencies
npm install
npm --prefix apps/api install
```

### 2. Configure Environment

Copy the example configuration to `.env`:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**
```bash
cp .env.example .env
```

### 3. Start Development Servers

Run both the Fastify backend and Vite frontend concurrently via the unified runner:

**Windows (PowerShell) / Cross-Platform:**
```powershell
npm run dev
```

- **Frontend Web UI**: [http://localhost:5173](http://localhost:5173)
- **Backend Fastify API**: [http://localhost:3001](http://localhost:3001)
- **Health Check**: [http://localhost:3001/health](http://localhost:3001/health)

---

## 🧪 Testing & Quality Assurance

Quiza enforces automated testing across all layers:

```powershell
# 1. Run Root Frontend & Client Recovery Tests (Vitest)
npm test

# 2. Run Backend API Integration & Security Tests (Vitest)
npm --prefix apps/api test

# 3. Run Frontend Production Build & Oxlint Linter
npm run lint
npm run build

# 4. Run Soroban Smart Contract Tests (Cargo)
cd contracts/quiza ; cargo test ; cd ../..

# 5. Run Soroban Clippy Linter
cd contracts/quiza ; cargo clippy -- -D warnings ; cd ../..
```

---

## 📜 Deployed Smart Contracts (Stellar Testnet)

> ⚠️ **Testnet-Only & Unaudited**: Quiza is deployed strictly on the **Stellar Testnet** for evaluation and demonstration purposes. Smart contracts are unaudited. **Public contract IDs only are listed below—no private keys or secrets are ever stored in this repository.**

| Network | Contract Identifier | Explorer |
| :--- | :--- | :--- |
| **Stellar Testnet (Quiza)** | `CBD7PCUZDB22HJV7LHO4QHRIEZXSWED5OHJ256623PVLT46XGSKSC7IV` | [Stellar Expert (Testnet) ↗](https://stellar.expert/explorer/testnet/contract/CBD7PCUZDB22HJV7LHO4QHRIEZXSWED5OHJ256623PVLT46XGSKSC7IV) |
| **Native XLM (SAC)** | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | [Stellar Expert (Testnet) ↗](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |
| **USDC (SAC)** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | [Stellar Expert (Testnet) ↗](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) |

- **Contract Specification**: Detailed interface methods, accounting invariant, and refund mechanics are documented in [docs/contract-interface.md](docs/contract-interface.md).
- **Deployment Guide**: Production deployment on Vercel and Render/PostgreSQL is documented in [docs/deploying.md](docs/deploying.md).

---

## 🤝 Contributing

We welcome contributions from open-source developers worldwide! Please review our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting pull requests.

---

## 💬 Community & Support

- **Telegram Community**: [https://t.me/nullifiersystem/1](https://t.me/nullifiersystem/1)
- **GitHub Discussions**: [Ask questions & discuss RFCs](https://github.com/jotel-dev/Quiza/discussions)
- **Support & Triage**: See [SUPPORT.md](SUPPORT.md)
- **Security Inquiries**: Email `security@quiza.app` (See [SECURITY.md](SECURITY.md))

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).