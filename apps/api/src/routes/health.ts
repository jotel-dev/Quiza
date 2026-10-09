import { FastifyPluginAsync } from "fastify";
import { Keypair } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import {
  checkRpcHealth,
  getVerifierBalance,
  getAccounting,
} from "../stellar/client.js";

const NATIVE_XLM_CONTRACT_ID =
  process.env.VITE_XLM_CONTRACT_ID ||
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export const healthRoute: FastifyPluginAsync = async (fastify) => {
  const handler = async (_request: any, reply: any) => {
    let dbOk = false;
    try {
      const db = await getDb();
      const res = await db.query("SELECT 1 as alive");
      dbOk = res.rows.length > 0;
    } catch {
      dbOk = false;
    }

    const rpcOk = await checkRpcHealth();

    const verifierKeypair = Keypair.fromSecret(config.QUIZA_VERIFIER_SECRET_KEY);
    const verifierAddress = verifierKeypair.publicKey();
    const verifierBalance = await getVerifierBalance(verifierAddress);

    let xlmAccounting = { pool: "0", locked: "0", owed: "0" };
    try {
      const acct = await getAccounting(NATIVE_XLM_CONTRACT_ID);
      xlmAccounting = {
        pool: acct.pool.toString(),
        locked: acct.locked.toString(),
        owed: acct.owed.toString(),
      };
    } catch {
      // Ignored if testnet RPC times out
    }

    const isHealthy = dbOk && rpcOk;

    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? "ok" : "degraded",
      service: "quiza-api",
      db: dbOk,
      rpc: rpcOk,
      verifierAddress,
      verifierBalance,
      pool: {
        XLM: xlmAccounting,
      },
    });
  };

  fastify.get("/health", handler);
  fastify.get("/api/health", handler);
};
