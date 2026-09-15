import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { costEntries, invoices } from "@/db/schema";
import type { SpendTransaction } from "@/db";
import { recordAuditEvent } from "@/server/audit";
import { assertManualCostPeriodOpen, lockBillingAccount } from "./reconciliation";
import { currencyScale } from "@/server/finops/decimal";

/** Never edit a posted amount: retain the original and append its replacement. */
export async function correctManualEntry(db: SpendTransaction, input: {
  workspaceId: string; userId: string; entryId: string; amountMinor: bigint | null; reason: string;
}) {
  const [entry] = await db.select().from(costEntries).where(and(eq(costEntries.workspaceId,input.workspaceId),eq(costEntries.id,input.entryId))).limit(1);
  if (!entry) throw new Error("ENTRY_NOT_FOUND");
  await lockBillingAccount(db,input.workspaceId,entry.billingAccountId);
  const [current] = await db.select().from(costEntries).where(and(eq(costEntries.workspaceId,input.workspaceId),eq(costEntries.id,input.entryId))).for("update");
  if (current.supersededAt) throw new Error("ENTRY_ALREADY_CORRECTED");
  if (!["manual","manual-correction","manual-invoice"].includes(current.source)) throw new Error("PROVIDER_ENTRY_NOT_EDITABLE");
  if (input.reason.trim().length < 5 || input.reason.length > 300) throw new Error("CORRECTION_REASON_REQUIRED");
  const now = new Date();
  let invoiceId: string | null = null;
  if (current.invoiceId) {
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.workspaceId,input.workspaceId),eq(invoices.id,current.invoiceId))).for("update");
    if (!invoice || invoice.source !== "manual" || invoice.status !== "issued") throw new Error("INVOICE_NOT_EDITABLE");
    if (input.amountMinor === null) throw new Error("INVOICE_REPLACEMENT_REQUIRED");
    await db.update(invoices).set({status:"void",updatedAt:now}).where(and(eq(invoices.workspaceId,input.workspaceId),eq(invoices.id,invoice.id)));
    const [replacement] = await db.insert(invoices).values({
      workspaceId: input.workspaceId, billingAccountId: invoice.billingAccountId, connectionId: invoice.connectionId,
      externalId: `correction:${invoice.id}`, invoiceNumber: invoice.invoiceNumber, issuedAt: invoice.issuedAt,
      periodStart: invoice.periodStart, periodEnd: invoice.periodEnd, currency: invoice.currency,
      totalMinor: input.amountMinor, source:"manual", status:"issued", metadata:{replacesInvoiceId:invoice.id},
    }).returning({id:invoices.id});
    invoiceId = replacement.id;
    await db.update(costEntries).set({supersededByInvoiceId:invoiceId,updatedAt:now}).where(and(eq(costEntries.workspaceId,input.workspaceId),eq(costEntries.supersededByInvoiceId,invoice.id)));
  } else {
    await assertManualCostPeriodOpen(db,input.workspaceId,current);
  }
  const [claimed] = await db.update(costEntries).set({supersededAt:now,supersededByInvoiceId:invoiceId,updatedAt:now}).where(and(eq(costEntries.workspaceId,input.workspaceId),eq(costEntries.id,current.id),isNull(costEntries.supersededAt))).returning({id:costEntries.id});
  if (!claimed) throw new Error("ENTRY_ALREADY_CORRECTED");
  let replacementId: string | null = null;
  if (input.amountMinor !== null) {
    const [replacement] = await db.insert(costEntries).values({
      workspaceId:input.workspaceId,billingAccountId:current.billingAccountId,projectId:current.projectId,
      connectionId:current.connectionId,subscriptionId:current.subscriptionId,externalResourceId:current.externalResourceId,
      invoiceId, amountMinor:input.amountMinor,exactAmountScaled:input.amountMinor,exactAmountScale:currencyScale(current.currency),
      currency:current.currency,periodStart:current.periodStart,periodEnd:current.periodEnd,kind:current.kind,
      amountStatus:"final",amountBasis:current.amountBasis,source:invoiceId?"manual-invoice":"manual-correction",
      externalId:`correction:${current.id}`,metadata:{replacesEntryId:current.id},description:current.description,
    }).returning({id:costEntries.id});
    replacementId = replacement.id;
  }
  await recordAuditEvent({workspaceId:input.workspaceId,actorType:"user",actorUserId:input.userId,
    action:input.amountMinor===null?"ledger.entry_voided":"ledger.entry_corrected",targetType:"cost_entry",targetId:current.id,
    metadata:{reason:input.reason.trim(),replacementId,replacementInvoiceId:invoiceId}},db);
  return replacementId;
}
