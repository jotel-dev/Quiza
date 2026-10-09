import { randomUUID, createHash, createHmac } from "crypto";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { getDb } from "../db/index.js";
import { config } from "../config.js";

export interface Challenge {
  nonce: string;
  message: string;
  expiresAt: number;
}

export interface SessionTokenResult {
  sessionToken: string;
  expiresAt: number;
  address: string;
}

export function createSessionToken(address: string, expiresInMs = 15 * 60 * 1000): SessionTokenResult {
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new Error("Invalid Stellar wallet address");
  }

  const expiresAt = Date.now() + expiresInMs;
  const payload = `${address}:${expiresAt}`;
  const hmac = createHmac("sha256", config.QUIZA_ROUND_SECRET).update(payload).digest("hex");
  const rawObj = JSON.stringify({ address, expiresAt, hmac });
  const sessionToken = Buffer.from(rawObj, "utf-8").toString("base64url");

  return {
    sessionToken,
    expiresAt,
    address,
  };
}

export function verifySessionToken(sessionToken: string, expectedAddress?: string): { address: string; expiresAt: number } {
  if (!sessionToken || typeof sessionToken !== "string") {
    throw new Error("Missing or invalid session token");
  }

  let data: { address: string; expiresAt: number; hmac: string };
  try {
    const raw = Buffer.from(sessionToken, "base64url").toString("utf-8");
    data = JSON.parse(raw);
  } catch {
    throw new Error("Malformed session token format");
  }

  const { address, expiresAt, hmac } = data;
  if (!address || !expiresAt || !hmac) {
    throw new Error("Incomplete session token payload");
  }

  if (Date.now() > expiresAt) {
    throw new Error("Session token has expired");
  }

  if (expectedAddress && address !== expectedAddress) {
    throw new Error(`Session token address mismatch: expected ${expectedAddress}, received ${address}`);
  }

  const expectedPayload = `${address}:${expiresAt}`;
  const computedHmac = createHmac("sha256", config.QUIZA_ROUND_SECRET).update(expectedPayload).digest("hex");
  if (hmac !== computedHmac) {
    throw new Error("Invalid session token signature");
  }

  return { address, expiresAt };
}

export async function createChallenge(address: string): Promise<Challenge> {
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new Error("Invalid Stellar wallet address");
  }

  const nonce = randomUUID();
  const message = `Quiza Authentication Nonce: ${nonce} for ${address}`;
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  const db = await getDb();
  await db.query(
    `INSERT INTO auth_challenges (nonce, address, message, created_at, expires_at, consumed)
     VALUES ($1, $2, $3, NOW(), $4, false)`,
    [nonce, address, message, new Date(expiresAt)]
  );

  return {
    nonce,
    message,
    expiresAt,
  };
}

export async function verifyChallenge(
  address: string,
  nonce: string,
  signature: string
): Promise<boolean> {
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new Error("Invalid Stellar wallet address");
  }

  const db = await getDb();
  const res = await db.query(
    `SELECT * FROM auth_challenges WHERE nonce = $1`,
    [nonce]
  );

  if (res.rows.length === 0) {
    throw new Error("Challenge nonce not found");
  }

  const challenge = res.rows[0];

  if (challenge.address !== address) {
    throw new Error("Challenge address mismatch");
  }

  if (challenge.consumed) {
    throw new Error("Challenge nonce has already been used");
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new Error("Challenge nonce has expired");
  }

  // Mark consumed immediately to prevent replay attacks
  await db.query(
    `UPDATE auth_challenges SET consumed = true WHERE nonce = $1`,
    [nonce]
  );

  // Cryptographically verify signature using Stellar SDK Keypair
  try {
    const keypair = Keypair.fromPublicKey(address);
    const isHex = signature.length === 128 && /^[0-9a-fA-F]+$/.test(signature);
    const sigBytes = new Uint8Array(Buffer.from(signature, isHex ? "hex" : "base64"));

    // 1. Try SEP-53 format (Freighter signMessage standard: SHA256("Stellar Signed Message:\n" + message))
    const sep53Prefix = "Stellar Signed Message:\n";
    const sep53Payload = Buffer.concat([
      Buffer.from(sep53Prefix, "utf-8"),
      Buffer.from(challenge.message, "utf-8"),
    ]);
    const sep53Hash = createHash("sha256").update(sep53Payload).digest();

    let isValid = false;
    try {
      isValid = keypair.verify(sep53Hash, sigBytes);
    } catch {
      isValid = false;
    }

    // 2. Fallback: try raw message verification if signed directly with Keypair
    if (!isValid) {
      const msgBytes = new TextEncoder().encode(challenge.message);
      try {
        isValid = keypair.verify(msgBytes, sigBytes);
      } catch {
        isValid = false;
      }
    }

    if (!isValid) {
      throw new Error("Invalid cryptographic signature for wallet address");
    }
    return true;
  } catch (err: any) {
    throw new Error(`Signature verification failed: ${err.message}`);
  }
}
