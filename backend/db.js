import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the data directory exists
const dbDir = path.join(__dirname, "../data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.join(dbDir, "database.sqlite"));

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    address TEXT PRIMARY KEY,
    username TEXT,
    avatar TEXT,
    totalPoints INTEGER DEFAULT 0,
    correctAnswers INTEGER DEFAULT 0,
    totalQuestions INTEGER DEFAULT 0,
    gamesPlayed INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    lastUpdated INTEGER DEFAULT 0
  );
`);

export default db;
