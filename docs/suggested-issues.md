# 10 Curated GitHub Issues for Quiza

This catalog contains 10 production-ready, prioritized GitHub issues for **Quiza**, ready to be created on GitHub or assigned to contributors. Each issue includes labels, component mapping, problem statement, proposed solution, and an actionable acceptance checklist.

---

## Issue 1: Migrate deprecated `env.events().publish` to `#[contractevent]` macro

- **Title**: `[Contract]: Migrate deprecated env.events().publish to #[contractevent] macro`
- **Labels**: `smart-contracts`, `rust`, `enhancement`, `good first issue`
- **Component**: Smart Contract (`contracts/quiza/src/lib.rs`)
- **Difficulty**: Beginner-Friendly / Good First Issue

### Description
In Soroban SDK 22+, calling `env.events().publish()` directly is deprecated and emits 11 compiler warnings during `cargo test`:
```text
warning: use of deprecated method `soroban_sdk::events::Events::publish`: use the #[contractevent] macro on a contract event type
```

### Proposed Solution
Replace untyped `symbol_short!` event tuples with strongly-typed contract event types using the `#[contractevent]` macro:
1. Define event structs:
   - `StakedEvent { round_id: u64, player: Address, token: Address, amount: i128 }`
   - `ResolvedEvent { round_id: u64, player: Address, won: bool, payout: i128, score: u32 }`
   - `TimeoutRefundEvent { round_id: u64, player: Address, token: Address, amount: i128 }`
   - `WithdrawEvent { player: Address, token: Address, amount: i128 }`
   - `PoolFundEvent`, `PoolWithdrawEvent`, `VerifierUpdatedEvent`, `PauseStatusEvent`.
2. Replace call sites with `.publish(&env)` on the typed event instances.

### Acceptance Criteria
- [ ] All `env.events().publish` calls in `contracts/quiza/src/lib.rs` are replaced with `#[contractevent]` structs.
- [ ] `cargo test` passes with **0 warnings**.
- [ ] `cargo clippy -- -D warnings` passes.

---

## Issue 2: Server-Side Historical Round Indexing via Soroban `getEvents` RPC

- **Title**: `[Backend]: Index historical player rounds via Soroban getEvents RPC`
- **Labels**: `backend`, `stellar`, `database`, `enhancement`
- **Component**: Backend Fastify API (`apps/api`)
- **Difficulty**: Intermediate

### Description
As documented in `docs/known-limits.md`, staked rounds are currently recorded in the player's browser `localStorage`. If a player clears their browser data or switches between their phone and desktop, historical unresolved rounds are only discovered through the contract balance fallback.

### Proposed Solution
Build an asynchronous background event poller in `apps/api`:
1. Query `getEvents` on the Soroban RPC for `QuizaContract` event topics (`staked`, `resolved`, `timeout`).
2. Store indexed rounds in a new PostgreSQL table `player_staked_rounds (round_id, player, token, amount, created_at, resolved, won, tx_hash)`.
3. Expose `GET /api/player-rounds?address=G...` returning all historical rounds for that player.
4. Update `Profile.jsx` to fetch from `/api/player-rounds` with local storage as a fallback.

### Acceptance Criteria
- [ ] Migration added for `player_staked_rounds`.
- [ ] Worker polls `getEvents` every 30 seconds and deduplicates events.
- [ ] Endpoint `GET /api/player-rounds` requires valid session token or public address filter.
- [ ] Integration tests verify event ingestion in `apps/api/test/`.

---

## Issue 3: Progressive Web App (PWA) Manifest, Service Worker & Offline Caching

- **Title**: `[Frontend]: Configure PWA manifest, service worker caching, and install prompt`
- **Labels**: `frontend`, `mobile`, `pwa`, `enhancement`
- **Component**: Frontend (`src/`, `vite.config.js`)
- **Difficulty**: Intermediate

### Description
Quiza is designed as a mobile-first Web3 game. Making it installable via Progressive Web App (PWA) standards allows players on iOS Safari and Android Chrome to add Quiza to their home screen with a full-screen, standalone app experience.

### Proposed Solution
1. Add `vite-plugin-pwa` to root `devDependencies`.
2. Configure `manifest.json`:
   - `name`: "Quiza — Web3 Skill Trivia"
   - `short_name`: "Quiza"
   - `theme_color`: "#4F46E5"
   - `background_color`: "#EEF2FF"
   - `display`: "standalone"
   - High-resolution SVG and PNG icons (192px, 512px, maskable).
3. Set up Workbox runtime caching:
   - Cache-First for static font, logo, and audio assets.
   - Network-Only for `/api/*` routes and Soroban RPC queries.
4. Add an install banner component prompting users to install the PWA.

### Acceptance Criteria
- [ ] PWA manifest validated with Lighthouse score $\ge 90$.
- [ ] App is installable on mobile devices.
- [ ] Offline status banner notifies user if connection drops during navigation.

---

