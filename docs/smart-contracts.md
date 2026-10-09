# Soroban Smart Contract Specification

This document details the architecture, storage models, functions, error codes, and mathematical proofs for the **QuizaContract** implemented in Rust for the Soroban smart contract platform on Stellar.

The smart contract source code is located in [`contracts/quiza/src/lib.rs`](../contracts/quiza/src/lib.rs).

---

## 1. Contract Overview

`QuizaContract` acts as a non-custodial escrow, house liquidity manager, and payout distributor for skill-based trivia rounds.

- **SDK Version**: `soroban-sdk 22.0.0`
- **Target Wasm**: `wasm32v1-none`
- **Compiler**: Rust 1.80+
- **Testnet Contract ID**: `CBD7PCUZDB22HJV7LHO4QHRIEZXSWED5OHJ256623PVLT46XGSKSC7IV`

---

## 2. Storage Layout & Data Structures

The contract utilizes both **Instance Storage** (for global protocol configuration) and **Persistent Storage** (for per-round, per-player, and per-token state).

### 2.1. Data Keys (`DataKey`)

```rust
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,                      // Address (Instance)
    Verifier,                   // Address (Instance)
    IsPaused,                   // bool (Instance)
    NextRoundId,                // u64 (Instance)
    MinStake,                   // i128 (Instance)
    MaxStake,                   // i128 (Instance)
    Round(u64),                 // Round (Persistent)
    Balance(Address, Address),  // i128: (player, token) (Persistent)
    PoolAccounting(Address),    // PoolAccounting: (token) (Persistent)
    TokenAllowed(Address),      // bool: (token) (Persistent)
}
```

### 2.2. Core Structs

#### `Round`
Represents an individual staked trivia round.

```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Round {
    pub player: Address,      // Staking player address
    pub token: Address,       // SAC contract address of the staked asset
    pub amount: i128,         // Staked amount in stroops (7 decimals)
    pub resolved: bool,       // true once resolved or timed out
    pub won: bool,            // true if score >= 7
    pub score: u32,           // Number of correct answers (0 - 10)
    pub created_at: u64,      // Ledger timestamp at staking time
}
```

#### `PoolAccounting`
Tracks the exact 3-pool liquidity state for each supported token.

```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, Default)]
pub struct PoolAccounting {
    pub pool: i128,           // House liquidity available for winning payouts
    pub locked: i128,         // Total stakes in active, unresolved rounds
    pub owed: i128,           // Total player balances pending withdrawal
}
```

---

## 3. Public Method Specifications

### 3.1. `initialize`
Initializes the contract with an admin, an off-chain verifier, and default stake limits.

```rust
pub fn initialize(
    env: Env,
    admin: Address,
    verifier: Address,
    min_stake: i128,
    max_stake: i128,
) -> Result<(), Error>
```
- **Authorization**: None (can only be called once when uninitialized).
- **Default Stake Limits**: `min_stake = 100_000` (0.01 XLM) and `max_stake = 1_000_000_000` (100 XLM).
- **Fails With**: `Error::AlreadyInitialized` if called more than once.

---

### 3.2. `stake`
Locks a player's stake and generates a new round ID.

```rust
pub fn stake(
    env: Env,
    player: Address,
    token: Address,
    amount: i128,
) -> Result<u64, Error>
```
- **Authorization**: `player.require_auth()`.
- **Preconditions**:
  - Contract is not paused (`!is_paused`).
  - Token is in allowlist (`is_token_allowed(token) == true`).
  - `amount >= min_stake` and `max_stake == 0 || amount <= max_stake`.
- **State Changes**:
  - Transfers `amount` tokens from `player` to contract via SAC token client.
  - Updates pool accounting: `locked += amount`.
  - Creates `Round` record with `created_at = env.ledger().timestamp()`.
  - Increments `NextRoundId`.
- **Events Emitted**: `(symbol_short!("staked"), round_id, player)` with payload `(token, amount)`.

---

### 3.3. `resolve`
Resolves an active round with a verified player score and distributes payouts.

```rust
pub fn resolve(
    env: Env,
    round_id: u64,
    won: bool,
    score: u32,
) -> Result<(), Error>
```
- **Authorization**: `verifier.require_auth()`.
- **Preconditions**:
  - `round.resolved == false`.
  - `score <= 10`.
  - `won == (score >= 7)` (enforces score-result consistency).
