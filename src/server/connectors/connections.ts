import "server-only";

import { and, eq } from "drizzle-orm";
import { billingAccounts, providerConnections, providers } from "@/db/schema";
import { requireServiceDb } from "@/db";
import { credentialBinding, encryptCredentials } from "./credentials";
import { getConnector } from "./registry";
import { assertWorkspaceCanCreate } from "@/server/commercial/quotas";

export async function connectProviderAccount(input: {
  workspaceId: string;
  userId: string;
  providerSlug: string;
  name: string;
  authType: "oauth2" | "api_key" | "admin_key" | "service_account" | "access_token" | "email" | "manual";
  credentials: Record<string, string>;
}) {
  const db = requireServiceDb();
  const [provider] = await db.select().from(providers).where(eq(providers.slug, input.providerSlug)).limit(1);
  if (!provider?.billingSupported) throw new Error("This provider does not have an implemented Spend connector.");

  const connector = getConnector(input.providerSlug);
  const account = await connector.validate(input.credentials);
  const encrypted = encryptCredentials(input.credentials, credentialBinding(input.workspaceId, input.providerSlug));
  const now = new Date();

  const existingConnection = await db.select({ id: providerConnections.id }).from(providerConnections).where(and(
    eq(providerConnections.workspaceId, input.workspaceId),
    eq(providerConnections.providerId, provider.id),
    eq(providerConnections.externalAccountId, account.externalId),
  )).limit(1);
  if (!existingConnection[0]) await assertWorkspaceCanCreate(input.workspaceId, "connection");

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(providerConnections).where(and(
      eq(providerConnections.workspaceId, input.workspaceId),
      eq(providerConnections.providerId, provider.id),
      eq(providerConnections.externalAccountId, account.externalId),
    )).limit(1);

    const values = {
      name: input.name,
      authType: input.authType,
      status: "active" as const,
      externalAccountId: account.externalId,
      externalAccountName: account.name,
      capabilities: connector.capabilities,
      credentialCiphertext: encrypted.ciphertext,
      credentialIv: encrypted.iv,
      credentialTag: encrypted.tag,
      credentialKeyVersion: encrypted.keyVersion,
      lastValidatedAt: now,
      lastErrorCode: null,
      archivedAt: null,
      updatedAt: now,
    };

    const [connection] = existing
      ? await tx.update(providerConnections).set(values).where(and(
        eq(providerConnections.id, existing.id),
        eq(providerConnections.workspaceId, input.workspaceId),
      )).returning()
      : await tx.insert(providerConnections).values({
        workspaceId: input.workspaceId,
        providerId: provider.id,
        createdByUserId: input.userId,
        ...values,
      }).returning();

    const [billingAccount] = await tx.select().from(billingAccounts).where(and(
      eq(billingAccounts.workspaceId, input.workspaceId),
      eq(billingAccounts.connectionId, connection.id),
    )).limit(1);
    if (!billingAccount) {
      await tx.insert(billingAccounts).values({
        workspaceId: input.workspaceId,
        providerId: provider.id,
        connectionId: connection.id,
        name: account.name,
        ownerType: "workspace",
        status: "active",
        defaultCurrency: account.currency,
        source: input.providerSlug,
      });
    }
    return connection;
  });
}

export async function archiveProviderConnection(workspaceId: string, connectionId: string) {
  const now = new Date();
  const [connection] = await requireServiceDb().update(providerConnections).set({
    status: "archived",
    archivedAt: now,
    credentialCiphertext: null,
    credentialIv: null,
    credentialTag: null,
    updatedAt: now,
  }).where(and(
    eq(providerConnections.id, connectionId),
    eq(providerConnections.workspaceId, workspaceId),
  )).returning({ id: providerConnections.id });
  if (!connection) throw new Error("Provider connection not found.");
}
