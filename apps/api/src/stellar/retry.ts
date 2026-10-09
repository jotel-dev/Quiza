import { getDb } from "../db/index.js";
import { resolveRoundOnChain, AlreadyResolvedError, InvalidScoreError } from "./verifier.js";
import { getRound } from "./client.js";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isPermanentError(err: any): boolean {
  if (err instanceof AlreadyResolvedError || err instanceof InvalidScoreError) {
    return true;
  }
  const str = String(err?.message || err);
  return (
    str.includes("AlreadyResolved") ||
    str.includes("already resolved") ||
    str.includes("InvalidScore") ||
    str.includes("invalid score")
  );
}

export const MAX_RETRY_WINDOW_MS = 100 * 60 * 1000; // 100 minutes safely before 2h timeout

export async function processResolveWithRetry(
  roundId: string,
  won: boolean,
  score: number,
  playerAddress: string,
  total: number
): Promise<string | null> {
  const db = await getDb();
  let delay = 1000;
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Check if already resolved on-chain
      const onChain = await getRound(roundId);
      if (onChain && onChain.resolved) {
        await db.query(
          `UPDATE round_sessions SET status = 'resolved', resolved_at = NOW() WHERE round_id = $1`,
          [roundId]
        );
        return null;
      }

      const txHash = await resolveRoundOnChain(roundId, won, score);

      // Successfully resolved on-chain!
      await db.query(
        `UPDATE round_sessions
         SET status = 'resolved', resolved_tx = $1, resolved_at = NOW(), error_message = NULL
         WHERE round_id = $2`,
        [txHash, roundId]
      );

      // Record player points on successful resolution
      const pointsEarned = score * 10;
      const isWin = won ? 1 : 0;
      await db.query(
        `INSERT INTO players (address, username, total_points, correct_answers, total_questions, games_played, streak, created_at, last_updated)
         VALUES ($1, $2, $3, $4, $5, 1, $6, NOW(), NOW())
         ON CONFLICT (address) DO UPDATE SET
           total_points = players.total_points + EXCLUDED.total_points,
           correct_answers = players.correct_answers + EXCLUDED.correct_answers,
           total_questions = players.total_questions + EXCLUDED.total_questions,
           games_played = players.games_played + 1,
           streak = CASE WHEN $7 = 1 THEN players.streak + 1 ELSE 0 END,
           last_updated = NOW()`,
        [
          playerAddress,
          playerAddress.slice(0, 6) + "...",
          pointsEarned,
          score,
          total,
          isWin,
          isWin,
        ]
      );

      return txHash;
    } catch (err: any) {
      if (err instanceof AlreadyResolvedError || String(err?.message || err).includes("AlreadyResolved")) {
        await db.query(
          `UPDATE round_sessions SET status = 'resolved', resolved_at = NOW(), error_message = NULL WHERE round_id = $1`,
          [roundId]
        );
        return null;
      }

      if (err instanceof InvalidScoreError || String(err?.message || err).includes("InvalidScore")) {
        await db.query(
          `UPDATE round_sessions SET status = 'permanent_failure', error_message = 'InvalidScore: permanent error' WHERE round_id = $1`,
          [roundId]
        );
        return null; // Never retry permanent errors
      }

      const errMessage = err?.message || String(err);
      await db.query(
        `UPDATE round_sessions SET status = 'failed', error_message = $1 WHERE round_id = $2`,
        [errMessage, roundId]
      );

      if (attempt < maxAttempts) {
        await sleep(delay);
        delay *= 2;
      }
    }
  }

  return null;
}

export async function sweepPendingResolutions(): Promise<{ resolved: number; needsAttention: number; skippedPermanent: number }> {
  const db = await getDb();
  let resolvedCount = 0;
  let needsAttentionCount = 0;
  let skippedPermanentCount = 0;

  try {
    const res = await db.query(
      `SELECT * FROM round_sessions WHERE status IN ('scored', 'failed') AND resolved_tx IS NULL`
    );

    const now = Date.now();

    for (const row of res.rows) {
      // 1. Skip permanent errors
      if (row.error_message && isPermanentError(new Error(row.error_message))) {
        skippedPermanentCount++;
        continue;
      }

      // 2. Check 100-minute window measured from on-chain created_at (if stored), falling back to row created_at
      const effectiveCreatedAt = row.onchain_created_at
        ? new Date(row.onchain_created_at).getTime()
        : new Date(row.created_at).getTime();
      const ageMs = now - effectiveCreatedAt;

      if (ageMs > MAX_RETRY_WINDOW_MS) {
        // Exceeded 100 minutes: mark needs_attention and log loudly!
        console.error(
          `[CRITICAL ALERT] Round ${row.round_id} for player ${row.player} has exceeded the 100-minute resolution retry limit! ` +
          `Marked status = 'needs_attention'. Stake is at risk of expiring at 120 minutes.`
        );
        await db.query(
          `UPDATE round_sessions SET status = 'needs_attention', error_message = 'Exceeded 100-minute retry limit before 2-hour timeout' WHERE round_id = $1`,
          [row.round_id]
        );
        needsAttentionCount++;
        continue;
      }

      // 3. Retry resolution
      try {
        const tx = await processResolveWithRetry(
          row.round_id,
          row.won,
          row.score ?? row.correct_count ?? 0,
          row.player,
          row.total ?? 10
        );
        if (tx) resolvedCount++;
      } catch (err: any) {
        console.warn(`[quiza-api] Periodic sweep retry failed for round ${row.round_id}:`, err?.message);
      }
    }
  } catch (err: any) {
    console.error("[quiza-api] Periodic sweep error:", err?.message);
  }

  return { resolved: resolvedCount, needsAttention: needsAttentionCount, skippedPermanent: skippedPermanentCount };
}

let sweeperInterval: NodeJS.Timeout | null = null;

export function startPeriodicSweeper(intervalMs = 60000): NodeJS.Timeout {
  if (sweeperInterval) return sweeperInterval;
  sweeperInterval = setInterval(() => {
    sweepPendingResolutions().catch((err) =>
      console.error("[quiza-api] Sweeper background error:", err?.message)
    );
  }, intervalMs);
  sweeperInterval.unref();
  return sweeperInterval;
}

export function stopPeriodicSweeper(): void {
  if (sweeperInterval) {
    clearInterval(sweeperInterval);
    sweeperInterval = null;
  }
}

export async function resumePendingResolutions(): Promise<number> {
  const result = await sweepPendingResolutions();
  startPeriodicSweeper(60000);
  return result.resolved;
}
