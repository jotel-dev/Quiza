import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface QueryResult<T = any> {
  rows: T[];
}

export interface DbClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

let dbInstance: DbClient | null = null;

export async function getDb(): Promise<DbClient> {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && databaseUrl.trim().length > 0) {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    dbInstance = {
      async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
        const res = await pool.query(text, params);
        return { rows: res.rows };
      },
      async exec(sql: string): Promise<void> {
        await pool.query(sql);
      },
      async close(): Promise<void> {
        await pool.end();
      },
    };
  } else {
    // Embedded PGlite - zero Docker, runs PostgreSQL engine inside Node.js
    const isTest = process.env.NODE_ENV === "test" || !!process.env.VITEST;
    let projectRoot = path.resolve(__dirname, "../../../..");
    if (!fs.existsSync(path.join(projectRoot, "package.json"))) {
      projectRoot = path.resolve(process.cwd());
      if (projectRoot.endsWith("apps\\api") || projectRoot.endsWith("apps/api")) {
        projectRoot = path.resolve(projectRoot, "../..");
      }
    }
    const dataDir = process.env.PGLITE_DATA_DIR || (isTest ? undefined : path.join(projectRoot, ".data/pglite"));
    if (dataDir) {
      fs.mkdirSync(dataDir, { recursive: true });
      const stalePid = path.join(dataDir, "postmaster.pid");
      const staleLock = path.join(dataDir, ".s.PGSQL.5432.lock.out");
      try {
        if (fs.existsSync(stalePid)) fs.unlinkSync(stalePid);
        if (fs.existsSync(staleLock)) fs.unlinkSync(staleLock);
      } catch {}
    }
    const pglite = dataDir ? new PGlite(dataDir) : new PGlite();
    await pglite.waitReady;

    dbInstance = {
      async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
        const res = await pglite.query<T>(text, params);
        return { rows: res.rows };
      },
      async exec(sql: string): Promise<void> {
        await pglite.exec(sql);
      },
      async close(): Promise<void> {
        await pglite.close();
      },
    };
  }

  // Run migrations
  await runMigrations(dbInstance);
  return dbInstance;
}

export async function runMigrations(db: DbClient): Promise<void> {
  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await db.exec(sql);
  }
}