- **Payout Multipliers**:
  - `score == 10`: **2.0x** (`gross_payout = amount * 200 / 100`)
  - `score >= 8`: **1.5x** (`gross_payout = amount * 150 / 100`)
  - `score >= 7`: **1.2x** (`gross_payout = amount * 120 / 100`)
- **Accounting State Transitions**:
  - If **Won**:
    - Requires `pool >= net_profit` (`net_profit = gross_payout - amount`).
    - `locked -= amount`
    - `pool -= net_profit`
    - `owed += gross_payout`
    - Credits player withdrawable balance: `Balance(player, token) += gross_payout`.
  - If **Lost**:
    - `locked -= amount`
    - `pool += amount`
- **Events Emitted**: `(symbol_short!("resolved"), round_id, player)` with payload `(won, payout, score)`.

---

### 3.4. `claim_timeout`
Emergency refund mechanism allowing a player to recover 100% of their stake if the verifier has not resolved the round within 2 hours.

```rust
pub fn claim_timeout(env: Env, round_id: u64) -> Result<(), Error>
```
- **Authorization**: `round.player.require_auth()`.
- **Preconditions**:
  - `round.resolved == false`.
  - `env.ledger().timestamp() - round.created_at >= 7200` (2 hours).
  - Can be invoked even when the contract is paused.
- **State Changes**:
  - `round.resolved = true; round.won = false;`
  - `locked -= amount`
  - `owed += amount`
  - Credits player balance: `Balance(player, token) += amount`.
- **Events Emitted**: `(symbol_short!("timeout"), round_id, player)` with payload `(token, amount)`.

---

### 3.5. `withdraw`
Transfers accumulated winnings and refunds from the contract to the player's wallet.

```rust
pub fn withdraw(env: Env, player: Address, token: Address) -> Result<i128, Error>
```
- **Authorization**: `player.require_auth()`.
- **Preconditions**:
  - `current_bal > 0`.
- **State Changes**:
  - `Balance(player, token) = 0`
  - `owed -= current_bal`
  - Transfers `current_bal` of `token` from contract to `player` via SAC token client.
- **Events Emitted**: `(symbol_short!("withdraw"), player, token)` with payload `current_bal`.

---

## 4. Admin Methods

| Method | Parameters | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `add_token` | `(token: Address)` | `admin.require_auth()` | Enables a token for staking. |
| `remove_token`| `(token: Address)` | `admin.require_auth()` | Disables a token for new stakes (does not block withdrawals). |
| `fund_pool` | `(token: Address, amount: i128)` | `admin.require_auth()` | Adds house liquidity (`pool += amount`). |
| `withdraw_pool`| `(token: Address, amount: i128)` | `admin.require_auth()` | Withdraws idle house liquidity (`pool -= amount`). |
| `set_verifier` | `(new_verifier: Address)` | `admin.require_auth()` | Rotates the verifier key. |
| `pause` | `()` | `admin.require_auth()` | Pauses new staking rounds. |
| `unpause` | `()` | `admin.require_auth()` | Unpauses staking. |
| `set_stake_limits`| `(min: i128, max: i128)` | `admin.require_auth()` | Updates minimum and maximum stake limits. |

---

## 5. Storage TTL & Rent Strategy

Soroban enforces state expiration to avoid state bloat. `QuizaContract` actively maintains TTL:

- `INSTANCE_TTL_THRESHOLD = 17_280` ledgers (~1 day)
- `INSTANCE_TTL_EXTEND = 518_400` ledgers (~30 days)
- `PERSISTENT_TTL_THRESHOLD = 17_280` ledgers (~1 day)
- `PERSISTENT_TTL_EXTEND = 518_400` ledgers (~30 days)

Every read and write operation triggers `extend_instance_ttl()` and `extend_persistent_ttl()`, ensuring that active rounds and player balances remain unarchived.

---

## 6. Error Reference Table

```rust
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Paused = 3,
    InvalidScore = 4,
    InvalidAmount = 5,
    RoundNotFound = 6,
    Unauthorized = 7,
    AlreadyResolved = 8,
    TimeoutNotReached = 9,
    ZeroBalance = 10,
    InsufficientPoolLiquidity = 11,
    TokenNotAllowed = 12,
    ScoreResultMismatch = 13,
    StakeExceedsLimit = 14,
    StakeBelowLimit = 15,
}
```
