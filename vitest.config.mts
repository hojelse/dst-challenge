import nextEnv from "@next/env";
import { defineConfig } from "vitest/config";

// @next/env is CommonJS, so take loadEnvConfig off the default export.
nextEnv.loadEnvConfig(process.cwd());

/** The same server as DATABASE_URL, but the `thegreendiamond_test` database. */
function testDatabaseUrl(): string | undefined {
  if (!process.env.DATABASE_URL) return undefined;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/thegreendiamond_test";
  return url.toString();
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["**/node_modules/**", "**/*.integration.test.{ts,tsx}"],
        },
      },
      {
        // Runs against the Compose services; start them first with
        // `docker compose up -d postgres elasticsearch`.
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.{ts,tsx}"],
          globalSetup: ["./vitest.integration-setup.ts"],
          env: {
            DATABASE_URL: testDatabaseUrl(),
            ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL,
            ELASTICSEARCH_INDEX: "publications_test",
          },
          // Test files share one database, so run them one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
