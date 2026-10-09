# Troubleshooting & Diagnostics Guide

This document lists common issues, error codes, and resolution steps encountered when developing, testing, or operating **Quiza**.

---

## 1. Wallet & Stellar Network Issues

### 1.1. Freighter Network Mismatch
- **Symptom**: Console warning: `Freighter network mismatch. Freighter is currently on "public". Please switch Freighter to Testnet.`
- **Cause**: The browser wallet is pointing to Mainnet (Public), but the dApp is configured for Testnet.
- **Solution**:
  1. Open the Freighter extension.
  2. Click the gear icon (**Settings**) in the upper right.
  3. Under **Network**, select **Testnet**.
  4. Refresh the Quiza application.

### 1.2. Account Unfunded on Testnet
- **Symptom**: `Could not load account balances from Horizon (unfunded?)` or `op_no_destination`.
- **Cause**: On Stellar, a newly generated public key does not exist on the ledger until funded with the minimum reserve (1 XLM).
- **Solution**:
  1. Copy your public key (`G...`).
  2. Visit [Stellar Friendbot](https://friendbot.stellar.org/?addr=YOUR_ADDRESS) or click "Fund Testnet Account" in Freighter settings.

### 1.3. USDC Trustline Missing
- **Symptom**: Staking USDC fails with `op_change_trust_malformed` or token transfer fails.
- **Cause**: Classical Stellar assets require a trustline before an account can receive or hold them.
- **Solution**:
  - Quiza's `ensureUsdcTrustline` helper automatically prompts for a `changeTrust` transaction when staking or withdrawing USDC. Approve the Freighter transaction when prompted.

---

## 2. Smart Contract Invocation & Simulation Errors

When calling Soroban methods, simulation may return an error code corresponding to `contracts/quiza/src/lib.rs`:

| Error Code | Name | Cause | Resolution |
| :---: | :--- | :--- | :--- |
| **`1`** | `AlreadyInitialized` | Attempted to call `initialize()` on an already configured contract. | Contract is already operational; skip initialization. |
| **`3`** | `Paused` | Contract is in emergency pause mode. | Admin must invoke `unpause()`. |
| **`7`** | `Unauthorized` | Caller lacks required authorization (`require_auth()`). | Ensure the transaction is signed with the expected player, verifier, or admin key. |
| **`8`** | `AlreadyResolved` | Round has already been resolved or refunded. | Check `get_round(round_id)` or check `get_balance` to see if winnings are available for withdrawal. |
| **`9`** | `TimeoutNotReached` | `claim_timeout` called before 7,200 seconds have elapsed. | Wait until 2 hours from round creation have passed on the ledger before claiming refund. |
| **`10`** | `ZeroBalance` | `withdraw` called when the player has 0 withdrawable balance. | Verify player balance via `get_balance(player, token)` before invoking withdraw. |
| **`11`** | `InsufficientPoolLiquidity` | House pool reserves are insufficient to cover winner's profit. | Admin must deposit house liquidity via `fund_pool(token, amount)`. |
| **`14`** | `StakeExceedsLimit` | Stake amount is greater than `max_stake`. | Reduce stake amount or update limits via `set_stake_limits()`. |
| **`15`** | `StakeBelowLimit` | Stake amount is lower than `min_stake` (default 0.01 XLM). | Increase stake amount. |

---

## 3. Backend & Database Issues

### 3.1. Database Connection Refused (`ECONNREFUSED 127.0.0.1:5432`)
- **Symptom**: Fastify server exits on startup with `error: connect ECONNREFUSED 127.0.0.1:5432`.
- **Cause**: The PostgreSQL Docker container is not running.
- **Solution**:
  ```bash
  docker compose up -d
  # Verify container is running:
  docker compose ps
  ```

### 3.2. Address Already in Use (`EADDRINUSE: 3001` or `5173`)
- **Symptom**: `Error: listen EADDRINUSE: address already in use :::3001`.
- **Cause**: A zombie Node.js process is occupying port 3001 (API) or 5173 (Vite).
- **Solution**:
  ```powershell
  # Windows PowerShell:
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
  ```
  ```bash
  # Linux / macOS:
  lsof -ti:3001 | xargs kill -9
  ```

### 3.3. Session Token Expired / `401 Unauthorized`
- **Symptom**: API returns `{"error": "Session token expired or invalid"}` when submitting answers.
- **Cause**: The 15-minute challenge session token expired during extended gameplay.
- **Solution**:
  - The client in `src/lib/quizaContract.js` automatically detects 401 statuses, clears the in-memory cache, and re-authenticates via a single Freighter signature popup.

---

## 4. Sequence Number Collisions (`txBAD_SEQ`)

- **Symptom**: `Transaction submission error: txBAD_SEQ`.
- **Cause**: Two transactions were submitted concurrently from the same account with the same sequence number.
- **Solution**:
  - The Quiza UI implements an `isBusy` guard disabling buttons while a transaction is in flight. Avoid clicking multiple transaction buttons concurrently in separate browser tabs.
