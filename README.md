# Quiza 🧠

**Stake. Play. Win.** A solo-player trivia MiniApp for [MiniPay](https://www.opera.com/products/minipay) on [Celo](https://celo.org) — built for [Proof of Ship Season 2](https://celoplatform.notion.site/) by Celo Public Goods.

Quiza lets anyone stake a small amount of CELO or cUSD, answer 10 trivia questions across Math, Geography, History, and General Knowledge, and win back their stake plus a bonus if they score high enough — all onchain.

---

## How it works

1. **Connect** your MiniPay wallet
2. **Stake** 0.01 CELO or cUSD
3. **Play** a 10-question round against the clock
4. **Score 7/10 or higher** → win back **1.5x** your stake, paid out instantly
5. Miss the threshold → stake funds the reward pool for future winners

## Tech stack

| Layer | Tech |
|---|---|
| Smart contract | Solidity ^0.8.20, OpenZeppelin (Ownable, ReentrancyGuard) |
| Chain | Celo (Alfajores testnet → Mainnet) |
| Deployment | Hardhat |
| Frontend | React + Vite + Tailwind CSS |
| Wallet | MiniPay (EIP-1193 injected provider) via ethers.js v6 |
| Backend | Node.js verifier service (Express/serverless, Firebase) |

## Project structure

```
quiza/
├── contracts/
│   └── Quiza.sol              # Stake, resolve, and payout logic
├── scripts/
│   └── deploy.js              # Hardhat deployment script
├── src/
│   ├── pages/                 # Home, Quiz, Results, Leaderboard screens
│   ├── components/            # Reusable UI components
│   ├── lib/                   # quizaContract.js and frontend integration
│   └── App.jsx                # Main application routing
├── api/
│   ├── verify-round.js        # Scores answers + calls resolve() on-chain
│   └── leaderboard.js         # Fetch/update leaderboard rankings
├── docs/
│   ├── CHECKLIST.md           # Proof of Ship + build checklist
│   └── DEPLOY.md              # Step-by-step deployment guide
├── hardhat.config.js
├── package.json
└── vite.config.js
```

## Getting started

```bash
# install dependencies
npm install

# copy env template and fill in your keys
cp .env.example .env

# start the local dev server
npm run dev

# start the local api server
npm run dev:api

# deploy to Alfajores testnet
npm run deploy:testnet
```

Full deployment walkthrough (funding a wallet, verifying the contract, going to mainnet) is in [`docs/DEPLOY.md`](./docs/DEPLOY.md).

## Smart contract

`Quiza.sol` handles staking and payouts:

- `stakeCelo()` — stake native CELO for a round
- `stakeToken(cUSD, amount)` — stake cUSD for a round
- `resolve(roundId, won)` — called by a trusted backend verifier after scoring the round off-chain
- `withdraw(token)` — claim accumulated winnings
- `fundPoolCelo()` / `fundPoolToken()` — owner tops up the reward pool

v1 uses a trusted backend verifier to check quiz scores, since the answer key can't live on-chain without being publicly readable. This can evolve toward a commit-reveal or oracle-based scheme in a future season.

> [!IMPORTANT]
> **The Verifier Wallet needs gas:** Because the backend calls `resolve()` on-chain, the address specified by `QUIZA_VERIFIER_PRIVATE_KEY` in your `.env` must have native CELO to pay for transaction fees. If this wallet runs out of gas, players will see an "insufficient funds" error when finishing a quiz. Make sure to keep the Verifier Wallet funded on the network you are running (`QUIZA_NETWORK`).

## Why Celo / MiniPay

Celo's native CELO token is ERC20-compatible out of the box, so Quiza can accept both CELO and cUSD through one unified contract interface — no wrapping, no separate logic paths. Combined with MiniPay's 16M+ user base and self-custodial stablecoin rails, it's a natural fit for a low-friction, real-money trivia game aimed at everyday users rather than crypto natives.

## Proof of Ship

This project is built for Celo's Proof of Ship Season 2 (July 2026 cycle). Progress and requirements are tracked in [`docs/CHECKLIST.md`](./docs/CHECKLIST.md).

## License

MIT
