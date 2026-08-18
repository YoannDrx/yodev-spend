import "server-only";

import { and, eq, inArray, isNotNull, isNull, notInArray } from "drizzle-orm";
import {
  billingAccounts,
  connectorSyncRuns,
  costEntries,
  externalResources,
  providerPlanVersions,
  providerConnections,
  providers,
  subscriptions,
} from "@/db/schema";
import { requireServiceDb, type SpendDatabase } from "@/db";
import { logEvent } from "@/server/logging";
import { decimalToMinorUnits } from "@/server/finops/decimal";
import { generateConnectorOptimizationFindings } from "@/server/optimization/generate";
import { credentialBinding, decryptCredentials } from "./credentials";
import { getConnector } from "./registry";
import { ConnectorHttpError, type NormalizedCommitment, type NormalizedConnectorCost, type NormalizedExternalResource } from "./types";

export type RunnableSyncCapability = "resources" | "accrued_costs" | "subscriptions";

function safeConnectorError(error: unknown) {
  if (error instanceof ConnectorHttpError) return { code: error.code, message: error.message, retryAfter: error.retryAfter };
  return { code: "CONNECTOR_SYNC_FAILED", message: "The provider synchronization failed.", retryAfter: undefined };
}

function safeMetadata(metadata: Record<string, string | number | boolean | null> = {}) {
  return Object.fromEntries(Object.entries(metadata).slice(0, 50).map(([key, value]) => [
    key.slice(0, 80),
    typeof value === "string" ? value.slice(0, 500) : value,
  ]));
}

async function persistResources(
  db: SpendDatabase,
  input: { workspaceId: string; connectionId: string; providerId: string },
  resources: NormalizedExternalResource[],
  completeness: "complete" | "partial",
) {
  const now = new Date();
  for (const resource of resources) {
    await db.insert(externalResources).values({
      workspaceId: input.workspaceId,
      connectionId: input.connectionId,
      providerId: input.providerId,
      externalId: resource.externalId,
      resourceType: resource.type,
      name: resource.name,
      status: resource.status,
      region: resource.region,
      parentExternalId: resource.parentExternalId,
      metadata: safeMetadata(resource.metadata),
      firstSeenAt: now,
      lastSeenAt: now,
    }).onConflictDoUpdate({
      target: [externalResources.workspaceId, externalResources.connectionId, externalResources.externalId],
      set: {
        resourceType: resource.type,
        name: resource.name,
        status: resource.status,
        region: resource.region,
        parentExternalId: resource.parentExternalId,
        metadata: safeMetadata(resource.metadata),
        lastSeenAt: now,
        archivedAt: null,
        updatedAt: now,
      },
    });
  }

  // A partial provider response may contribute positive observations, but it
  // must never make a previously known resource inactive.
  if (completeness !== "complete") return;
  const activeIds = resources.map((resource) => resource.externalId);
  if (activeIds.length > 0) {
    await db.update(externalResources).set({ status: "inactive", updatedAt: now }).where(and(
      eq(externalResources.workspaceId, input.workspaceId),
      eq(externalResources.connectionId, input.connectionId),
      notInArray(externalResources.externalId, activeIds),
      isNull(externalResources.archivedAt),
    ));
  } else {
    await db.update(externalResources).set({ status: "inactive", updatedAt: now }).where(and(
      eq(externalResources.workspaceId, input.workspaceId),
      eq(externalResources.connectionId, input.connectionId),
      isNull(externalResources.archivedAt),
    ));
  }
}

async function persistCosts(
  db: SpendDatabase,
  input: { workspaceId: string; connectionId: string; billingAccountId: string; providerSlug: string },
  costs: NormalizedConnectorCost[],
) {
  const resourceRows = await db.select({ id: externalResources.id, externalId: externalResources.externalId }).from(externalResources).where(and(
    eq(externalResources.workspaceId, input.workspaceId),
    eq(externalResources.connectionId, input.connectionId),
  ));
  const resourceByExternalId = new Map(resourceRows.map((resource) => [resource.externalId, resource.id]));
  const source = `${input.providerSlug}:${input.connectionId}`;
  const now = new Date();

  for (const cost of costs) {
    const money = decimalToMinorUnits(cost.amount, cost.currency);
    const values = {
      billingAccountId: input.billingAccountId,
      connectionId: input.connectionId,
      externalResourceId: cost.resourceExternalId ? resourceByExternalId.get(cost.resourceExternalId) ?? null : null,
      amountMinor: money.amountMinor,
      exactAmountScaled: money.exactAmountScaled,
      exactAmountScale: money.exactAmountScale,
      currency: cost.currency,
      periodStart: cost.periodStart,
      periodEnd: cost.periodEnd,
      kind: cost.kind,
      amountStatus: cost.status,
      amountBasis: cost.basis,
      description: cost.description,
      metadata: safeMetadata(cost.metadata),
      updatedAt: now,
    };
    await db.insert(costEntries).values({
      workspaceId: input.workspaceId,
      source,
      externalId: cost.externalId,
      ...values,
    }).onConflictDoUpdate({
      target: [costEntries.workspaceId, costEntries.source, costEntries.externalId],
      targetWhere: isNotNull(costEntries.externalId),
      set: values,
    });
  }
}

