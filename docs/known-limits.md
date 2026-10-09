# Known Limitations & Architecture Notes

## 1. Browser-Local Refund Discovery (`localStorage`)

### Current State
When a player stakes funds for a round via `stakeRound`, the frontend records the round metadata (`roundId`, `address`, `token`, `amount`, `timestamp`) into browser `localStorage` under the key `quiza_staked_rounds`.

The **Profile** page reads from this key and polls on-chain state to identify unresolved rounds older than the 2-hour timeout (7200 seconds), presenting a "Claim Refund" option for any expired rounds.

### Limitations
1. **Device & Browser Bound**: If a user clears their browser cache/storage, switches browsers, or uses a different device, locally stored stake records are lost.
2. **Historical Rounds**: Rounds staked before tracking was introduced (e.g. Round 1 during initial testnet deployment) are not in `localStorage` unless manually injected.
3. **Private/Incognito Sessions**: Unresolved stakes made in incognito mode do not persist across window closures.
4. **Multi-Account Sharing**: If multiple wallets share a single browser profile, records are filtered by wallet address, but still reside in the same local storage slot (capped at 50 items).

---

## 2. Proposed Future Solutions (Phase 5+)

### Option A: Server-Side Player Rounds Endpoint (Fastify + PostgreSQL)
- **Concept**: The backend database already persists `round_sessions` containing `round_id`, `player`, `status`, and `created_at` (along with `onchain_created_at`).
- **Implementation**:
  - Expose `GET /api/player-rounds?address=G...` protected by authenticated session token.
  - Returns all unresolved or refundable rounds associated with that wallet address.
  - Frontend queries this endpoint on profile load and merges with or replaces `localStorage`.
- **Pros**: Instant discovery across any browser or device; zero extra RPC overhead on client.
- **Cons**: Relies on API database persistence; does not discover rounds created directly via contract CLI.

### Option B: On-Chain Event & Ledger Scan (Soroban RPC / Horizon)
- **Concept**: Discover round creation and status directly from the Stellar ledger using Soroban RPC events.
- **Implementation**:
  - Use `getEvents` on the Soroban RPC server, filtering by `contractId` and topic `stake`.
  - Filter events where the player argument matches the connected wallet.
  - Check `get_round(round_id)` for resolution status and timeout eligibility.
- **Pros**: Trustless and decentralized; works across any client, device, or third-party interface without needing a central backend.
- **Cons**: Requires paginated RPC event scans which can be slower on initial profile load.
