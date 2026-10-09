# Security Policy

At **Quiza**, security and non-custodial integrity are foundational principles. We take the security of our smart contracts, backend verifier infrastructure, and user funds seriously.

This document describes our security architecture, supported versions, and the process for reporting potential vulnerabilities responsibly.

---

## Supported Versions

Security updates are actively applied to the following components:

| Component | Status | Target Branch | Network |
| :--- | :--- | :--- | :--- |
| **Soroban Smart Contract** (`contracts/quiza`) | Supported | `main` | Stellar Testnet / Mainnet |
| **Fastify Backend API** (`apps/api`) | Supported | `main` | Production / Staging |
| **Frontend Web App** (`src/`) | Supported | `main` | Web Client |

---

## Security Architecture & Threat Model

Quiza enforces a defense-in-depth model across three decoupled layers:

### 1. Non-Custodial Smart Contract Escrow (Soroban)
- **Zero Custody of Player Keys**: The smart contract and backend never store or request player private keys (`S...`). All staking transactions, claims, and withdrawals are signed directly inside the player's Freighter wallet.
- **Checked Arithmetic & Invariant Protection**: The contract verifies the liquidity balance invariant on every transaction:
  $$\text{Contract Balance} == \text{pool} + \text{locked} + \text{owed}$$
  All integer math uses Rust's `checked_*` methods to prevent overflow and underflow vulnerabilities.
- **Fail-Safe Timeout Mechanism**: If the backend verifier experiences prolonged downtime or fails to resolve a round within 2 hours (`7200` seconds), players can call `claim_timeout(round_id)` directly on-chain without backend cooperation to recover 100% of their stake.

### 2. Off-Chain Verifier & Anti-Cheat Protection
- **Zero Client Answer Exposure**: Answer keys are never sent to the browser or mobile client. Questions are served with answer IDs; user submissions are scored strictly server-side.
- **Single-Use Challenge Flow**: Off-chain API requests (`/api/round-questions` and `/api/verify-round`) require an authenticated HMAC session token obtained by signing a single-use nonce via Freighter SEP-53 message signing. Third parties cannot forge round submissions or grief other players' games.

### 3. Server-Side Private Key Security
- **Isolated Verifier Key**: The backend verifier key (`QUIZA_VERIFIER_SECRET_KEY`) has only one permission: invoking `resolve(round_id, won, score)` on the contract. It cannot withdraw house liquidity, upgrade contracts, or touch player funds.
- **Environment Isolation**: Secret keys are injected exclusively via secure runtime environment variables or KMS and are excluded from git, client bundles, and build artifacts.

---

## Reporting a Vulnerability

If you discover a security vulnerability in Quiza, please **do not open a public issue, discussion, or pull request**.

### Coordinated Disclosure Process

1. **Email Report**: Send an encrypted or plain report to:
   - **Primary**: `security@quiza.app`
   - **Maintainer**: `jotelfootball@gmail.com`
2. **Subject Line**: `[SECURITY VULNERABILITY] <Component>: <Brief Summary>`
3. **Required Information**:
   - Detailed description of the vulnerability and attack vector.
   - Proof of Concept (PoC) code or script demonstrating the exploit.
   - Assessment of severity (e.g. fund drainage, denial of service, griefing, spoofing).
   - Any suggested remediations or patches.

### Response Timeline

| Milestone | Target Timeframe |
| :--- | :--- |
| **Initial Acknowledgment** | Within 24 hours |
| **Triage & Severity Assessment** | Within 48 hours |
| **Status Update & Remediation Plan** | Within 5 business days |
| **Public Patch & Disclosure** | After fix deployment (typically 14–30 days) |

We ask researchers to observe coordinated disclosure and allow us a reasonable window to deploy fixes before sharing findings publicly.

---

## Out of Scope

The following items are outside the scope of our security vulnerability program:

- Attacks requiring physical access to a compromised user device or compromised Freighter wallet extension.
- Phishing or social engineering directed at Quiza community members.
- Volumetric Denial of Service (DDoS) against cloud infrastructure.
- Issues in third-party services (e.g., Stellar Horizon / Soroban public RPC testnet downtime).

---

## Recognition & Bounties

We deeply appreciate security researchers who help protect the Quiza ecosystem. Legitimate, responsibly disclosed vulnerabilities that protect player funds or smart contract integrity are eligible for public acknowledgment in our security advisories and discretionary bug bounty rewards.
