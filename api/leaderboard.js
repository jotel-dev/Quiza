const DEFAULT_LEADERBOARD = [
  {
    address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    username: "GBBD47...",
    totalPoints: 480,
    correctAnswers: 48,
    totalQuestions: 50,
    gamesPlayed: 5,
    streak: 4,
    lastUpdated: Date.now() - 3600000,
  },
  {
    address: "GDW2ZRFCRW2HBH2P26ZQWZRGADFBDXFHVUNZJFPFP57WURUPR6E4WXW6",
    username: "GDW2ZR...",
    totalPoints: 390,
    correctAnswers: 39,
    totalQuestions: 50,
    gamesPlayed: 5,
    streak: 2,
    lastUpdated: Date.now() - 7200000,
  },
  {
    address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    username: "GA5ZSE...",
    totalPoints: 310,
    correctAnswers: 31,
    totalQuestions: 40,
    gamesPlayed: 4,
    streak: 1,
    lastUpdated: Date.now() - 10800000,
  },
  {
    address: "GCO2ZAZNF5BEWV45NOXF6Z77V4C333SGLZJNLSTV2F6I452C7GBXZKTA",
    username: "GCO2ZA...",
    totalPoints: 240,
    correctAnswers: 24,
    totalQuestions: 30,
    gamesPlayed: 3,
    streak: 3,
    lastUpdated: Date.now() - 14400000,
  },
  {
    address: "GCZODX2P75V6RZZG63HQD2Y6F6CVU53W26CV7H46J5O2G4J7XNZ4J4YI",
    username: "GCZODX...",
    totalPoints: 180,
    correctAnswers: 18,
    totalQuestions: 20,
    gamesPlayed: 2,
    streak: 2,
    lastUpdated: Date.now() - 18000000,
  },
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (process.env.DATABASE_URL) {
      try {
        const pg = await import("pg");
        const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
        const queryRes = await pool.query(
          `SELECT address, username, total_points, correct_answers, total_questions, games_played, streak, last_updated
           FROM players
           ORDER BY total_points DESC
           LIMIT 50`
        );
        await pool.end();

        if (queryRes.rows && queryRes.rows.length > 0) {
          const players = queryRes.rows.map((row) => ({
            address: row.address,
            username: row.username,
            totalPoints: Number(row.total_points ?? 0),
            correctAnswers: Number(row.correct_answers ?? 0),
            totalQuestions: Number(row.total_questions ?? 0),
            gamesPlayed: Number(row.games_played ?? 0),
            streak: Number(row.streak ?? 0),
            lastUpdated: row.last_updated ? new Date(row.last_updated).getTime() : Date.now(),
          }));
          return res.status(200).json({ players });
        }
      } catch (dbErr) {
        console.warn("[leaderboard] PostgreSQL query failed, using fallback list:", dbErr?.message);
      }
    }

    return res.status(200).json({ players: DEFAULT_LEADERBOARD });
  } catch {
    return res.status(500).json({ error: "Failed to load leaderboard" });
  }
}
