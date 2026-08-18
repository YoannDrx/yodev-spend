import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(process.cwd(), "src");
const allowed = new Set([
  "src/db/runtime.ts",
  "src/server/auth/workspace-transaction.ts",
]);
const identityBoundary = new Set([
  "src/lib/auth.ts",
  "src/server/auth/context.ts",
  "src/server/auth/organization-service.ts",
  "src/server/commercial/onboarding.ts",
  "src/server/commercial/quotas.ts",
]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

const violations = [];
for (const path of await sourceFiles(root)) {
  const file = relative(process.cwd(), path);
  if (allowed.has(file)) continue;
  const content = await readFile(path, "utf8");
  if (/\brequireDb\s*\(/.test(content)) violations.push(file);
  if (
    !identityBoundary.has(file)
    && /\b(?:authUsers|authOrganizations|authSessions|authAccounts|authVerifications|authMembers|authInvitations)\b/.test(content)
    && (file.startsWith("src/app/") || file.startsWith("src/server/actions/"))
  ) violations.push(`${file} (Better Auth tables must stay behind the identity service boundary)`);
}

if (violations.length) {
  console.error("Direct tenant database access is forbidden outside the workspace transaction boundary:");
  for (const file of violations) console.error(`- ${file}`);
  process.exitCode = 1;
} else {
  console.log("Database workspace boundaries verified.");
}
