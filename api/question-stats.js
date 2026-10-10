import { loadQuestions } from "./_store.js";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const bank = loadQuestions();
    const stats = {
      total: bank.questions.length,
      categories: {
        Mixed: { easy: 0, medium: 0, hard: 0, mixed: bank.questions.length },
      },
    };

    bank.categories.forEach((cat) => {
      stats.categories[cat] = { easy: 0, medium: 0, hard: 0, mixed: 0 };
    });

    bank.questions.forEach((q) => {
      if (!stats.categories[q.category]) {
        stats.categories[q.category] = { easy: 0, medium: 0, hard: 0, mixed: 0 };
      }
      const diff = q.difficulty;
      if (stats.categories[q.category][diff] !== undefined) {
        stats.categories[q.category][diff]++;
      }
      stats.categories[q.category].mixed++;

      if (stats.categories.Mixed[diff] !== undefined) {
        stats.categories.Mixed[diff]++;
      }
    });

    return res.status(200).json(stats);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load question stats" });
  }
}
