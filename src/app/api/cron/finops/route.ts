import { and, asc, inArray, isNull } from "drizzle-orm";
import { providerConnections } from "@/db/schema";
import { requireServiceDb } from "@/db";
import { env } from "@/lib/env";
import { generateLifecycleAlerts } from "@/server/alerts/generate";
import { runConnectorSync, type RunnableSyncCapability } from "@/server/connectors/sync";
import { logEvent } from "@/server/logging";
import { expireAbandonedCommercialOnboarding } from "@/server/commercial/onboarding";
import { syncEcbReferenceRates } from "@/server/finops/ecb";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (env.CRON_ENABLED !== "true") return new Response(null, { status: 204 });

  const started = Date.now();
  let fxRatesImported = 0;
  try {
    fxRatesImported = await syncEcbReferenceRates();
  } catch {
    logEvent("ecb_fx_sync_failed", { errorCode: "ECB_FX_SYNC_FAILED" });
  }
  const onboardingCleanup = await expireAbandonedCommercialOnboarding();
  const lifecycleAlerts = await generateLifecycleAlerts();
  const connections = await requireServiceDb().select({
    id: providerConnections.id,
    workspaceId: providerConnections.workspaceId,
    capabilities: providerConnections.capabilities,
  }).from(providerConnections).where(and(
    inArray(providerConnections.status, ["active", "error", "rate_limited"]),
    isNull(providerConnections.archivedAt),
  )).orderBy(asc(providerConnections.lastSuccessfulSyncAt)).limit(10);
  const to = new Date();
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 35);
  const dateKey = to.toISOString().slice(0, 10);
  const results: Array<{ connectionId: string; capability: RunnableSyncCapability; status: string }> = [];
  logEvent("finops_cron_started", { batchSize: connections.length });

  for (const connection of connections) {
    const capabilities: RunnableSyncCapability[] = [
      ...(connection.capabilities.resources ? ["resources" as const] : []),
      ...(connection.capabilities.subscriptions ? ["subscriptions" as const] : []),
      ...(connection.capabilities.accruedCosts ? ["accrued_costs" as const] : []),
    ];
    for (const capability of capabilities) {
      if (Date.now() - started > 240_000) break;
      try {
        const result = await runConnectorSync({
          workspaceId: connection.workspaceId,
          connectionId: connection.id,
          capability,
          from,
          to,
          idempotencyKey: `scheduled:${dateKey}:${connection.id}:${capability}`,
        });
        results.push({ connectionId: connection.id, capability, status: result.status });
      } catch {
        results.push({ connectionId: connection.id, capability, status: "failed" });
      }
    }
    if (Date.now() - started > 240_000) break;
  }

  logEvent("finops_cron_completed", { processed: results.length, durationMs: Date.now() - started });
  return Response.json({ processed: results.length, fxRatesImported, onboardingCleanup, lifecycleAlerts, results });
}
