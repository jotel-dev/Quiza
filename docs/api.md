# Fastify Backend API Reference

This document provides a complete specification of the **Quiza Backend API** located in [`apps/api`](../apps/api). The API provides question delivery, off-chain scoring, leaderboard tracking, social share image generation, and verifier transaction dispatch.

---

## 1. General Information

- **Base URL (Local)**: `http://localhost:3001`
- **Base URL (Testnet Staging)**: `https://api-testnet.quiza.app` (or as configured in `.env`)
- **Protocol**: HTTP/1.1 with JSON payloads
- **Rate Limiting**: Enforced via `@fastify/rate-limit` (default: 100 requests per minute per IP, with tighter limits on challenge generation).

---

## 2. Authentication & Authorization

Protected endpoints require a short-lived (15-minute) HMAC-signed JWT session token provided via the `Authorization` header:

```http
Authorization: Bearer <session_token>
```

### Challenge Authentication Lifecycle

1. `GET /api/challenge?address=G...` → Returns a single-use random nonce and standard SEP-53 challenge message.
2. The user signs the challenge message with their Freighter wallet.
3. `POST /api/session` → Submits the signature and nonce; receives a 15-minute address-bound session token.
4. Pass the session token to `/api/round-questions` and `/api/verify-round`.

---

## 3. Endpoints

### 3.1. `GET /health`
System liveness and dependency diagnostic check.

- **Auth**: None
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-09T16:00:00.000Z",
    "uptime": 1420.5,
    "database": { "connected": true },
    "stellar": {
      "network": "testnet",
      "rpcConnected": true,
      "verifierAddress": "GCMKX5CZ4UCWKKUMGQ3WDEJ4AFCNCCJW5R54IWZH7BE6RK6H2KG45QCU",
      "verifierBalanceXlm": "998.45"
    },
    "pool": {
      "xlmContractId": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      "usdcContractId": "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
    }
  }
  ```

---

### 3.2. `GET /api/challenge`
Generates an ephemeral, single-use authentication nonce for wallet ownership verification.

- **Auth**: None
- **Query Parameters**:
  - `address` (string, required): Player's 56-character Stellar public key (`G...`).
- **Response `200 OK`**:
  ```json
  {
    "nonce": "c9a4f208-410a-4299-a9a7-93cf257ba901",
    "message": "Sign this message to authenticate with Quiza.\n\nAddress: GBWBXAM6L3LIFPGM37TGXHKCHVZNNMA5AVCLEEK4DGDT4DZSBLB4EVLT\nNonce: c9a4f208-410a-4299-a9a7-93cf257ba901\nTimestamp: 1791559000",
    "expiresAt": 1791559300000
  }
  ```
- **Response `400 Bad Request`**: If `address` is missing or fails StrKey validation.

---

### 3.3. `POST /api/session`
Exchanges a Freighter SEP-53 message signature for an address-bound session token.

- **Auth**: None
- **Request Body**:
  ```json
  {
    "address": "GBWBXAM6L3LIFPGM37TGXHKCHVZNNMA5AVCLEEK4DGDT4DZSBLB4EVLT",
    "nonce": "c9a4f208-410a-4299-a9a7-93cf257ba901",
    "signature": "base64_encoded_ed25519_signature"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": 1791559900000
  }
  ```
- **Response `401 Unauthorized`**: If signature verification fails or nonce is expired/replayed.

---

### 3.4. `POST /api/round-questions`
Delivers 10 randomized trivia questions for a staked round. Answer keys are strictly omitted.

- **Auth**: Bearer token required (for standard/daily rounds). Practice mode requires no token.
- **Request Body**:
  ```json
  {
    "roundId": "104",
    "type": "standard",
    "category": "Science",
    "difficulty": "medium",
    "walletAddress": "GBWBXAM6L3LIFPGM37TGXHKCHVZNNMA5AVCLEEK4DGDT4DZSBLB4EVLT"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "roundId": "104",
    "questions": [
      {
        "id": "sci-001",
        "question": "What is the chemical symbol for Gold?",
        "options": ["Ag", "Au", "Fe", "Pb"],
        "category": "Science"
      }
    ],
    "expiresInSeconds": 150
  }
  ```
- **Response `400 Bad Request`**: If the `roundId` does not exist on-chain or is already resolved.

---

### 3.5. `POST /api/verify-round`
Submits player answers, calculates score off-chain, and dispatches the on-chain resolution transaction.

- **Auth**: Bearer token required.
- **Request Body**:
  ```json
  {
    "roundId": "104",
    "questionIds": ["sci-001", "geo-004", "..."],
    "submittedAnswers": [1, 3, "..."],
    "address": "GBWBXAM6L3LIFPGM37TGXHKCHVZNNMA5AVCLEEK4DGDT4DZSBLB4EVLT"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "roundId": "104",
    "score": 10,
    "won": true,
    "multiplier": 2.0,
    "payoutStatus": "queued",
    "txHash": "a1b2c3d4e5f6..."
  }
  ```

---

### 3.6. `POST /api/verify-practice`
Evaluates answers for free practice rounds without on-chain transactions or signatures.

- **Auth**: None
- **Request Body**: Same question and answer format as `/api/verify-round`.
- **Response `200 OK`**: Returns final score and correct answer breakdown for learning.

---

### 3.7. `GET /api/round-status`
Polls the resolution status of an enqueued round.

- **Query Parameters**: `roundId` (string, required).
- **Response `200 OK`**:
  ```json
  {
    "roundId": "104",
    "status": "confirmed",
    "won": true,
    "score": 10,
    "txHash": "89ab...",
    "resolvedAt": "2026-10-09T16:05:00.000Z"
  }
  ```

---

### 3.8. `GET /api/leaderboard`
Returns top players sorted by total score, games played, and win streaks.

- **Query Parameters**: `period` (`daily` | `all-time`), `limit` (default: 50).
- **Response `200 OK`**:
  ```json
  {
    "period": "all-time",
    "leaderboard": [
      {
        "rank": 1,
        "address": "GBWBXAM...EVLT",
        "wins": 42,
        "totalWinnings": "210.50 XLM",
        "streak": 7
      }
    ]
  }
  ```

---

### 3.9. `GET /api/og` and `GET /api/share-card`
Generates dynamic Open Graph preview images and preview pages for social sharing (X / Telegram / WhatsApp).

- **Query Parameters**: `score`, `won`, `payout`, `token`, `player`.
- **Response**: SVG / PNG image or HTML card view.
