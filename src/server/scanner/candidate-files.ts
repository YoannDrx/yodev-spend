import type { ScanMode } from "./types";

export const SCAN_LIMITS = {
  treeEntries: 20_000,
  quick: { files: 100, fileBytes: 256 * 1024, totalBytes: 2 * 1024 * 1024 },
  deep: { files: 400, fileBytes: 256 * 1024, totalBytes: 10 * 1024 * 1024 },
} as const;

const ignored = /(^|\/)(node_modules|\.next|dist|build|coverage|\.cache|vendor|generated)(\/|$)|\.(png|jpe?g|gif|webp|pdf|zip|gz|woff2?|ttf|ico|lock)$/i;
const quick = /(^|\/)(package\.json|\.env\.(example|sample|template)|vercel\.json|firebase\.json|\.firebaserc|netlify\.toml|wrangler\.(toml|jsonc)|railway\.(json|toml)|render\.yaml|fly\.toml|docker-compose\.ya?ml|Dockerfile|serverless\.ya?ml|Pulumi\.ya?ml|.*\.tf|\.github\/workflows\/.*\.ya?ml)$/i;
const source = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

export function isCandidateFile(path: string, mode: ScanMode) {
  if (ignored.test(path)) return false;
  return quick.test(path) || (mode === "deep" && source.test(path));
}

export function selectCandidatePaths(paths: Array<{ path: string; size: number }>, mode: ScanMode) {
  const limit = SCAN_LIMITS[mode];
  let totalBytes = 0;
  let partial = paths.length > SCAN_LIMITS.treeEntries;
  const selected: Array<{ path: string; size: number }> = [];
  for (const file of paths.slice(0, SCAN_LIMITS.treeEntries).filter((item) => isCandidateFile(item.path, mode)).sort((a, b) => Number(quick.test(b.path)) - Number(quick.test(a.path)) || a.path.localeCompare(b.path))) {
    if (file.size > limit.fileBytes || selected.length >= limit.files || totalBytes + file.size > limit.totalBytes) { partial = true; continue; }
    selected.push(file); totalBytes += file.size;
  }
  return { selected, partial, totalBytes };
}