function billingInterval(commitment: NormalizedCommitment) {
  const days = (commitment.periodEnd.getTime() - commitment.periodStart.getTime()) / 86_400_000;
  return days >= 27 && days <= 32 ? "month" as const : days >= 360 && days <= 370 ? "year" as const : "none" as const;
}

async function persistCommitments(
  db: SpendDatabase,
  input: { workspaceId: string; connectionId: string; providerId: string; providerSlug: string; billingAccountId: string },
  commitments: NormalizedCommitment[],
) {
  const source = `${input.providerSlug}:${input.connectionId}`;
  const now = new Date();
  for (const commitment of commitments) {
    const interval = billingInterval(commitment);
    const money = commitment.amount ? decimalToMinorUnits(commitment.amount, commitment.currency) : null;
    const [plan] = await db.insert(providerPlanVersions).values({
      workspaceId: input.workspaceId,
      providerId: input.providerId,
      connectionId: input.connectionId,
      externalId: commitment.externalId,
      name: commitment.name,
      currency: commitment.currency,
      amountMinor: money?.amountMinor ?? 0n,
      billingInterval: interval,
      effectiveFrom: commitment.periodStart,
      effectiveTo: commitment.periodEnd,
      source,
      lastVerifiedAt: now,
      metadata: safeMetadata(commitment.metadata),
    }).onConflictDoUpdate({
      target: [providerPlanVersions.workspaceId, providerPlanVersions.providerId, providerPlanVersions.externalId, providerPlanVersions.effectiveFrom],
      targetWhere: isNotNull(providerPlanVersions.workspaceId),
      set: { name: commitment.name, amountMinor: money?.amountMinor ?? 0n, lastVerifiedAt: now, metadata: safeMetadata(commitment.metadata), updatedAt: now },
    }).returning({ id: providerPlanVersions.id });

    await db.insert(subscriptions).values({
      workspaceId: input.workspaceId,
      billingAccountId: input.billingAccountId,
      planVersionId: plan.id,
      name: commitment.name,
      billingModel: money ? (interval === "year" ? "fixed_yearly" : "fixed_monthly") : "usage",
      amountMinor: money?.amountMinor ?? 0n,
      currency: commitment.currency,
      billingInterval: interval,
      renewalDate: commitment.periodEnd,
      status: commitment.periodEnd > now ? "active" : "cancelled",
      source,
      externalId: commitment.externalId,
      startedAt: commitment.periodStart,
      cancelledAt: commitment.periodEnd > now ? null : commitment.periodEnd,
    }).onConflictDoUpdate({
      target: [subscriptions.workspaceId, subscriptions.source, subscriptions.externalId],
      targetWhere: isNotNull(subscriptions.externalId),
      set: { planVersionId: plan.id, name: commitment.name, amountMinor: money?.amountMinor ?? 0n, currency: commitment.currency, billingInterval: interval, renewalDate: commitment.periodEnd, updatedAt: now },
    });
  }
}

