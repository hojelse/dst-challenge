import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Read .env the same way Next.js does. Variables already set in the
// environment win, so the integration test setup can point this at the
// test database.
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  dbCredentials: { url },
});
