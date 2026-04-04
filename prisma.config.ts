import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma CLI only needs this for `prisma generate` and local dev.
// For Turso schema changes, use: turso db shell lifepilot < schema.sql
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: "file:./dev.db",
  },
});
