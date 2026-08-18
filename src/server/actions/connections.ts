"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { externalResourceProjects, externalResources, projects, providerConnections } from "@/db/schema";
import { requireWorkspaceMutationContext } from "@/server/auth/context";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";
import { archiveProviderConnection, connectProviderAccount } from "@/server/connectors/connections";
import { runConnectorSync, type RunnableSyncCapability } from "@/server/connectors/sync";
import { generateConnectorOptimizationFindings } from "@/server/optimization/generate";

const localeSchema = z.enum(["fr", "en"]);

function revalidateConnectionPages(locale: string) {
  revalidatePath(`/${locale}/settings`);
  revalidatePath(`/${locale}/settings/connections`);
  revalidatePath(`/${locale}/spend`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function connectVercelAction(formData: FormData) {
  const input = z.object({
    locale: localeSchema,
    name: z.string().trim().min(2).max(180),
    teamId: z.string().trim().min(3).max(240),
    token: z.string().trim().min(20).max(20_000),
  }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceMutationContext(input.locale);
  if (context.role !== "owner") throw new Error("Only a workspace owner can connect a billing provider.");

  await connectProviderAccount({
    workspaceId: context.workspaceId,
    userId: context.userId,
    providerSlug: "vercel",
    name: input.name,
    authType: "access_token",
    credentials: { token: input.token, teamId: input.teamId },
  });
  revalidateConnectionPages(input.locale);
}

export async function connectOpenAIAction(formData: FormData) {
  const input = z.object({ locale: localeSchema, name: z.string().trim().min(2).max(180), organizationId: z.string().trim().min(3).max(240), adminKey: z.string().trim().min(20).max(20_000) }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceMutationContext(input.locale);
  if (context.role !== "owner") throw new Error("Only a workspace owner can connect a billing provider.");
  await connectProviderAccount({ workspaceId: context.workspaceId, userId: context.userId, providerSlug: "openai", name: input.name, authType: "admin_key", credentials: { adminKey: input.adminKey, organizationId: input.organizationId } });
  revalidateConnectionPages(input.locale);
}

export async function connectGitHubBillingAction(formData: FormData) {
  const input = z.object({ locale: localeSchema, name: z.string().trim().min(2).max(180), organization: z.string().trim().min(1).max(100), token: z.string().trim().min(20).max(20_000) }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceMutationContext(input.locale);
  if (context.role !== "owner") throw new Error("Only a workspace owner can connect a billing provider.");
  await connectProviderAccount({ workspaceId: context.workspaceId, userId: context.userId, providerSlug: "github", name: input.name, authType: "access_token", credentials: { token: input.token, organization: input.organization } });
  revalidateConnectionPages(input.locale);
}

export async function connectAwsAction(formData: FormData) {
  const input = z.object({
    locale: localeSchema,
    name: z.string().trim().min(2).max(180),
    accountId: z.string().regex(/^\d{12}$/),
    accountName: z.string().trim().max(180).optional(),
    roleArn: z.string().trim().startsWith("arn:aws:iam::").max(240),
    externalId: z.string().trim().max(1_224).optional(),
    allocationTagKey: z.string().trim().max(128).optional(),
    costMetric: z.enum(["NetUnblendedCost", "AmortizedCost", "NetAmortizedCost"]),
  }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceMutationContext(input.locale);
  if (context.role !== "owner") throw new Error("Only a workspace owner can connect a billing provider.");
  const credentials = Object.fromEntries(Object.entries({ accountId: input.accountId, accountName: input.accountName, roleArn: input.roleArn, externalId: input.externalId, allocationTagKey: input.allocationTagKey, costMetric: input.costMetric }).filter((entry): entry is [string, string] => Boolean(entry[1])));
  await connectProviderAccount({ workspaceId: context.workspaceId, userId: context.userId, providerSlug: "aws", name: input.name, authType: "service_account", credentials });
  revalidateConnectionPages(input.locale);
}

export async function syncProviderConnectionAction(formData: FormData) {
  const input = z.object({
    locale: localeSchema,
    connectionId: z.uuid(),
    capability: z.enum(["resources", "accrued_costs", "subscriptions", "all"]),
  }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceMutationContext(input.locale);
  if (context.role !== "owner") throw new Error("Only a workspace owner can synchronize a billing provider.");
  const to = new Date();
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 35);
  const capabilities: RunnableSyncCapability[] = input.capability === "all"
    ? await withAuthorizedWorkspace(context.workspaceId, async (db) => {
      const [connection] = await db.select({ capabilities: providerConnections.capabilities }).from(providerConnections).where(and(eq(providerConnections.id, input.connectionId), eq(providerConnections.workspaceId, context.workspaceId))).limit(1);
      if (!connection) throw new Error("Provider connection not found.");
      return [
        ...(connection.capabilities.resources ? ["resources" as const] : []),
        ...(connection.capabilities.subscriptions ? ["subscriptions" as const] : []),
        ...(connection.capabilities.accruedCosts ? ["accrued_costs" as const] : []),
      ];
    })
    : [input.capability];

  for (const capability of capabilities) {
    await runConnectorSync({
      workspaceId: context.workspaceId,
      connectionId: input.connectionId,
      capability,
      from,
      to,
      idempotencyKey: `manual:${input.connectionId}:${capability}:${new Date().toISOString().slice(0, 13)}`,
    });
  }
  revalidateConnectionPages(input.locale);
}

export async function archiveProviderConnectionAction(formData: FormData) {
  const input = z.object({ locale: localeSchema, connectionId: z.uuid() }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceMutationContext(input.locale);
  if (context.role !== "owner") throw new Error("Only a workspace owner can archive a billing provider.");
  await archiveProviderConnection(context.workspaceId, input.connectionId);
  revalidateConnectionPages(input.locale);
}

export async function assignExternalResourceProjectAction(formData: FormData) {
  const input = z.object({ locale: localeSchema, externalResourceId: z.uuid(), projectId: z.uuid() }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceMutationContext(input.locale);
  const resource = await withAuthorizedWorkspace(context.workspaceId, async (db) => {
  const [resource] = await db.select().from(externalResources).where(and(eq(externalResources.id, input.externalResourceId), eq(externalResources.workspaceId, context.workspaceId))).limit(1);
  const [project] = await db.select().from(projects).where(and(eq(projects.id, input.projectId), eq(projects.workspaceId, context.workspaceId))).limit(1);
  if (!resource || !project) throw new Error("Resource or project not found.");
  const now = new Date();
    await db.update(externalResourceProjects).set({ effectiveTo: now, updatedAt: now }).where(and(
      eq(externalResourceProjects.workspaceId, context.workspaceId),
      eq(externalResourceProjects.externalResourceId, resource.id),
      isNull(externalResourceProjects.effectiveTo),
    ));
    await db.insert(externalResourceProjects).values({
      workspaceId: context.workspaceId,
      externalResourceId: resource.id,
      projectId: project.id,
      allocationBps: 10_000,
      allocationMethod: "direct",
      confirmedByUser: true,
      effectiveFrom: now,
    });
    return resource;
  });
  await generateConnectorOptimizationFindings(context.workspaceId, resource.connectionId);
  revalidateConnectionPages(input.locale);
  revalidatePath(`/${input.locale}/spend/optimizations`);
}
