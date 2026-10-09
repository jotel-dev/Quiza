# Frequently Asked Questions (FAQ)

---

## 🎮 Player & User Questions

### What is Quiza?
Quiza is a decentralized, skill-based Web3 trivia platform built on the **Stellar** network. Players stake native XLM or USDC, answer 10 randomized trivia questions against the clock, and earn progressive payouts directly from a non-custodial **Soroban smart contract** if they achieve a winning score.

### Is Quiza custodial? Can anyone take my funds?
**No. Quiza is strictly 100% non-custodial.**
- The platform never requests, accesses, or stores your private key (`S...`).
- Staking transactions and withdrawals require your explicit cryptographic approval inside your Freighter wallet.
- Only your public address (`G...`) is stored for leaderboard and session authorization purposes.

### What tokens can I stake?
Quiza supports two premier Stellar assets via Stellar Asset Contracts (SAC):
1. **XLM** (Native Stellar Lumens)
2. **USDC** (Circle USD on Stellar)

### How are payouts calculated?
Payouts follow progressive multiplier tiers based on your final trivia score (out of 10):
- **10 / 10 Correct**: **2.0x** payout (Double your stake!)
- **8 – 9 / 10 Correct**: **1.5x** payout (50% bonus)
- **7 / 10 Correct**: **1.2x** payout (20% bonus)
- **0 – 6 / 10 Correct**: Stake is forfeited to the house liquidity pool.

*Example*: If you stake 10 XLM and score 10/10, the smart contract credits 20 XLM to your withdrawable balance.

### What happens if the backend crashes or the verifier fails to resolve my round?
Your funds are protected by an automated on-chain guarantee!
The contract enforces a 2-hour timeout (`7200` seconds). If a round is not resolved by the backend verifier within 2 hours of creation:
1. Navigate to your **Profile** page under "Unresolved Staked Rounds".
2. Click **Claim Refund**.
3. The contract automatically unlocks 100% of your staked tokens and transfers them back to your wallet. The backend cannot prevent you from claiming your timeout refund.

### Why do I see "Claimed, withdraw pending"?
Refunding a round is a two-step process:
1. `claim_timeout` credits your internal balance inside the contract.
2. `withdraw` transfers the tokens from the contract to your Freighter wallet.

If you approve the first step but reject the second, your funds remain safe in your contract balance. The UI displays **"Claimed, withdraw pending"** with a **Retry Withdraw** button so you can withdraw whenever you are ready.

### Why do I have to sign a message before playing?
Quiza uses **Freighter SEP-53 cryptographic message signing** for session authentication. This signs a single-use random nonce to prove you own the wallet address staking the round. This prevents third-party attackers from guessing your round ID and submitting bad answers to intentionally fail your game (anti-griefing protection).

---

## 💻 Developer & Architecture Questions

### Why is Quiza built on Stellar Soroban?
1. **Predictable Sub-5-Second Finality**: Stellar settles in a single consensus round (~4–5 seconds) without block reorgs or pending mempool delays.
2. **Minimal Transaction Fees**: Staking and withdrawing cost fractions of a cent ($< \$0.0001$), making micro-stakes practical.
3. **Robust Security & Checked Math**: Soroban contracts are compiled from Rust to Wasm, preventing reentrancy vulnerabilities and enforcing strict checked integer arithmetic.
4. **Native Token Standard (SAC)**: Stellar Asset Contracts bridge classical Stellar trustlines and smart contract interfaces natively.

### What is the Core Liquidity Accounting Invariant?
To ensure the house liquidity pool is always solvent and cannot be overdrawn, the Soroban contract enforces the following invariant across every state transition:
$$\text{Real Token Balance in Contract} == \text{pool} + \text{locked} + \text{owed}$$

- `pool`: House liquidity available to fund winnings.
- `locked`: Sum of stakes currently held in active, unresolved rounds.
- `owed`: Sum of player balances available for immediate withdrawal.

If a payout would exceed the pool's available reserves, the transaction aborts with `Error::InsufficientPoolLiquidity`.

### How are answers scored without exposing the answer key?
Quiza uses an off-chain verifier architecture:
1. The frontend fetches questions from the Fastify API. The API strips out correct answers and returns only question text and shuffled choices.
2. The player submits their answer choices to `/api/verify-round`.
3. The backend evaluates answers against the source-of-truth database, calculates the score, and signs an on-chain transaction calling `resolve(round_id, won, score)` using its authorized verifier key.

### How do I run the full stack locally for development?
1. Install Docker and Node.js 20+.
2. Run `docker compose up -d` to launch PostgreSQL.
3. Run `npm install` and `npm --prefix apps/api install`.
4. Run `npm run dev` to start both the Fastify backend (port 3001) and Vite frontend (port 5173).
5. See [docs/development.md](docs/development.md) for full instructions.

### Where are smart contract unit tests located?
The Soroban unit test suite lives in [`contracts/quiza/src/test.rs`](contracts/quiza/src/test.rs) and can be executed via:
```bash
cd contracts/quiza && cargo test
```
The suite includes 18 exhaustive tests verifying admin permissions, timeout thresholds, pool solvency invariants, and replay protections.
