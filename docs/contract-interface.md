# Quiza Soroban Contract Interface Specification

- **Contract Location**: `contracts/quiza`
- **Target Language**: Rust (compiled to `wasm32v1-none` or `wasm32-unknown-unknown`)
- **SDK**: `soroban-sdk = "26.1.1"` (pinned by `stellar-cli 27.0.0`)
- **Compatibility**: Stellar Protocol 22 / Soroban Environment v26
- **Upgradeability**: **Intentionally non-upgradeable** (matching `contracts/Quiza.sol`). Once deployed, contract bytecode is permanent.

---

## 1. Overview & Data Architecture

Quiza on Stellar/Soroban is a non-custodial, escrowed trivia game where players stake tokens (e.g. native XLM via its SAC or USDC) and receive payouts from an escrowed liquidity pool upon solving rounds verified off-chain by the trusted verifier.

### Storage Keys (`DataKey`)

| Key | Storage Type | Description |
|---|---|---|
| `Admin` | Instance | The contract administrator address. |
| `Verifier` | Instance | The trusted server verifier address authorized to resolve rounds. |
| `IsPaused` | Instance | Boolean pause flag. **Blocks only `stake`**; resolve, timeout refunds, and withdrawals are unaffected. |
| `NextRoundId` | Instance | Sequential `u64` round ID counter (starts at 1). |
| `MinStake` | Instance | Minimum allowed stake in base units (`i128`). Default: `1`. |
| `MaxStake` | Instance | Maximum allowed stake in base units (`i128`). `0` = no limit. |
| `Round(u64)` | Persistent | Stored round data: `Round { player, token, amount, resolved, won, score, created_at }`. |
| `Balance(Address, Address)` | Persistent | Player withdrawable balances per token (`(player, token) -> i128`). |
| `PoolAccounting(Address)` | Persistent | Tracked house liquidity, locked stakes, and owed balances (`token -> PoolAccounting`). |
| `TokenAllowed(Address)` | Persistent | Allowlist status for staking/funding tokens (`token -> bool`). |

### Storage TTL Management

Stellar ledgers close approximately every 5 seconds.
- **Instance Storage**: Threshold `17,280` ledgers (~1 day), extended to `518,400` ledgers (~30 days) on every call.
- **Persistent Storage**: Threshold `17,280` ledgers (~1 day), extended to `518,400` ledgers (~30 days) on every read or write of a round or balance.
- **Rationale**: The timeout refund window is 2 hours (1,440 ledgers). A 30-day extension window (`518,400` ledgers) is ~360× larger than the timeout window, ensuring state never expires mid-game.

---

## 2. Pool Accounting & Invariant

Every supported token maintains strict accounting via `PoolAccounting`:

```rust
pub struct PoolAccounting {
    pub pool: i128,   // Available house liquidity for paying out winning multipliers
    pub locked: i128, // Sum of all active, unresolved player stakes
    pub owed: i128,   // Sum of all player balances ready for withdrawal
}
```

