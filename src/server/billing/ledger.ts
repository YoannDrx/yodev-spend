import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { billingAccounts, costEntries } from "@/db/schema";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";

export function getRecentLedgerEntries(workspaceId: string) {
  return withAuthorizedWorkspace(workspaceId, db => db.select({
    id:costEntries.id, account:billingAccounts.name, amountMinor:costEntries.amountMinor, currency:costEntries.currency,
    periodStart:costEntries.periodStart, periodEnd:costEntries.periodEnd, status:costEntries.amountStatus,
    invoiceId:costEntries.invoiceId, source:costEntries.source, supersededAt:costEntries.supersededAt,
  }).from(costEntries).innerJoin(billingAccounts,and(eq(billingAccounts.id,costEntries.billingAccountId),eq(billingAccounts.workspaceId,workspaceId))).where(eq(costEntries.workspaceId,workspaceId)).orderBy(desc(costEntries.createdAt),costEntries.id).limit(100));
}
