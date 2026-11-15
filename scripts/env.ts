// Reads .env the same way Next.js does, before any module that needs it is
// evaluated. Import this first. Variables already set in the environment win.

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
