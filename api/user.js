import { db } from "./firebaseAdmin.js";
import { FieldValue } from "firebase-admin/firestore";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  const { address, username } = req.body;
  if (!address || !username) {
    return res.status(400).json({ error: "Missing address or username" });
  }

  if (!db) {
    return res.status(500).json({ error: "Firebase Admin not initialized" });
  }

  try {
    const playerRef = db.collection("players").doc(address);
    await db.runTransaction(async (t) => {
      const doc = await t.get(playerRef);
      if (!doc.exists) {
        t.set(playerRef, {
          address,
          username,
          lastUpdated: FieldValue.serverTimestamp()
        });
      } else {
        t.update(playerRef, {
          username,
          lastUpdated: FieldValue.serverTimestamp()
        });
      }
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Failed to update user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
