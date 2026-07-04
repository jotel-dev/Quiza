# Deploying Quiza to Celo

## 1. Install dependencies
```bash
npm install
```

## 2. Get a testnet wallet funded
1. Create a fresh wallet (MetaMask, or `npx hardhat vars` if you prefer) — do NOT use a wallet with real funds for testing.
2. Get free testnet CELO from the Alfajores faucet: https://faucet.celo.org
3. Copy `.env.example` to `.env` and fill in:
   - `DEPLOYER_PRIVATE_KEY` — your testnet wallet's private key
   - `QUIZA_VERIFIER_ADDRESS` — for testnet, can be the same wallet address
   - `QUIZA_VERIFIER_PRIVATE_KEY` — same wallet's private key (backend uses this to call `resolve()`)

## 3. Compile the contract
```bash
npm run compile
```

## 4. Deploy to Alfajores testnet
```bash
npm run deploy:testnet
```
This prints the deployed contract address. Copy it.

## 5. Wire the frontend to the deployed contract
Open `frontend/src/lib/quizaContract.js` and set:
```js
export const QUIZA_CONTRACT_ADDRESS = {
  alfajores: "0xTHE_ADDRESS_YOU_JUST_GOT",
  ...
};
```

## 6. Fund the reward pool
The contract needs funds on hand to pay out winners (it pays 1.5x the stake). Before testing real rounds, send some testnet CELO/cUSD into the pool:
```bash
# via Hardhat console, or write a small script calling:
# quiza.fundPoolCelo({ value: ethers.parseEther("1.0") })
# quiza.fundPoolToken(ethers.parseUnits("10", 18))  // after approving cUSD first
```

## 7. Verify the contract (public source code — required for Proof of Ship)
```bash
npm run verify:testnet -- <CONTRACT_ADDRESS> <CUSD_ADDRESS> <VERIFIER_ADDRESS>
```

## 8. Test the full loop
- Connect a wallet in the frontend (or MiniPay simulator)
- Stake CELO, then stake cUSD — confirm both work
- Play a round, submit answers, confirm `verifyRound.js` calls `resolve()` successfully
- Confirm a win credits `balances` and `withdraw()` pays out correctly

## 9. Go to mainnet (only after testnet works end-to-end)
1. Fund a **real** deployer wallet with a small amount of CELO for gas
2. Use a **separate, dedicated wallet** for `QUIZA_VERIFIER_ADDRESS` on mainnet — do not reuse your testnet key
3. Update `.env` with mainnet values
4. Run:
   ```bash
   npm run deploy:mainnet
   npm run verify:mainnet -- <CONTRACT_ADDRESS> <CUSD_ADDRESS> <VERIFIER_ADDRESS>
   ```
5. Update `QUIZA_CONTRACT_ADDRESS.celo` in `quizaContract.js`
6. Fund the mainnet reward pool
7. Double-check: verified source ✅, GitHub public ✅, MiniPay hook in place ✅ — these are Proof of Ship requirements

## Security notes
- `QUIZA_VERIFIER_PRIVATE_KEY` must only ever live in your backend's environment variables (Vercel/Railway/etc secrets) — never in frontend code, never committed to git
- Keep `.env` in `.gitignore`
- Consider rotating the verifier key periodically via `setVerifier()` on the contract
