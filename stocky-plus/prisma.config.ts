import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prefer project .env from `prisma postgres link` over any inherited shell URL.
loadEnv({ path: ".env", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
