import fs from "fs";
import path from "path";

const QUESTION_BANK_PATH = path.join(process.cwd(), "src/data/questions.json");

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  
  try {
    const bank = JSON.parse(fs.readFileSync(QUESTION_BANK_PATH, "utf8"));
    const stats = { 
      total: bank.questions.length, 
      categories: {
        Mixed: { easy: 0, medium: 0, hard: 0, mixed: bank.questions.length }
      } 
    };

    bank.questions.forEach(q => {
      if (!stats.categories[q.category]) {
        stats.categories[q.category] = { easy: 0, medium: 0, hard: 0, mixed: 0 };
      }
      if (stats.categories[q.category][q.difficulty] !== undefined) {
        stats.categories[q.category][q.difficulty]++;
      }
      stats.categories[q.category].mixed++;
      
      if (stats.categories.Mixed[q.difficulty] !== undefined) {
        stats.categories.Mixed[q.difficulty]++;
      }
    });

    res.status(200).json(stats);
  } catch (err) {
    console.error("question-stats error:", err);
    res.status(500).json({ error: "Failed to load question stats" });
  }
}
