import { db } from "./firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!db) {
    // Firebase not configured — degrade gracefully instead of 500.
    console.warn("Firebase Admin not initialized; returning empty leaderboard.");
    return res.status(200).json({ players: [] });
  }

  try {
    const snapshot = await db.collection("players")
      .orderBy("totalPoints", "desc")
      .limit(50)
      .get();

    const players = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Ensure timestamps can be serialized to JSON
      if (data.lastUpdated && typeof data.lastUpdated.toDate === 'function') {
        data.lastUpdated = data.lastUpdated.toDate().getTime();
      }
      players.push(data);
    });

    res.status(200).json({ players });
  } catch (err) {
    console.error("Failed to fetch leaderboard:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
