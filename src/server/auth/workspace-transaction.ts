import "server-only";

import { sql } from "drizzle-orm";
import { requireDb, requireServiceDb, type SpendTransaction } from "@/db";

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

/** Service-only boundary for signed webhooks, cron and durable workflows. */
export function withServiceTransaction<T>(operation: (tx: WorkspaceTransaction) => Promise<T>): Promise<T> {
  return requireServiceDb().transaction(operation);
}
