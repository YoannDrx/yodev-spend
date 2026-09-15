import "server-only";

import { eq, sql } from "drizzle-orm";
import { requireDb, requireServiceDb, type SpendTransaction } from "@/db";
import { workspaceProfiles } from "@/db/schema";
import { getWorkspaceEntitlements } from "@/server/commercial/plans";

export type WorkspaceTransaction = SpendTransaction;

/**
 * Opens the transaction boundary required by the restricted application role.
 * Authorization must already have been derived from the Better Auth session;
 * this helper only carries that trusted workspace into PostgreSQL RLS.
 */
export function withAuthorizedWorkspace<T>(
  workspaceId: string,
  operation: (tx: WorkspaceTransaction) => Promise<T>,
): Promise<T> {
  return requireDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`);
    return operation(tx);
  });
}

/** Recheck write access inside the same lock/transaction as the write. */
export function withWorkspaceMutation<T>(workspaceId: string, operation: (tx: WorkspaceTransaction) => Promise<T>): Promise<T> {
  return withAuthorizedWorkspace(workspaceId, async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock_shared(hashtext(${`spend-lifecycle:${workspaceId}`}))`);
    const [workspace] = await tx.select({status:workspaceProfiles.commercialStatus}).from(workspaceProfiles).where(eq(workspaceProfiles.id,workspaceId));
    if (!workspace || !["private","active","trialing","past_due"].includes(workspace.status)) throw new Error("WORKSPACE_READ_ONLY");
    if (workspace.status === "past_due" && (await getWorkspaceEntitlements(workspaceId,tx)).code === "inactive") throw new Error("WORKSPACE_READ_ONLY");
    return operation(tx);
  });
}

/** Service-only boundary for signed webhooks, cron and durable workflows. */
export function withServiceTransaction<T>(operation: (tx: WorkspaceTransaction) => Promise<T>): Promise<T> {
  return requireServiceDb().transaction(operation);
}
