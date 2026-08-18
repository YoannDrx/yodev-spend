import "server-only";

import { and, eq, gte, inArray, isNull, lt, notInArray } from "drizzle-orm";
import {
  connectorSyncRuns,
  costEntries,
  externalResourceProjects,
  externalResources,
  optimizationFindings,
  providerConnections,
} from "@/db/schema";
import { requireServiceDb } from "@/db";

type CandidateFinding = {
  dedupeKey: string;
  type: string;
  title: string;
  description: string;
  currency: string | null;
  savingsMinMinor: bigint | null;
  savingsMaxMinor: bigint | null;
  confidence: "low" | "medium" | "high";
  externalResourceId: string | null;
  billingAccountId: string | null;
  observationFrom: Date;
  observationTo: Date;
  evidence: Array<{ label: string; value: string }>;
};

export async function generateConnectorOptimizationFindings(workspaceId: string, connectionId: string) {
  const db = requireServiceDb();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const currentWeekStart = new Date(now.getTime() - 7 * 86_400_000);
  const previousWeekStart = new Date(now.getTime() - 14 * 86_400_000);
  const queryStart = monthStart < previousWeekStart ? monthStart : previousWeekStart;
  const [connection] = await db.select({ providerId: providerConnections.providerId }).from(providerConnections).where(and(
    eq(providerConnections.workspaceId, workspaceId),
    eq(providerConnections.id, connectionId),
  )).limit(1);
  if (!connection) return [];

  const [costRows, resourceRows, mappings, completeRuns] = await Promise.all([
    db.select().from(costEntries).where(and(
      eq(costEntries.workspaceId, workspaceId),
      eq(costEntries.connectionId, connectionId),
      gte(costEntries.periodEnd, queryStart),
      lt(costEntries.periodStart, now),
      isNull(costEntries.supersededAt),
    )),
    db.select().from(externalResources).where(and(eq(externalResources.workspaceId, workspaceId), eq(externalResources.connectionId, connectionId))),
    db.select().from(externalResourceProjects).where(and(eq(externalResourceProjects.workspaceId, workspaceId), isNull(externalResourceProjects.effectiveTo))),
    db.select().from(connectorSyncRuns).where(and(
      eq(connectorSyncRuns.workspaceId, workspaceId),
      eq(connectorSyncRuns.connectionId, connectionId),
      eq(connectorSyncRuns.capability, "accrued_costs"),
      eq(connectorSyncRuns.status, "success"),
      gte(connectorSyncRuns.coveredTo, dayStart),
      lt(connectorSyncRuns.coveredFrom, previousWeekStart),
    )),
  ]);
  const resourceById = new Map(resourceRows.map((resource) => [resource.id, resource]));
  const mappedResources = new Set(mappings.map((mapping) => mapping.externalResourceId));
  const findings: CandidateFinding[] = [];

  const unallocated = new Map<string, { amount: bigint; currency: string; billingAccountId: string }>();
  for (const cost of costRows.filter((row) => row.externalResourceId && row.periodEnd >= monthStart && !mappedResources.has(row.externalResourceId))) {
    const key = `${cost.externalResourceId}:${cost.currency}`;
    const existing = unallocated.get(key);
    unallocated.set(key, { amount: (existing?.amount ?? 0n) + cost.amountMinor, currency: cost.currency, billingAccountId: cost.billingAccountId });
  }
  for (const [key, total] of unallocated) {
    if (total.amount <= 0n) continue;
    const resourceId = key.split(":")[0];
    const resource = resourceById.get(resourceId);
    findings.push({
      dedupeKey: `UNALLOCATED_RESOURCE_COST:${connectionId}:${resourceId}:${total.currency}`,
      type: "UNALLOCATED_RESOURCE_COST",
      title: `${resource?.name ?? "External resource"} has unallocated spend`,
      description: "This cost is real, but Spend cannot yet attribute it to a YoDev project. Confirming the mapping will make project profitability and optimization more accurate.",
      currency: total.currency,
      savingsMinMinor: 0n,
      savingsMaxMinor: total.amount,
      confidence: "high",
      externalResourceId: resourceId,
      billingAccountId: total.billingAccountId,
      observationFrom: monthStart,
      observationTo: now,
      evidence: [{ label: "Current-period cost", value: total.amount.toString() }, { label: "Project mappings", value: "0" }],
    });
  }

  if (completeRuns.length > 0) {
    const series = new Map<string, { current: bigint; previous: bigint; currency: string; resourceId: string | null; billingAccountId: string; label: string }>();
    for (const cost of costRows) {
      const key = `${cost.externalResourceId ?? "account"}:${cost.description ?? cost.kind}:${cost.currency}`;
      const item = series.get(key) ?? { current: 0n, previous: 0n, currency: cost.currency, resourceId: cost.externalResourceId, billingAccountId: cost.billingAccountId, label: cost.description ?? cost.kind };
      if (cost.periodEnd >= currentWeekStart) item.current += cost.amountMinor;
      else item.previous += cost.amountMinor;
      series.set(key, item);
    }
    for (const [key, item] of series) {
      const delta = item.current - item.previous;
      if (item.current <= 0n || delta < 100n || (item.previous > 0n && item.current * 100n < item.previous * 150n)) continue;
      findings.push({
        dedupeKey: `COST_GROWTH:${connectionId}:${key}`.slice(0, 240),
        type: "COST_GROWTH",
        title: `${item.label} cost increased`,
        description: "The latest complete seven-day period is materially higher than the preceding period. Review the associated usage before changing a plan or architecture.",
        currency: item.currency,
        savingsMinMinor: null,
        savingsMaxMinor: delta,
        confidence: "medium",
        externalResourceId: item.resourceId,
        billingAccountId: item.billingAccountId,
        observationFrom: previousWeekStart,
        observationTo: now,
        evidence: [{ label: "Previous 7 days", value: item.previous.toString() }, { label: "Latest 7 days", value: item.current.toString() }],
      });
    }
  }

  for (const finding of findings) {
    await db.insert(optimizationFindings).values({
      workspaceId,
      connectionId,
      providerId: connection.providerId,
      ...finding,
      ruleVersion: "finops-v2.1",
    }).onConflictDoUpdate({
      target: [optimizationFindings.workspaceId, optimizationFindings.dedupeKey],
      targetWhere: inArray(optimizationFindings.status, ["open", "accepted", "ignored", "snoozed"]),
      set: {
        title: finding.title,
        description: finding.description,
        confidence: finding.confidence,
        savingsMinMinor: finding.savingsMinMinor,
        savingsMaxMinor: finding.savingsMaxMinor,
        observationFrom: finding.observationFrom,
        observationTo: finding.observationTo,
        evidence: finding.evidence,
        lastValidatedAt: now,
        updatedAt: now,
      },
    });
  }

  const activeKeys = findings.map((finding) => finding.dedupeKey);
  const resolveWhere = [
    eq(optimizationFindings.workspaceId, workspaceId),
    eq(optimizationFindings.connectionId, connectionId),
    inArray(optimizationFindings.status, ["open", "accepted", "ignored", "snoozed"]),
    inArray(optimizationFindings.type, ["UNALLOCATED_RESOURCE_COST", "COST_GROWTH"]),
  ];
  if (activeKeys.length > 0) resolveWhere.push(notInArray(optimizationFindings.dedupeKey, activeKeys));
  await db.update(optimizationFindings).set({ status: "resolved", resolvedAt: now, updatedAt: now }).where(and(...resolveWhere));
  return findings;
}
