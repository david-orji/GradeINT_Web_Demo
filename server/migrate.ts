import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "path";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not set.");
    process.exit(1);
}

async function runMigrations() {
    console.log("Running database migrations...");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool);

    // In the compiled CJS output (dist/migrate.cjs), __dirname points to dist/.
    // The migrations folder sits one level up at <project-root>/migrations/.
    const migrationsFolder = path.resolve(__dirname, "../migrations");

    try {
        await migrate(db, { migrationsFolder });
        console.log("✓ Migrations applied successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrations();
