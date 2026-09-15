import "server-only";

import { isExportWindowExpired } from "@/server/privacy/access";
import { eq } from "drizzle-orm";
import { alerts, billingAccountProjects, billingAccounts, clients, costEntries, externalResourceProjects, invoices, projects, projectIntegrations, providerConnections, repositories, subscriptions, workspaceProfiles } from "@/db/schema";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";
import { assertWorkspaceRole } from "@/server/auth/authorization";
import type { WorkspaceContext } from "@/server/auth/context";

const limit = 10_001;

/** Explicit field lists prevent new secret columns from silently entering an export. */
export async function exportWorkspace(context: WorkspaceContext) {
  assertWorkspaceRole(context.role, ["owner"]);
  return withAuthorizedWorkspace(context.workspaceId, async (db) => {
    const id = context.workspaceId;
    if (await isExportWindowExpired(db,id)) throw new Error("EXPORT_WINDOW_EXPIRED");
    const data = {
      workspace: await db.select({id: workspaceProfiles.id, name: workspaceProfiles.name, currency: workspaceProfiles.baseCurrency, locale: workspaceProfiles.locale}).from(workspaceProfiles).where(eq(workspaceProfiles.id, id)),
      clients: await db.select({id: clients.id, name: clients.name, description: clients.description, status: clients.status, archivedAt: clients.archivedAt}).from(clients).where(eq(clients.workspaceId, id)).limit(limit),
      projects: await db.select({id: projects.id, clientId: projects.clientId, name: projects.name, description: projects.description, status: projects.status, archivedAt: projects.archivedAt}).from(projects).where(eq(projects.workspaceId, id)).limit(limit),
      repositories: await db.select({id: repositories.id, projectId: repositories.projectId, fullName: repositories.fullName, scanEnabled: repositories.scanEnabled, lastSuccessfulScanAt: repositories.lastSuccessfulScanAt}).from(repositories).where(eq(repositories.workspaceId, id)).limit(limit),
      integrations: await db.select({id: projectIntegrations.id, projectId: projectIntegrations.projectId, providerId: projectIntegrations.providerId, confidence: projectIntegrations.confidence, lifecycleStatus: projectIntegrations.lifecycleStatus, reviewStatus: projectIntegrations.reviewStatus}).from(projectIntegrations).where(eq(projectIntegrations.workspaceId, id)).limit(limit),
      connections: await db.select({id: providerConnections.id, providerId: providerConnections.providerId, status: providerConnections.status, lastSuccessfulSyncAt: providerConnections.lastSuccessfulSyncAt, archivedAt: providerConnections.archivedAt}).from(providerConnections).where(eq(providerConnections.workspaceId, id)).limit(limit),
      billingAccounts: await db.select({id: billingAccounts.id, providerId: billingAccounts.providerId, connectionId: billingAccounts.connectionId, name: billingAccounts.name, ownerType: billingAccounts.ownerType, clientId: billingAccounts.clientId, status: billingAccounts.status}).from(billingAccounts).where(eq(billingAccounts.workspaceId, id)).limit(limit),
      subscriptions: await db.select({id: subscriptions.id, billingAccountId: subscriptions.billingAccountId, name: subscriptions.name, amountMinor: subscriptions.amountMinor, currency: subscriptions.currency, billingInterval: subscriptions.billingInterval, status: subscriptions.status, renewalDate: subscriptions.renewalDate}).from(subscriptions).where(eq(subscriptions.workspaceId, id)).limit(limit),
      costs: await db.select({id: costEntries.id, billingAccountId: costEntries.billingAccountId, projectId: costEntries.projectId, externalResourceId: costEntries.externalResourceId, amountMinor: costEntries.amountMinor, exactAmountScaled: costEntries.exactAmountScaled, exactAmountScale: costEntries.exactAmountScale, currency: costEntries.currency, periodStart: costEntries.periodStart, periodEnd: costEntries.periodEnd, kind: costEntries.kind, amountStatus: costEntries.amountStatus, amountBasis: costEntries.amountBasis, source: costEntries.source, invoiceId: costEntries.invoiceId, supersededAt: costEntries.supersededAt, supersededByInvoiceId: costEntries.supersededByInvoiceId}).from(costEntries).where(eq(costEntries.workspaceId, id)).limit(limit),
      invoices: await db.select({id: invoices.id, billingAccountId: invoices.billingAccountId, invoiceNumber: invoices.invoiceNumber, issuedAt: invoices.issuedAt, periodStart: invoices.periodStart, periodEnd: invoices.periodEnd, totalMinor: invoices.totalMinor, currency: invoices.currency, status: invoices.status, source: invoices.source}).from(invoices).where(eq(invoices.workspaceId, id)).limit(limit),
      accountAllocations: await db.select({billingAccountId: billingAccountProjects.billingAccountId, projectId: billingAccountProjects.projectId, allocationBps: billingAccountProjects.allocationBps, allocationMethod: billingAccountProjects.allocationMethod, effectiveFrom: billingAccountProjects.effectiveFrom, effectiveTo: billingAccountProjects.effectiveTo}).from(billingAccountProjects).where(eq(billingAccountProjects.workspaceId, id)).limit(limit),
      resourceAllocations: await db.select({externalResourceId: externalResourceProjects.externalResourceId, projectId: externalResourceProjects.projectId, allocationBps: externalResourceProjects.allocationBps, allocationMethod: externalResourceProjects.allocationMethod, effectiveFrom: externalResourceProjects.effectiveFrom, effectiveTo: externalResourceProjects.effectiveTo}).from(externalResourceProjects).where(eq(externalResourceProjects.workspaceId, id)).limit(limit),
      alerts: await db.select({id: alerts.id, type: alerts.type, status: alerts.status, severity: alerts.severity, title: alerts.title, description: alerts.description, createdAt: alerts.createdAt}).from(alerts).where(eq(alerts.workspaceId, id)).limit(limit),
    };
    if (Object.values(data).some((rows) => rows.length >= limit)) throw new Error("EXPORT_TOO_LARGE");
    return JSON.stringify({version: 1, generatedAt: new Date().toISOString(), moneyEncoding: "Integer minor units and exact scaled integers are decimal strings; preserve currency and scale.", ...data}, (_, value: unknown) => typeof value === "bigint" ? value.toString() : value, 2);
  });
}
