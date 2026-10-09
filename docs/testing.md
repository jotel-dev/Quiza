# Comprehensive Testing Strategy

This document details the testing architecture, suites, execution workflows, and formal invariant verifications for **Quiza**.

Testing in a financial smart contract and real-money gaming application must be exhaustive. A single flaw in integer arithmetic, signature parsing, or token accounting can cause loss of user funds or house insolvency.

---

## 1. Testing Pyramid

```text
               ▲
              / \
             /   \      Live Testnet Manual Verification
            /     \     (Freighter E2E wallet signing, real ledger)
           /-------\
          /         \   Backend & Mock Flow Integration Tests
         /           \  (Vitest 41 tests, mock refund reload detection)
        /-------------\
       /               \ Smart Contract Unit & Invariant Tests
      /                 \ (Soroban SDK, Cargo test, 18 suites)
     ---------------------
```

---

## 2. Smart Contract Testing (`contracts/quiza`)

The smart contract test suite is written in Rust using the `soroban-sdk` test environment and lives in [`contracts/quiza/src/test.rs`](../contracts/quiza/src/test.rs).

### 2.1. Executing Contract Tests
```bash
cd contracts/quiza
cargo test -- --nocapture
```

### 2.2. Key Test Scenarios Covered

| Test Function | Invariant / Boundary Tested |
| :--- | :--- |
| `test_stake_basic` | Staking transfers tokens, creates round, and increments `locked` pool |
| `test_payout_tiers` | Correct calculations for 1.2x (score 7), 1.5x (score 8–9), and 2.0x (score 10) |
| `test_pool_accounting_invariant_mixed_scenario` | Mixed sequence of wins, losses, timeout claims, and withdrawals preserving `balance == pool + locked + owed` |
| `test_timeout_refund_success` | Full 100% refund after ledger timestamp advances by $\ge 7,200\text{ s}$ |
| `test_timeout_rejected_before_7200s` | Reverts with `Error::TimeoutNotReached` when $t < 7,200\text{ s}$ |
| `test_claim_timeout_called_twice` | Reverts with `Error::AlreadyResolved` on subsequent claim attempts |
| `test_all_admin_methods_reject_non_admin` | Verifies unauthorized callers cannot pause, unpause, set limits, or withdraw pool |
| `test_pool_underfunded_payout` | Reverts with `Error::InsufficientPoolLiquidity` if winnings exceed house liquidity |
| `test_withdraw_pool_exceeding_balance` | Prevents admin from withdrawing locked player stakes or player winnings |

### 2.3. Testing Without `mock_all_auths()`
To guarantee that `.require_auth()` is properly enforced on production ledgers, our suite explicitly tests authorization failures without using `env.mock_all_auths()`:

```rust
// contracts/quiza/src/test.rs
#[test]
#[should_panic]
fn test_auth_enforced_without_mock_all_auths() {
    let env = Env::default();
    // Intentionally omit env.mock_all_auths()
    let (client, player, token, _) = setup(&env);
    client.stake(&player, &token.address, &100_000); // Must panic with auth failure
}
```

---

## 3. Backend API Testing (`apps/api`)

The backend test suite is written in TypeScript using [Vitest](https://vitest.dev/) and lives in [`apps/api/test/`](../apps/api/test/).

### 3.1. Executing API Tests
```bash
npm --prefix apps/api test
```

### 3.2. Test Suites Overview (41 Tests across 6 Files)

1. **`test/security_and_retry.test.ts` (20 tests)**:
   - Challenge nonce generation, single-use enforcement, and replay prevention.
   - Anti-griefing protection ensuring third parties cannot submit answers for other players.
   - Background retry sweeper and 100-minute critical alerting before 2-hour timeout expiration.
2. **`test/routes.test.ts` (11 tests)**:
   - `/health` endpoint dependencies (DB, RPC, pool status).
   - Question delivery schema validation and answer key sanitization.
   - Rate limiting and bad request handling.
3. **`test/tokens.test.ts` (2 tests)**:
   - HMAC session token expiration, cryptographic tamper resistance, and address binding.
4. **`test/scoring.test.ts` (3 tests)**:
   - Score calculation and tier classification against answer keys.
5. **`test/queue.test.ts` (2 tests)**:
   - Verifier queue concurrency and task deduplication.
6. **`test/strkey.test.ts` (3 tests)**:
   - Stellar StrKey public address checksum validation.

---

## 4. Mock Refund Flow Testing

To verify the complex two-step refund UI without requiring live blockchain transactions on every edit, a specialized mock integration test is maintained in `scratch/test_claim_refund_mock.js`:

```bash
node scratch/test_claim_refund_mock.js
```

### Scenarios Verified:
1. **Full Happy Path**: Both `claim_timeout` and `withdraw` succeed; internal contract balance returns to 0.
2. **Partial Failure Path**: `claim_timeout` succeeds, but `withdraw` is rejected by the player; the UI sets `withdrawPending = true`; on simulated page reload, `getRefundableRounds` detects `get_balance > 0` directly on the contract; user clicks "Retry Withdraw" and settles funds.
3. **Already Resolved Fallback**: If `claim_timeout` was already executed previously, subsequent refund attempts detect existing contract balance and proceed directly to withdrawal.

---

## 5. Live Testnet Manual Verification

Because write transactions (`claim_timeout`, `withdraw`, `stake`) require signatures from the player's private key residing inside the browser's Freighter extension, headless scripts cannot forge write transactions without private keys.

### Manual Verification Checklist:
- [ ] Connect Freighter wallet configured on Stellar Testnet.
- [ ] Verify testnet XLM and USDC balances render correctly in Profile and StakeModal.
- [ ] Stake 0.01 XLM; confirm Freighter popup 1.
- [ ] Play a round, submit answers, and observe verifier resolution on Stellar Expert.
- [ ] Test the refund flow on an unresolved round: approve `claim_timeout`, decline `withdraw`, verify the UI displays **"Claimed, withdraw pending"**, then click **"Retry Withdraw"** to complete the transaction.
