import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { repositories } from "@/db/schema";
import { requireServiceDb } from "@/db";
import { env } from "@/lib/env";
import { logEvent } from "@/server/logging";
import { runRepositoryScan } from "@/server/scanner/run";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (env.CRON_ENABLED !== "true") return new Response(null, { status: 204 });

  const started = Date.now();
  const batch = await requireServiceDb()
    .select({ id: repositories.id, workspaceId: repositories.workspaceId })
    .from(repositories)
    .where(and(eq(repositories.scanEnabled, true), isNull(repositories.archivedAt)))
    .orderBy(asc(sql`coalesce(${repositories.lastScanAttemptAt}, ${repositories.lastSuccessfulScanAt}, ${repositories.createdAt})`))
    .limit(10);
  logEvent("cron_batch_started", { batchSize: batch.length });

  const results = [];
  for (const repository of batch) {
    if (Date.now() - started > 240_000) break;
    try {
      results.push(await runRepositoryScan({
        workspaceId: repository.workspaceId,
        repositoryId: repository.id,
        mode: "quick",
        trigger: "scheduled",
        idempotencyKey: `scheduled:${new Date().toISOString().slice(0, 10)}:${repository.id}`,
      }));
    } catch {
      results.push({ id: repository.id, status: "failed" });
    }
  }
  logEvent("cron_batch_completed", {
    processed: results.length,
    remaining: batch.length - results.length,
    durationMs: Date.now() - started,
  });
  return Response.json({ processed: results.length, remaining: batch.length - results.length, results });
}
