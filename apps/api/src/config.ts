import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { StrKey } from "@stellar/stellar-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config(); // Also local .env if present

const configSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173")
    .transform((val) => val.split(",").map((s) => s.trim())),
  QUIZA_ROUND_SECRET: z.string().min(16, "QUIZA_ROUND_SECRET must be at least 16 chars"),
  QUIZA_CONTRACT_ID: z.string().refine(
    (val) => StrKey.isValidContract(val) || StrKey.isValidEd25519PublicKey(val),
    { message: "Invalid QUIZA_CONTRACT_ID" }
  ),
  QUIZA_VERIFIER_SECRET_KEY: z.string().refine(
    (val) => StrKey.isValidEd25519SecretSeed(val),
    { message: "Invalid QUIZA_VERIFIER_SECRET_KEY: must be valid Stellar Ed25519 secret seed" }
  ),
  STELLAR_NETWORK: z.string().default("testnet"),
  STELLAR_NETWORK_PASSPHRASE: z.string().default("Test SDF Network ; September 2015"),
  SOROBAN_RPC_URL: z.string().url().default("https://soroban-testnet.stellar.org"),
  HORIZON_URL: z.string().url().default("https://horizon-testnet.stellar.org"),
  PUBLIC_BASE_URL: z.string().optional().default("http://localhost:5173"),
  DATABASE_URL: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

function loadConfig() {
  const raw = {
    PORT: process.env.PORT,
    HOST: process.env.HOST,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    QUIZA_ROUND_SECRET: process.env.QUIZA_ROUND_SECRET,
    QUIZA_CONTRACT_ID: process.env.QUIZA_CONTRACT_ID || process.env.VITE_QUIZA_CONTRACT_ID,
    QUIZA_VERIFIER_SECRET_KEY: process.env.QUIZA_VERIFIER_SECRET_KEY,
    STELLAR_NETWORK: process.env.STELLAR_NETWORK || "testnet",
    STELLAR_NETWORK_PASSPHRASE: process.env.STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
    SOROBAN_RPC_URL: process.env.SOROBAN_RPC_URL || process.env.VITE_SOROBAN_RPC_URL,
    HORIZON_URL: process.env.HORIZON_URL || process.env.VITE_HORIZON_URL,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    TRUST_PROXY: process.env.TRUST_PROXY ?? 0,
  };

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`Configuration validation failed: ${issues}`);
  }

  // Ensure no secret starts with VITE_
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("VITE_") && (key.includes("SECRET") || key.includes("PRIVATE"))) {
      throw new Error(`Forbidden environment variable: secret '${key}' must not use VITE_ prefix`);
    }
  }

  return parsed.data;
}

export const config = loadConfig();