## Issue 4: Automated Verifier Gas Reserve Monitoring & Low-Balance Alerting

- **Title**: `[DevOps]: Implement automated verifier wallet gas reserve monitoring & alert`
- **Labels**: `backend`, `devops`, `security`, `enhancement`
- **Component**: Backend Fastify API (`apps/api`)
- **Difficulty**: Intermediate

### Description
The off-chain verifier (`QUIZA_VERIFIER_PUBLIC_KEY`) pays transaction fees for every `resolve()` call on-chain. If this account runs out of native XLM reserves, automated resolution stalls, and rounds risk reaching the 2-hour timeout.

### Proposed Solution
1. Add a scheduled monitoring task in `apps/api/src/stellar/verifier.ts` that runs every 30 minutes.
2. Query Horizon for the native XLM balance of `QUIZA_VERIFIER_PUBLIC_KEY`.
3. If balance drops below **50 XLM**:
   - Log critical alert: `[CRITICAL MONITOR] Verifier XLM reserve below threshold: X XLM remaining`.
   - Dispatch an alert payload via webhook (configurable `DISCORD_WEBHOOK_URL` or `TELEGRAM_ALERT_WEBHOOK`).
   - Surface a warning flag in the `GET /health` endpoint: `{ "stellar": { "verifierLowGas": true } }`.

### Acceptance Criteria
- [ ] Periodic Horizon account balance check implemented.
- [ ] Configurable threshold via `VERIFIER_MIN_BALANCE_XLM` (default: 50).
- [ ] Unit test simulates balance drop and confirms webhook payload dispatch.

---

## Issue 5: Audio Effects & Mobile Haptic Feedback for Trivia Gameplay

- **Title**: `[UX]: Add Web Audio sound effects and vibration haptic cues`
- **Labels**: `frontend`, `ui/ux`, `good first issue`
- **Component**: Frontend (`src/pages/Quiz.jsx`, `src/App.jsx`)
- **Difficulty**: Beginner-Friendly / Good First Issue

### Description
Quiza already includes a mute/unmute toggle in `App.jsx` (`isMuted` state with `Volume2` and `VolumeX` icons), but audio effects are not yet hooked up to game events. Adding subtle audio and tactile haptics will significantly elevate player engagement.

### Proposed Solution
1. Implement a lightweight sound utility `src/lib/soundEffects.js` using the Web Audio API or small audio files:
   - `playCorrect()`: Crisp high-frequency chime.
   - `playIncorrect()`: Low-tone buzzer.
   - `playTimerTick()`: Soft tick for the final 3 seconds.
   - `playVictory()`: Celebratory fanfare on 7+ score.
2. Hook sounds into `src/pages/Quiz.jsx` respecting the `isMuted` prop.
3. Add `navigator.vibrate` calls for mobile devices (50ms pulse for correct, double pulse for incorrect).

### Acceptance Criteria
- [ ] Sounds play appropriately on question answering and round finish.
- [ ] Mute button cleanly silences all audio.
- [ ] Works cleanly on mobile browsers without blocking audio context initialization.

---

## Issue 6: Multi-Signature Admin Key Transition Script for Mainnet

- **Title**: `[Security]: Build multi-signature threshold admin script for mainnet deployment`
- **Labels**: `smart-contracts`, `security`, `phase-5`, `enhancement`
- **Component**: Scripts & Tooling (`scripts/`)
- **Difficulty**: Advanced

### Description
Per `GOVERNANCE.md`, single-key administration is acceptable on Testnet, but Mainnet production requires transitioning `QuizaContract` admin authority to an $M$-of-$N$ threshold multi-signature account to eliminate single points of failure.

### Proposed Solution
Create a reusable TypeScript administration script `scripts/setup-multisig-admin.ts`:
1. Provisions or configures a Stellar multi-signature account with 3 signers and a threshold of 2.
2. Builds and simulates the `set_admin` (or updates admin via contract invocation).
3. Verifies that subsequent admin operations (`set_stake_limits`, `pause`, `fund_pool`) require 2-of-3 signatures.
4. Generates an audit report confirming key weights and thresholds on-chain.

### Acceptance Criteria
- [ ] Script tested on Stellar Testnet.
- [ ] Documentation added to `docs/deployment.md` explaining mainnet multisig ceremony.
- [ ] Dry-run mode (`--dry-run`) supported.

---

## Issue 7: Stellar SEP-0029 Fee-Bump Transaction Sponsorship

- **Title**: `[Protocol]: Implement Stellar fee-bump transaction sponsorship for player gas`
- **Labels**: `protocol`, `stellar`, `onboarding`, `enhancement`
- **Component**: Protocol Integration (`src/lib/quizaContract.js`, `apps/api`)
- **Difficulty**: Advanced

### Description
New players with funded USDC or non-native assets often face friction when they lack native XLM to pay Stellar base fees ($0.00001\text{ XLM}$). Stellar natively supports Fee-Bump Transactions (SEP-0029), where an application sponsor account pays the network fee while the player only authorizes the inner operation.

