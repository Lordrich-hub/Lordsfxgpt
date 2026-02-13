/* global process, console */
import { execSync } from "node:child_process";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.PRISMA_DATABASE_URL);

if (!hasDb) {
  console.log("[migrate] Skipping: DATABASE_URL/PRISMA_DATABASE_URL not set");
  process.exit(0);
}

try {
  console.log("[migrate] Running prisma migrate deploy…");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  console.log("[migrate] Done");
} catch {
  console.error("[migrate] Failed");
  process.exit(1);
}