export async function runConnectorSync(input: {
  workspaceId: string;
  connectionId: string;
  capability: RunnableSyncCapability;
  from: Date;
  to: Date;
  idempotencyKey: string;
}) {
  const db = requireServiceDb();
  const [row] = await db.select({ connection: providerConnections, providerId: providers.id, providerSlug: providers.slug }).from(providerConnections)
    .innerJoin(providers, eq(providers.id, providerConnections.providerId))
    .where(and(eq(providerConnections.id, input.connectionId), eq(providerConnections.workspaceId, input.workspaceId), inArray(providerConnections.status, ["active", "error", "rate_limited"]))).limit(1);
  if (!row) throw new Error("Active provider connection not found.");
  const connection = row.connection;
  if (!connection.credentialCiphertext || !connection.credentialIv || !connection.credentialTag) throw new Error("Provider credentials are unavailable.");

  const [billingAccount] = await db.select({ id: billingAccounts.id }).from(billingAccounts).where(and(
    eq(billingAccounts.workspaceId, input.workspaceId),
    eq(billingAccounts.connectionId, input.connectionId),
    eq(billingAccounts.status, "active"),
  )).limit(1);
  if (!billingAccount) throw new Error("The provider connection has no active billing account.");

  const [run] = await db.insert(connectorSyncRuns).values({
    workspaceId: input.workspaceId,
    connectionId: input.connectionId,
    capability: input.capability,
    status: "running",
    idempotencyKey: input.idempotencyKey,
    requestedFrom: input.from,
    requestedTo: input.to,
    startedAt: new Date(),
  }).onConflictDoNothing().returning({ id: connectorSyncRuns.id });
  if (!run) {
    const [existing] = await db.select().from(connectorSyncRuns).where(and(
      eq(connectorSyncRuns.workspaceId, input.workspaceId),
      eq(connectorSyncRuns.idempotencyKey, input.idempotencyKey),
    )).limit(1);
    if (existing && ["success", "partial", "skipped"].includes(existing.status)) return existing;
    throw new Error("A synchronization is already running for this provider capability.");
  }

  logEvent("connector_sync_started", { workspaceId: input.workspaceId, connectionId: input.connectionId, capability: input.capability, syncRunId: run.id });
  try {
    const credentials = decryptCredentials({
      ciphertext: connection.credentialCiphertext,
      iv: connection.credentialIv,
      tag: connection.credentialTag,
      keyVersion: connection.credentialKeyVersion,
    }, credentialBinding(input.workspaceId, row.providerSlug));
    const connector = getConnector(row.providerSlug);
    const context = { ...input, credentials };
    let recordsRead = 0;
    let runCompleteness: "complete" | "partial" = "complete";

    if (input.capability === "resources" && connector.syncResources) {
      const result = await connector.syncResources(context);
      recordsRead = result.items.length;
      runCompleteness = result.completeness;
      await persistResources(db, { workspaceId: input.workspaceId, connectionId: input.connectionId, providerId: row.providerId }, result.items, result.completeness);
    } else if (input.capability === "accrued_costs" && connector.syncAccruedCosts) {
      const result = await connector.syncAccruedCosts(context);
      recordsRead = result.items.length;
      runCompleteness = result.completeness;
      await persistCosts(db, { workspaceId: input.workspaceId, connectionId: input.connectionId, billingAccountId: billingAccount.id, providerSlug: row.providerSlug }, result.items);
      await generateConnectorOptimizationFindings(input.workspaceId, input.connectionId);
    } else if (input.capability === "subscriptions" && connector.syncCommitments) {
      const result = await connector.syncCommitments(context);
      recordsRead = result.items.length;
      runCompleteness = result.completeness;
      await persistCommitments(db, { workspaceId: input.workspaceId, connectionId: input.connectionId, providerId: row.providerId, providerSlug: row.providerSlug, billingAccountId: billingAccount.id }, result.items);
    } else {
      throw new Error("The connector does not implement this synchronization capability.");
    }

    const completedAt = new Date();
    const [completed] = await db.update(connectorSyncRuns).set({ status: runCompleteness === "complete" ? "success" : "partial", recordsRead, recordsWritten: recordsRead, coveredFrom: runCompleteness === "complete" ? input.from : null, coveredTo: runCompleteness === "complete" ? input.to : null, completedAt, updatedAt: completedAt }).where(eq(connectorSyncRuns.id, run.id)).returning();
    await db.update(providerConnections).set({ status: "active", lastSuccessfulSyncAt: runCompleteness === "complete" ? completedAt : connection.lastSuccessfulSyncAt, lastErrorCode: null, updatedAt: completedAt }).where(and(eq(providerConnections.id, input.connectionId), eq(providerConnections.workspaceId, input.workspaceId)));
    logEvent("connector_sync_completed", { workspaceId: input.workspaceId, connectionId: input.connectionId, capability: input.capability, syncRunId: run.id, recordsRead });
    return completed;
  } catch (error) {
    const safe = safeConnectorError(error);
    const completedAt = new Date();
    const status = safe.code.endsWith("RATE_LIMITED") ? "rate_limited" as const : "failed" as const;
    await db.update(connectorSyncRuns).set({ status, errorCode: safe.code, errorMessage: safe.message, nextRetryAt: safe.retryAfter, completedAt, updatedAt: completedAt }).where(eq(connectorSyncRuns.id, run.id));
    await db.update(providerConnections).set({ status: status === "rate_limited" ? "rate_limited" : safe.code.endsWith("CREDENTIALS_INVALID") ? "invalid" : "error", lastErrorCode: safe.code, updatedAt: completedAt }).where(and(eq(providerConnections.id, input.connectionId), eq(providerConnections.workspaceId, input.workspaceId)));
    logEvent("connector_sync_failed", { workspaceId: input.workspaceId, connectionId: input.connectionId, capability: input.capability, syncRunId: run.id, errorCode: safe.code });
    throw new Error(safe.message);
  }
}
