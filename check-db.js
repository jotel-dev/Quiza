import "dotenv/config";
import { db } from "./api/firebaseAdmin.js";

async function run() {
  if (!db) {
    console.log("DB is null");
    return;
  }
  const snapshot = await db.collection("players").get();
  console.log("Total players:", snapshot.size);
  snapshot.forEach(doc => console.log(doc.id, "=>", doc.data()));
}
run().catch(console.error);
