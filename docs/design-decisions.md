# Architecture Decision Records (ADRs)

This document records the foundational architectural design decisions, trade-offs, and historical context for **Quiza**.

---

## ADR-001: Migration from EVM (Celo) to Stellar Soroban

### Status: Accepted & Implemented (2026-09)

### Context
Quiza began as an EVM prototype on Celo Alfajores. However, EVM blockchains present drawbacks for high-frequency, micro-stake skill gaming:
1. Gas price volatility and variable confirmation times (12–15 seconds on congested networks).
2. Risk of chain reorgs affecting immediate payout finality.
3. ERC-20 approvals add extra transaction steps and friction for new players.

### Decision
Migrate the core protocol to **Stellar Soroban**:
- Stellar consensus provides deterministic finality in ~4–5 seconds without reorgs.
- Transaction fees are predictable and negligible ($< \$0.0001$).
- Stellar Asset Contracts (SAC) unify classical trustline assets (USDC, XLM) with smart contract invocations without requiring pre-approvals.
- Rust Wasm environment offers formal memory safety and checked arithmetic.

---

## ADR-002: Strict 3-Pool Liquidity Accounting Invariant

### Status: Accepted & Implemented (2026-09)

### Context
A primary risk in escrow-based gaming protocols is insolvency: the smart contract owing more in player payouts and unspent stakes than the real balance it holds in the token contract.

### Decision
Enforce a mathematical invariant across every contract state transition:
$$\text{Real SAC Token Balance} \equiv \text{pool} + \text{locked} + \text{owed}$$

- `locked`: Stakes locked in ongoing rounds.
- `pool`: House liquidity available to cover winnings.
- `owed`: Player balances available for immediate withdrawal.

If any winner resolution would require house liquidity greater than `pool`, the contract fails with `Error::InsufficientPoolLiquidity` rather than becoming insolvent.

---

## ADR-003: Off-Chain Trivia Scoring with Trusted Verifier Resolution

### Status: Accepted & Implemented (2026-09)

### Context
If trivia answer keys or question banks were stored directly on-chain, miners/validators or clever players could inspect the blockchain state or transaction pool (mempool) to look up correct answers in advance, rendering competitive trivia trivial to exploit.

### Decision
Adopt an off-chain scoring model:
1. The question bank and answer keys reside exclusively in the backend PostgreSQL database.
2. The client receives question text and shuffled choices with answer IDs.
3. The player submits answer selections to `/api/verify-round`.
4. The backend evaluates answers against the database, computes the score, and signs a transaction calling `resolve(round_id, won, score)` using its authorized verifier key.

---

## ADR-004: Non-Custodial 2-Hour Timeout Refund Guarantee

### Status: Accepted & Implemented (2026-10)

### Context
Because scoring relies on an off-chain verifier, a server outage, network partition, or malicious operator could theoretically leave a player's stake permanently locked in the contract.

### Decision
Implement `claim_timeout(round_id)` directly in `QuizaContract`:
- If 7,200 seconds (2 hours) have elapsed since round creation and the round remains unresolved, the player can call `claim_timeout` directly from their Freighter wallet.
- The contract unlocks 100% of the stake and credits it to the player's withdrawable balance without requiring backend participation or permission.

---

## ADR-005: SEP-53 Challenge Nonce Authentication with 15-Minute Session Tokens

### Status: Accepted & Implemented (2026-10)

### Context
If `/api/round-questions` and `/api/verify-round` only accepted a plaintext public key (`G...`), any third party observing a public `stake` event on Stellar Expert could query questions and submit intentionally incorrect answers on the victim's behalf (a denial-of-service griefing attack).

### Decision
Implement a challenge-response authentication flow:
1. `GET /api/challenge?address=G...` returns a single-use nonce.
2. The user signs the challenge message using Freighter's `signMessage` (SEP-53 standard).
3. The server validates the cryptographic signature and issues an HMAC-signed, address-bound 15-minute JWT session token.
4. Protected API endpoints reject any request lacking a valid session token bound to the round's staking address.

---

## ADR-006: Two-Step Refund (Claim + Withdraw) with On-Chain Reload Detection

### Status: Accepted & Implemented (2026-10)

### Context
In the Soroban contract, `claim_timeout` moves tokens from `locked` to `owed` inside contract storage; the player must then call `withdraw` to transfer the tokens to their external wallet. If a user claimed the timeout but closed the browser before withdrawing, or rejected the second wallet popup, naive UIs might mark the refund as completed or lose track of the funds.

### Decision
1. Implement a unified `claimRefund` helper executing `claim_timeout` followed immediately by `withdraw`.
2. If `withdraw` fails or is declined, mark the round state as **"Claimed, withdraw pending"** and display a **"Retry Withdraw"** button.
3. On page reload, query `get_balance(player, token)` directly from the contract. If balance $> 0$, automatically recreate the pending withdrawal item in the UI, ensuring funds are never trapped or hidden.
