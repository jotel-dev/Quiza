# Mobile Experience & Web3 Wallet Integration

This document outlines the mobile engineering strategy, viewport design rules, wallet compatibility matrix, and Progressive Web App (PWA) roadmap for **Quiza**.

---

## 1. Mobile-First Design Philosophy

Quiza is engineered primarily for mobile gameplay. High-stakes trivia requires split-second reactions, meaning interface elements must be ergonomically optimized for single-thumb navigation on iOS and Android devices.

### 1.1. Touch Targets & Ergonomics
- **Touch Target Size**: All interactive buttons, answer tiles, and modals adhere to a minimum touch target size of **$48 \times 48\text{ px}$** (exceeding Apple HIG and Material Design standards of $44\text{ px}$).
- **Thumb Zone Optimization**: Primary action buttons ("Claim Refund", "Submit Answers", "Connect Wallet") are anchored in the lower half of the viewport within natural thumb reach.
- **Font & Hierarchy**: Text scales fluidly using Tailwind's responsive typography utilities, ensuring legibility on screen widths as narrow as $320\text{ px}$ (iPhone SE) up to large tablets and desktop displays.

### 1.2. Viewport & Scrolling Management
- Viewport configuration in `index.html`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  ```
- **Virtual Keyboard Handling**: Input fields in modals dynamically adjust scroll offsets to prevent iOS Safari auto-zoom glitches.
- **Pull-to-Refresh Suppression**: During timed trivia rounds, native overscroll and pull-to-refresh gestures are temporarily disabled to prevent accidental page reloads.

---

## 2. Web3 Wallet Compatibility Matrix

Stellar dApps interact with wallets through varying protocols depending on whether the user is on desktop or mobile:

| Platform / Environment | Wallet Solution | Integration Protocol | Status |
| :--- | :--- | :--- | :--- |
| **Desktop Chrome / Brave / Edge** | Freighter Extension | `@stellar/freighter-api` | Production Active ✅ |
| **Mobile Browser (iOS / Android)** | Freighter Mobile | App deep linking / WebExtension | Supported ✅ |
| **Mobile Web3 In-App Browser** | Lobstr / xBull / Albedo | Injected `window.freighter` / SEP-0007 | Supported via SEP-07 ✅ |
| **Telegram MiniApp** | Telegram WebApp Context | Cloud storage & web3 popup bridge | Roadmap (Phase 6) 🚀 |

### 2.1. Handling Mobile Freighter Signatures
On mobile devices, Freighter may execute as a standalone application rather than a desktop browser extension:
1. **Request Access**: When calling `freighterApi.requestAccess()`, the client detects whether `window.freighter` is injected. If absent on a mobile user-agent, the UI directs the user to open Quiza inside the Freighter Mobile dApp browser or install Freighter.
2. **Asynchronous Signing**: The signing loop in `invokeSorobanMethod` includes robust timeouts (60 seconds) to account for users switching between their browser and the Freighter application to confirm transaction biometric signatures.

---

## 3. PWA (Progressive Web App) Architecture

To deliver a native app-like experience without app store friction, Quiza is architected as an installable PWA.

### 3.1. Web App Manifest
Located in `public/manifest.json`:
- `display: "standalone"` eliminates browser address bars.
- `theme_color: "#4F46E5"` matches Quiza's primary indigo brand color.
- Adaptive icons for iOS and Android home screens ($192\text{ px}$ and $512\text{ px}$).

### 3.2. Caching Strategy
- **Static Assets** (Fonts, Logo, Icons, Sound Effects): Pre-cached via Cache-First strategy to ensure instant load times.
- **Question API** (`/api/round-questions`): Network-Only strategy with memory fallback to prevent stale answer keys or replay issues.
- **RPC Queries** (`simulateTransaction`, `get_round`): Network-Only with short-lived memory deduplication to guarantee on-chain data accuracy.

### 3.3. Haptic Feedback
Interactive elements trigger subtle Web Vibration API haptics on supported mobile devices:
- **Correct Answer**: Light vibration pulse (`navigator.vibrate(50)`).
- **Wrong Answer**: Double alert vibration (`navigator.vibrate([80, 50, 80])`).
- **Round Won**: Celebratory pattern (`navigator.vibrate([100, 50, 100, 50, 200])`).
