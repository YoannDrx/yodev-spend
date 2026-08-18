import "server-only";

import { and, eq, gt, lte, notInArray } from "drizzle-orm";
import { alerts, billingAccounts, projectIntegrations, projects, providers, subscriptions } from "@/db/schema";
import { requireServiceDb } from "@/db";
import { alertDedupeKey } from "./rules";

export async function generateLifecycleAlerts(now = new Date()) {
  const db = requireServiceDb();
  const renewalLimit = new Date(now.getTime() + 30 * 86_400_000);
  const renewalRows = await db.select({ workspaceId: subscriptions.workspaceId, subscriptionId: subscriptions.id, subscriptionName: subscriptions.name, renewalDate: subscriptions.renewalDate, providerId: billingAccounts.providerId, billingAccountId: billingAccounts.id, providerName: providers.name }).from(subscriptions)
    .innerJoin(billingAccounts, and(eq(billingAccounts.id, subscriptions.billingAccountId), eq(billingAccounts.workspaceId, subscriptions.workspaceId)))
    .innerJoin(providers, eq(providers.id, billingAccounts.providerId))
    .where(and(eq(subscriptions.status, "active"), gt(subscriptions.renewalDate, now), lte(subscriptions.renewalDate, renewalLimit)));
  const removedRows = await db.select({ integrationId: projectIntegrations.id, workspaceId: projectIntegrations.workspaceId, projectId: projectIntegrations.projectId, providerId: projectIntegrations.providerId, projectName: projects.name, providerName: providers.name }).from(projectIntegrations)
    .innerJoin(projects, and(eq(projects.id, projectIntegrations.projectId), eq(projects.workspaceId, projectIntegrations.workspaceId)))
    .innerJoin(providers, eq(providers.id, projectIntegrations.providerId))
    .where(eq(projectIntegrations.lifecycleStatus, "removed"));
  const renewalKeys = renewalRows.map((row) => alertDedupeKey("RENEWAL_SOON", [row.subscriptionId]));
  const removedKeys = removedRows.map((row) => alertDedupeKey("PROVIDER_REMOVED", [row.integrationId]));

  await db.transaction(async (tx) => {
    for (const row of renewalRows) await tx.insert(alerts).values({ workspaceId: row.workspaceId, type: "RENEWAL_SOON", severity: "info", dedupeKey: alertDedupeKey("RENEWAL_SOON", [row.subscriptionId]), providerId: row.providerId, billingAccountId: row.billingAccountId, title: `${row.subscriptionName} renews soon`, description: `${row.providerName} renews on ${row.renewalDate!.toISOString().slice(0, 10)}. Review the plan and usage before renewal.`, metadata: { renewalDate: row.renewalDate!.toISOString() } }).onConflictDoNothing();
    for (const row of removedRows) await tx.insert(alerts).values({ workspaceId: row.workspaceId, type: "PROVIDER_REMOVED", severity: "warning", dedupeKey: alertDedupeKey("PROVIDER_REMOVED", [row.integrationId]), providerId: row.providerId, projectId: row.projectId, title: `${row.providerName} was removed from ${row.projectName}`, description: "The integration is marked removed. Verify that related billing has also ended." }).onConflictDoNothing();
    const renewalConditions = [eq(alerts.type, "RENEWAL_SOON"), eq(alerts.status, "open")];
    if (renewalKeys.length) renewalConditions.push(notInArray(alerts.dedupeKey, renewalKeys));
    await tx.update(alerts).set({ status: "resolved", resolvedAt: now, updatedAt: now }).where(and(...renewalConditions));
    const removedConditions = [eq(alerts.type, "PROVIDER_REMOVED"), eq(alerts.status, "open")];
    if (removedKeys.length) removedConditions.push(notInArray(alerts.dedupeKey, removedKeys));
    await tx.update(alerts).set({ status: "resolved", resolvedAt: now, updatedAt: now }).where(and(...removedConditions));
  });
  return { renewals: renewalRows.length, removedProviders: removedRows.length };
}
