import { Keypair, TransactionBuilder, nativeToScVal, rpc, Contract, Operation, StrKey } from "@stellar/stellar-sdk";
import { roundStore, scoreRound, verifySessionToken } from "./_store.js";

async function attemptOnChainResolve(roundId, won, correctCount) {
  const verifierSecret = process.env.QUIZA_VERIFIER_SECRET_KEY || process.env.QUIZA_VERIFIER_SECRET;
  const contractId = process.env.QUIZA_CONTRACT_ID || process.env.VITE_QUIZA_CONTRACT_ID;

  if (!verifierSecret || !contractId) {
    return null;
  }

  if (!StrKey.isValidEd25519SecretSeed(verifierSecret)) {
    return null;
  }

  try {
    const numericRoundId = BigInt(roundId);
    const keypair = Keypair.fromSecret(verifierSecret);
    const verifierPub = keypair.publicKey();
    const rpcUrl = process.env.SOROBAN_RPC_URL || process.env.VITE_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
    const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || process.env.VITE_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";

    const server = new rpc.Server(rpcUrl);
    const contract = new Contract(contractId);
    const account = await server.getAccount(verifierPub);

    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          "resolve",
          nativeToScVal(numericRoundId, { type: "u64" }),
          nativeToScVal(won, { type: "bool" }),
          nativeToScVal(correctCount, { type: "u32" })
        )
      )
      .setTimeout(60)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationError(sim)) {
      if (rpc.Api.isSimulationRestore(sim)) {
        const restoreTx = new TransactionBuilder(account, { fee: "100000", networkPassphrase })
          .addOperation(Operation.restoreFootprint({}))
          .setTimeout(60)
          .build();
        const restoreSim = await server.simulateTransaction(restoreTx);
        const assembledRestore = rpc.assembleTransaction(restoreTx, restoreSim).build();
        assembledRestore.sign(keypair);
        await server.sendTransaction(assembledRestore);
        await new Promise((r) => setTimeout(r, 1500));
      }

      const prepared = rpc.assembleTransaction(tx, sim).build();
      prepared.sign(keypair);
      const sendRes = await server.sendTransaction(prepared);
      if (sendRes.status !== "ERROR") {
        return sendRes.hash;
      }
    }
  } catch (err) {
    console.warn(`[verify-round] On-chain resolution note for round ${roundId}:`, err?.message || err);
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { roundId, questionIds, submittedAnswers, address, sessionToken } = body;

    if (!roundId) {
      return res.status(400).json({ error: "Missing roundId" });
    }

    if (!Array.isArray(questionIds) || !Array.isArray(submittedAnswers)) {
      return res.status(400).json({ error: "questionIds and submittedAnswers arrays required" });
    }

    if (questionIds.length !== submittedAnswers.length) {
      return res.status(400).json({ error: "questionIds and submittedAnswers length mismatch" });
    }

    // Verify session token if provided
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
    const effectiveToken = sessionToken || bearerToken;

    if (effectiveToken && address) {
      const isValid = verifySessionToken(effectiveToken, address);
      if (!isValid && process.env.NODE_ENV === "production" && process.env.REQUIRE_STRICT_SESSION === "true") {
        return res.status(401).json({ error: "Invalid or expired session token" });
      }
    }

    // Check if round was already scored and cached
    const stringRoundId = String(roundId);
    if (roundStore.has(stringRoundId)) {
      const cached = roundStore.get(stringRoundId);
      return res.status(200).json(cached);
    }

    // Off-chain scoring
    const { correctCount, total, won, correctAnswers } = scoreRound(questionIds, submittedAnswers);

    // On-chain resolution if verifier key is present
    const txHash = await attemptOnChainResolve(stringRoundId, won, correctCount);

    const result = {
      won,
      correctCount,
      total,
      txHash,
      correctAnswers,
    };

    // Cache the round outcome
    roundStore.set(stringRoundId, {
      ...result,
      roundId: stringRoundId,
      player: address || "",
      status: "resolved",
      score: correctCount,
      resolved: true,
      errorMessage: null,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("[verify-round] Error verifying round:", err);
    return res.status(500).json({ error: err?.message || "Failed to verify round" });
  }
}