### The Solvency Invariant
$$\text{Contract's Real SAC Token Balance} = \text{pool} + \text{locked} + \text{owed}$$

### Accounting State Transitions
1. **`stake(player, token, amount)`**:
   - `locked += amount`
2. **`resolve` (Loss, `won = false`, `score < 7`)**:
   - `locked -= stake`
   - `pool += stake` (house earns player's stake)
3. **`resolve` (Win, `won = true`, `score >= 7`)**:
   - Payout calculation: $\text{gross\_payout} = \lfloor\text{stake} \times \text{multiplier} / 100\rfloor$
   - Net profit: $\text{net\_profit} = \text{gross\_payout} - \text{stake}$
   - Insolvent check: Requires $\text{pool} \ge \text{net\_profit}$, otherwise aborts with `InsufficientPoolLiquidity`
   - `locked -= stake`
   - `pool -= net_profit`
   - `owed += gross_payout`
   - `balance[player][token] += gross_payout`
4. **`claim_timeout(round_id)`**:
   - `locked -= stake`
   - `owed += stake`
   - `balance[player][token] += stake` (100% stake refunded)
5. **`withdraw(player, token)`**:
   - `owed -= balance`
   - `balance[player][token] = 0`
   - Contract transfers `balance` to player wallet.
6. **`fund_pool(token, amount)`**:
   - `pool += amount`
7. **`withdraw_pool(token, amount)`**:
   - Requires $\text{pool} \ge \text{amount}$
   - `pool -= amount`
   - Contract transfers `amount` to admin wallet. `locked` and `owed` are strictly preserved.

---

## 3. Public Method Signatures

### Initialization
```rust
pub fn __constructor(env: Env, admin: Address, verifier: Address);
```
- Sets up `admin` and `verifier` atomically at deployment.
- Initializes `NextRoundId = 1`, `IsPaused = false`, `MinStake = 1`, `MaxStake = 0`.

### Gameplay
```rust
pub fn stake(env: Env, player: Address, token: Address, amount: i128) -> Result<u64, Error>;
```
- **Auth**: `player.require_auth()`.
- **Validation**: Fails if paused (`Paused`), token not allowed (`TokenNotAllowed`), amount $\le 0$ (`InvalidAmount`), amount $<$ min (`StakeBelowLimit`), or amount $>$ max (`StakeExceedsLimit`).
- **Returns**: Unique `round_id` (`u64`).

```rust
pub fn resolve(env: Env, round_id: u64, won: bool, score: u32) -> Result<(), Error>;
```
- **Auth**: `verifier.require_auth()`.
- **Pause Semantic**: **Works while paused**.
- **Validation**:
  - `score <= 10` (or `InvalidScore`)
  - `won == (score >= 7)` (or `ScoreResultMismatch`)
  - Round must exist (`RoundNotFound`) and be unresolved (`AlreadyResolved`).
  - Pool must cover profit (or `InsufficientPoolLiquidity`).
- **Multipliers**:
  - Score $10$: $2.0\times$ ($200\%$)
  - Score $8\text{--}9$: $1.5\times$ ($150\%$)
  - Score $7$: $1.2\times$ ($120\%$)
  - Score $< 7$: Loss ($0\times$, `won = false`)

```rust
pub fn claim_timeout(env: Env, round_id: u64) -> Result<(), Error>;
```
- **Auth**: `round.player.require_auth()`.
- **Pause Semantic**: **Works while paused**.
- **Validation**: Unresolved (`AlreadyResolved`), ledger timestamp $\ge \text{created\_at} + 7200$s (`TimeoutNotReached`).
- **Effect**: Refunds 100% of the original stake to player withdrawable balance.

```rust
pub fn withdraw(env: Env, player: Address, token: Address) -> Result<i128, Error>;
```
- **Auth**: `player.require_auth()`.
- **Pause Semantic**: **Works while paused**.
- **Validation**: Player balance must be $> 0$ (`ZeroBalance`).
- **Effect**: Zeroes player balance, transfers tokens from contract to player wallet, returns amount withdrawn.

### Admin Controls
```rust
pub fn add_token(env: Env, token: Address) -> Result<(), Error>;
pub fn remove_token(env: Env, token: Address) -> Result<(), Error>;
pub fn fund_pool(env: Env, token: Address, amount: i128) -> Result<(), Error>;
pub fn withdraw_pool(env: Env, token: Address, amount: i128) -> Result<(), Error>;
pub fn set_verifier(env: Env, new_verifier: Address) -> Result<(), Error>;
pub fn pause(env: Env) -> Result<(), Error>;
pub fn unpause(env: Env) -> Result<(), Error>;
pub fn set_stake_limits(env: Env, min_stake: i128, max_stake: i128) -> Result<(), Error>;
```
- All require `admin.require_auth()`.
- Removing a token does not prevent players from withdrawing existing balances or claiming timeout refunds.

### View / Read Getters
```rust
pub fn get_round(env: Env, round_id: u64) -> Option<Round>;
pub fn get_balance(env: Env, player: Address, token: Address) -> i128;
pub fn get_accounting(env: Env, token: Address) -> PoolAccounting;
pub fn is_token_allowed(env: Env, token: Address) -> bool;
pub fn get_admin(env: Env) -> Address;
pub fn get_verifier(env: Env) -> Address;
pub fn is_paused(env: Env) -> bool;
pub fn get_stake_limits(env: Env) -> (i128, i128);
```

---

## 4. Contract Error Codes

```rust
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

---

## 5. Events Emitted

All events are emitted via `env.events().publish(...)`:
- **`staked`**: Topics `(Symbol("staked"), round_id, player)`, Data `(token, amount)`
- **`resolved`**: Topics `(Symbol("resolved"), round_id, player)`, Data `(won, payout, score)`
- **`timeout`**: Topics `(Symbol("timeout"), round_id, player)`, Data `(token, amount)`
- **`withdraw`**: Topics `(Symbol("withdraw"), player, token)`, Data `amount`
- **`funded`**: Topics `(Symbol("funded"), admin, token)`, Data `amount`
- **`pool_out`**: Topics `(Symbol("pool_out"), admin, token)`, Data `amount`
- **`tok_add`**: Topics `(Symbol("tok_add"), token)`, Data `()`
- **`tok_rem`**: Topics `(Symbol("tok_rem"), token)`, Data `()`
- **`verifier`**: Topics `(Symbol("verifier"),)`, Data `new_verifier`
- **`pause`**: Topics `(Symbol("pause"),)`, Data `bool`

---

## 6. Phase 3 Integration Notes (Decimals & Formatting)

In Celo/EVM, CELO and cUSD used 18 decimal places with ethers.js formatting helpers (`formatEther`, `parseEther`, `parseUnits`, `formatUnits`).

### Grep Audit of EVM Formatting / 18 Decimals in `src/`:
1. `src/lib/quizaContract.js:20`: `nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 }`
2. `src/lib/quizaContract.js:27`: `nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 }`
3. `src/lib/quizaContract.js:178`: `parseFloat(formatEther(celoBalance)).toFixed(4)`
4. `src/lib/quizaContract.js:179`: `parseFloat(formatUnits(cusdBalance, 18)).toFixed(4)`
5. `src/lib/quizaContract.js:216`: `parseEther(amountInCelo)`
6. `src/lib/quizaContract.js:224`: `parseUnits(amountInCUSD, 18)`
7. `src/pages/Results.jsx:89-90, 101, 130-131, 142, 159`: BigInt `0n` comparisons.

### Stellar Standard:
- Stellar base units have **7 decimal places** (1 XLM = $10^7$ stroops; USDC SAC also standardizes on 7 decimals).
- All contract amounts in Soroban use signed 128-bit integers (`i128`).
- In Phase 3, ethers helpers will be replaced with `@stellar/stellar-sdk` conversion utilities:
  - Stroop / base units to human-readable: `Number(amount) / 10_000_000`
  - Human-readable to base units: `BigInt(Math.round(amount * 10_000_000))`
