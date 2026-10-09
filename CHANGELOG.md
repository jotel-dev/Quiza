# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Mainnet Soroban contract deployment.
- Decentralized multi-node verifier consensus.
- Stellar Fee-Bump transaction sponsorship for zero-gas player onboarding.
- Progressive Web App (PWA) offline caching for mobile browsers.

---

## [2.0.0] - 2026-10-09

### Added
- **Soroban Smart Contract**: Complete migration from legacy Celo EVM to Rust-based Soroban smart contract on Stellar (`contracts/quiza`).
  - Implemented 3-pool liquidity accounting invariant: `contract_balance == pool + locked + owed`.
  - Added support for Stellar Asset Contract (SAC) native XLM and testnet USDC tokens.
  - Implemented multiplier payout tiers: 1.2x (score ≥ 7), 1.5x (score ≥ 8), and 2.0x (score = 10).
  - Added fail-safe `claim_timeout` allowing players to reclaim stakes if unresolved after 2 hours (7,200 seconds).
  - Added full test coverage suite with 18 unit and snapshot test cases in `contracts/quiza/src/test.rs`.
- **Fastify Backend API**: High-performance Node.js / TypeScript API in `apps/api`:
  - PostgreSQL schema migrations for player sessions, nonces, and verifier queue tracking.
  - Freighter SEP-53 challenge-nonce signature authentication (`/api/challenge` and `/api/session`) returning 15-minute address-bound HMAC session tokens.
  - Anti-griefing protection preventing third-party unauthorized answer submission.
  - Off-chain verifier worker queue with automated retry and 100-minute resolution warning sweeper.
- **Two-Step Refund & Reload Detection**:
  - Implemented `claimRefund` helper in `src/lib/quizaContract.js` combining on-chain timeout claim with immediate withdrawal.
  - Added reload detection in `Profile.jsx` checking `get_balance > 0` directly on the contract to surface pending withdrawals.
  - Added "Retry Withdraw" UI button reusing existing styles and disabling concurrent in-flight transactions.
- **Architectural Documentation**: Added `docs/contract-interface.md`, `docs/known-limits.md`, and complete open-source governance guidelines.

### Changed
- Migrated frontend wallet connection from wagmi/viem/MetaMask to `@stellar/freighter-api` and `@stellar/stellar-sdk`.
- Replaced Express mock server with unified Fastify backend runner (`scripts/dev-runner.js`).
- Migrated question bank into `apps/api/data/questions.json` with comprehensive category distribution.

### Deprecated
- Legacy Celo EVM contracts (`contracts/Quiza.sol`) and Firebase admin services.

---

## [1.0.0] - 2026-07-04

### Added
- Initial Proof of Ship Season 2 prototype.
- Real-time trivia game loop with 10 questions across Geography, History, Math, and General Knowledge.
- Basic staking modal and match history UI.
- Initial Celo Alfajores testnet contract deployment.
