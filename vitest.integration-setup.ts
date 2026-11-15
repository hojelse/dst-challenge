import { execFileSync } from "node:child_process";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

/**
 * Creates the test database if it is missing, then syncs it with the Drizzle
 * schema. Runs once before the integration tests.
 */
export default async function setup(project: TestProject) {
  const databaseUrl = project.config.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and start Compose.",
    );
  }

  const url = new URL(databaseUrl);
  const databaseName = url.pathname.slice(1);

  // Connect to the server's default `postgres` database to create ours.
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const sql = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    const existing = await sql`
      select 1 from pg_database where datname = ${databaseName}
    `;
    if (existing.length === 0) {
      await sql`create database ${sql(databaseName)}`;
    }
  } finally {
    await sql.end();
  }

  execFileSync("node_modules/.bin/drizzle-kit", ["push", "--force"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}
