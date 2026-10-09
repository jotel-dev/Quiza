# Coding Standards & Guidelines

To ensure the Quiza codebase remains robust, maintainable, and aligned with open-source infrastructure projects like Kubernetes, Rust, and Stellar, all contributors must adhere to these coding standards.

---

## 1. General Principles

1. **Explicit Over Implicit**: Write readable, predictable code. Avoid hidden side-effects, implicit type coercions, or overly clever abstractions.
2. **Defensive Programming**: Validate every boundary input (HTTP requests, URL params, contract arguments, wallet responses). Never assume external services will return well-formed data.
3. **Fail Fast with Actionable Errors**: Throw descriptive errors early rather than silently propagating invalid states.
4. **Preserve Accounting Invariants**: Any line of code affecting financial balances must be accompanied by mathematical invariant verification.

---

## 2. TypeScript & JavaScript Standards

### 2.1. Type Safety
- **No `any`**: Explicitly type all variables, function arguments, and return types. Use `unknown` with runtime type narrowing if the type is truly dynamic.
- **Zod for External Validation**: Every API payload entering the Fastify server must be validated with a strict Zod schema:
  ```typescript
  export const RoundQuestionsBodySchema = z.object({
    roundId: z.string().min(1),
    type: z.enum(["practice", "standard", "daily"]),
    category: z.string().optional(),
    difficulty: z.string().optional(),
    walletAddress: z.string().min(56).max(56),
    sessionToken: z.string().optional(),
  });
  ```

### 2.2. React 19 & Frontend Code
- **Functional Components Only**: Class components are forbidden.
- **Hook Rules**: Keep hooks at the top level of components. Clean up timers and event listeners in `useEffect` return callbacks to prevent memory leaks.
- **Strict Styling Parity**:
  - Always reuse existing design tokens in `tailwind.config.js` and established component classes.
  - Never introduce new ad-hoc colors, arbitrary inline hex styles, or foreign styling libraries.
  - Before introducing a new button or badge class, verify if an equivalent exists in `Leaderboard.jsx` or `Profile.jsx`.

### 2.3. Asynchronous Error Handling
- Use `async/await` with `try...catch` blocks.
- Never write empty catch blocks (`catch (e) {}`) without an explicit comment explaining why the error is safely ignorable.
- Normalize contract errors using `mapContractError()` in `src/lib/stellar.js`.

---

## 3. Rust & Soroban Smart Contract Standards

### 3.1. Formatting & Linting
- All Rust code must pass `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings`.
- No compiler warnings are permitted in pull requests.

### 3.2. Checked Arithmetic
- **Zero Raw Math**: In financial logic, raw operators (`+`, `-`, `*`, `/`) are forbidden because integer overflow or division by zero will panic and halt contract execution.
- Always use checked methods:
  ```rust
  let gross_payout = round
      .amount
      .checked_mul(multiplier)
      .ok_or(Error::InvalidAmount)?
      .checked_div(MULTIPLIER_BASIS)
      .ok_or(Error::InvalidAmount)?;
  ```

### 3.3. Authorization & Access Control
- Explicitly call `.require_auth()` at the beginning of each mutating method for the relevant identity (`player`, `admin`, or `verifier`).
- Never rely on caller assumptions without cryptographic proof.

### 3.4. State TTL Management
- Every persistent read or write must call `extend_persistent_ttl()` to maintain ledger storage rent and prevent unexpected state archival.

---

## 4. File Organization & Naming Conventions

| Language / Entity | Naming Convention | Example |
| :--- | :--- | :--- |
| **Rust files** | `snake_case.rs` | `contracts/quiza/src/lib.rs` |
| **Rust structs/enums**| `PascalCase` | `PoolAccounting`, `DataKey` |
| **TypeScript files** | `kebab-case.ts` | `apps/api/src/routes/round-questions.ts` |
| **React Components** | `PascalCase.jsx` | `src/pages/Profile.jsx` |
| **Constants** | `UPPER_SNAKE_CASE`| `TIMEOUT_SECONDS`, `STROOP_SCALE` |
| **Database Migrations**| `00X_snake_case.sql` | `001_init.sql` |