### Proposed Solution
1. Add an endpoint `POST /api/sponsor-tx` in `apps/api`.
2. The client builds the inner Soroban transaction (`stake` or `claim_timeout`) signed by the player's Freighter wallet with zero/minimal base fee.
3. The backend wraps the transaction with `TransactionBuilder.buildFeeBumpTransaction`:
   - `feeSource`: Sponsor wallet.
   - Signs with the sponsor key.
4. The backend submits the fee-bump transaction to Soroban RPC.

### Acceptance Criteria
- [ ] Players can stake without holding native XLM for gas.
- [ ] Rate limits prevent abuse of the sponsorship pool.
- [ ] Fallback to direct player fee payment if sponsorship fails or exceeds quota.

---

## Issue 8: Question Bank Integrity Linter & Duplicate Checker

- **Title**: `[Tooling]: Add automated question bank integrity validation script`
- **Labels**: `backend`, `testing`, `good first issue`
- **Component**: Tooling (`apps/api/data/questions.json`, `scripts/`)
- **Difficulty**: Beginner-Friendly / Good First Issue

### Description
As the community submits trivia questions, maintaining data integrity is critical. A question with duplicate choices, typos, or an invalid correct answer index directly ruins player rounds.

### Proposed Solution
Create `apps/api/scripts/validate-questions.ts` (runnable via `npm --prefix apps/api run validate:questions` and in CI):
1. Verifies that every question has:
   - Unique `id` string.
   - Non-empty `question` string.
   - Exactly 4 non-empty, unique choices in `options`.
   - Integer `correct` in range $[0, 3]$.
   - Valid category from allowed enum (`General Knowledge`, `Science`, `History`, `Geography`, `Entertainment`, `Sports`).
2. Checks for near-duplicate questions using Levenshtein distance ($> 85\%$ similarity).

### Acceptance Criteria
- [ ] Script added and wired into `npm --prefix apps/api test` or CI pipeline.
- [ ] Currently passes cleanly on `apps/api/data/questions.json`.
- [ ] Fails with descriptive exit code and error list if invalid questions are introduced.

---

## Issue 9: Dynamic Code-Splitting and Lazy Loading for Route Views

- **Title**: `[Performance]: Implement React lazy loading and dynamic chunk splitting`
- **Labels**: `frontend`, `performance`, `optimization`
- **Component**: Frontend (`src/App.jsx`, `vite.config.js`)
- **Difficulty**: Intermediate

### Description
During `npm run build`, Vite produces a bundle warning:
`dist/assets/index-DwtGpS7U.js 1,070 kB - Some chunks are larger than 500 kB after minification`.
Bundling the entire app into a single chunk slows initial mobile page loads.

### Proposed Solution
1. In `src/App.jsx`, replace direct imports of route pages with `React.lazy()`:
   - `const Quiz = React.lazy(() => import("./pages/Quiz.jsx"));`
   - `const Results = React.lazy(() => import("./pages/Results.jsx"));`
   - `const Profile = React.lazy(() => import("./pages/Profile.jsx"));`
   - `const Leaderboard = React.lazy(() => import("./pages/Leaderboard.jsx"));`
2. Wrap `<Routes>` in `<Suspense fallback={<LoadingSpinner />}>`.
3. In `vite.config.js`, configure manual chunk splitting for vendor libraries (`@stellar/stellar-sdk`, `lucide-react`, `framer-motion`).

### Acceptance Criteria
- [ ] Initial bundle size drops below **350 kB** gzip.
- [ ] Build warning `chunk size limit exceeded` is resolved.
- [ ] No regression in route navigation or transition animations.

---

## Issue 10: Interactive Storybook Component Documentation for Design System

- **Title**: `[Docs]: Setup Storybook for Glassmorphism UI tokens and modal components`
- **Labels**: `documentation`, `frontend`, `design-system`, `good first issue`
- **Component**: Frontend (`src/components/`, `.storybook/`)
- **Difficulty**: Beginner-Friendly / Good First Issue

### Description
Quiza uses custom Glassmorphism components (`GlassCard`, `StakeModal`, `ShareModal`, answer selection cards). External frontend contributors currently have to run the entire backend and connect a wallet to preview UI tweaks.

### Proposed Solution
1. Install Storybook for Vite: `npx storybook@latest init --type react`.
2. Create stories for core UI components:
   - `GlassCard.stories.jsx`
   - `StakeModal.stories.jsx`
   - `ShareModal.stories.jsx`
   - Question Choice Card (Neutral, Selected, Correct, Incorrect states).
3. Add a build script `npm run storybook` and document usage in `docs/coding-standards.md`.

### Acceptance Criteria
- [ ] `npm run storybook` launches successfully on `localhost:6006`.
- [ ] Components render with interactive controls for token amount, theme, and score states.
- [ ] No build or lint conflicts with existing Vite configuration.
