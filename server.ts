import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("app.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS problem_sets (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS problems (
    id TEXT PRIMARY KEY,
    set_id TEXT,
    question TEXT,
    options TEXT, -- JSON string
    answer TEXT,
    explanation TEXT,
    is_bookmarked INTEGER DEFAULT 0,
    FOREIGN KEY(set_id) REFERENCES problem_sets(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/sets", (req, res) => {
    const sets = db.prepare("SELECT * FROM problem_sets ORDER BY created_at DESC").all();
    res.json(sets);
  });

  app.post("/api/sets", (req, res) => {
    const { id, title, problems } = req.body;
    
    const insertSet = db.prepare("INSERT INTO problem_sets (id, title) VALUES (?, ?)");
    const insertProblem = db.prepare(`
      INSERT INTO problems (id, set_id, question, options, answer, explanation)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((setId, setTitle, problemList) => {
      insertSet.run(setId, setTitle);
      for (const p of problemList) {
        insertProblem.run(p.id, setId, p.question, JSON.stringify(p.options), p.answer, p.explanation);
      }
    });

    transaction(id, title, problems);
    res.json({ success: true });
  });

  app.get("/api/sets/:id/problems", (req, res) => {
    const problems = db.prepare("SELECT * FROM problems WHERE set_id = ?").all(req.params.id);
    res.json(problems.map(p => ({
      ...p,
      options: JSON.parse(p.options as string),
      is_bookmarked: Boolean(p.is_bookmarked)
    })));
  });

  app.post("/api/problems/:id/bookmark", (req, res) => {
    const { is_bookmarked } = req.body;
    db.prepare("UPDATE problems SET is_bookmarked = ? WHERE id = ?").run(is_bookmarked ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  app.get("/api/bookmarks", (req, res) => {
    const problems = db.prepare("SELECT * FROM problems WHERE is_bookmarked = 1").all();
    res.json(problems.map(p => ({
      ...p,
      options: JSON.parse(p.options as string),
      is_bookmarked: true
    })));
  });

  app.delete("/api/sets/:id", (req, res) => {
    const transaction = db.transaction((setId) => {
      db.prepare("DELETE FROM problems WHERE set_id = ?").run(setId);
      db.prepare("DELETE FROM problem_sets WHERE id = ?").run(setId);
    });
    transaction(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
