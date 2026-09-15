import "server-only";
import { createHash } from "node:crypto";

import { and, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { billingAccounts, costEntries, invoices } from "@/db/schema";
import type { SpendTransaction } from "@/db";
import { currencyScale } from "@/server/finops/decimal";

type Period = { periodStart: Date; periodEnd: Date };
export function overlaps(left: Period, right: Period) {
  return left.periodStart < right.periodEnd && left.periodEnd > right.periodStart;
}
export function covers(outer: Period, inner: Period) {
  return outer.periodStart <= inner.periodStart && outer.periodEnd >= inner.periodEnd;
}

export function lockBillingAccount(db: SpendTransaction, workspaceId: string, accountId: string) {
  return db.execute(sql`select pg_advisory_xact_lock(hashtext(${`spend-ledger:${workspaceId}:${accountId}`}))`);
}

/** Manual adjustments to a closed period require explicit invoice correction. */
export async function assertManualCostPeriodOpen(db: SpendTransaction, workspaceId: string, input: Period & {billingAccountId: string; currency: string}) {
  await lockBillingAccount(db, workspaceId, input.billingAccountId);
  const closed = await db.select({id: invoices.id}).from(invoices).where(and(
    eq(invoices.workspaceId, workspaceId), eq(invoices.billingAccountId, input.billingAccountId),
    eq(invoices.currency, input.currency), eq(invoices.status, "issued"),
    lt(invoices.periodStart, input.periodEnd), gt(invoices.periodEnd, input.periodStart),
  )).limit(1);
  if (closed.length) throw new Error("INVOICE_CLOSED_PERIOD_REQUIRES_REVIEW");
}

export type ManualInvoiceInput = Period & {
  billingAccountId: string;
  invoiceNumber: string;
  issuedAt: Date;
  totalMinor: bigint;
  currency: string;
};

/** A manual total closes a whole account period; ambiguous partial overlap requires review. */
export async function recordManualInvoice(db: SpendTransaction, workspaceId: string, input: ManualInvoiceInput) {
  await lockBillingAccount(db, workspaceId, input.billingAccountId);
  const [account] = await db.select().from(billingAccounts).where(and(eq(billingAccounts.workspaceId, workspaceId), eq(billingAccounts.id, input.billingAccountId), eq(billingAccounts.status, "active"))).limit(1);
  if (!account) throw new Error("BILLING_ACCOUNT_UNAVAILABLE");
  if (input.periodEnd <= input.periodStart) throw new Error("INVOICE_PERIOD_INVALID");
  const existing = await db.select().from(invoices).where(and(eq(invoices.workspaceId, workspaceId), eq(invoices.billingAccountId, account.id), eq(invoices.invoiceNumber, input.invoiceNumber), eq(invoices.status, "issued")));
  if (existing.length) {
    const invoice = existing[0];
    if (invoice.currency !== input.currency || invoice.totalMinor !== input.totalMinor || +invoice.issuedAt !== +input.issuedAt || +invoice.periodStart !== +input.periodStart || +invoice.periodEnd !== +input.periodEnd) throw new Error("INVOICE_CONFLICT_REQUIRES_REVIEW");
    return invoice.id;
  }
  const closedPeriods = await db.select().from(invoices).where(and(eq(invoices.workspaceId, workspaceId), eq(invoices.billingAccountId, account.id), eq(invoices.currency, input.currency), eq(invoices.status, "issued"), lt(invoices.periodStart, input.periodEnd), gt(invoices.periodEnd, input.periodStart)));
  if (closedPeriods.length) throw new Error("INVOICE_OVERLAP_REQUIRES_REVIEW");
  const existingFinal = await db.select({id:costEntries.id}).from(costEntries).where(and(eq(costEntries.workspaceId,workspaceId),eq(costEntries.billingAccountId,account.id),eq(costEntries.currency,input.currency),eq(costEntries.amountStatus,"final"),isNull(costEntries.supersededAt),lt(costEntries.periodStart,input.periodEnd),gt(costEntries.periodEnd,input.periodStart))).limit(1);
  if (existingFinal.length) throw new Error("INVOICE_FINAL_COSTS_REQUIRE_REVIEW");
  const accrued = await db.select().from(costEntries).where(and(eq(costEntries.workspaceId, workspaceId), eq(costEntries.billingAccountId, account.id), eq(costEntries.currency, input.currency), inArray(costEntries.amountStatus, ["accrued", "estimated"]), inArray(costEntries.amountBasis, ["provider_charge", "usage_calculation"]), isNull(costEntries.supersededAt), lt(costEntries.periodStart, input.periodEnd), gt(costEntries.periodEnd, input.periodStart)));
  if (accrued.some((cost) => !covers(input, cost))) throw new Error("INVOICE_PARTIAL_COVERAGE_REQUIRES_REVIEW");
  const externalId = createHash("sha256").update(`${account.id}\u001f${input.invoiceNumber}`).digest("hex");
  const [invoice] = await db.insert(invoices).values({ ...input, externalId, workspaceId, connectionId: account.connectionId, status: "issued", source: "manual" }).returning({id: invoices.id});
  const now = new Date();
  if (accrued.length) await db.update(costEntries).set({supersededAt: now, supersededByInvoiceId: invoice.id, updatedAt: now}).where(and(eq(costEntries.workspaceId, workspaceId), inArray(costEntries.id, accrued.map((cost) => cost.id))));
  await db.insert(costEntries).values({workspaceId, billingAccountId: account.id, connectionId: account.connectionId, invoiceId: invoice.id, amountMinor: input.totalMinor, exactAmountScaled: input.totalMinor, exactAmountScale: currencyScale(input.currency), currency: input.currency, periodStart: input.periodStart, periodEnd: input.periodEnd, kind: "manual", amountStatus: "final", amountBasis: "invoice", source: "manual-invoice", externalId: invoice.id, description: `Invoice ${input.invoiceNumber}`});
  return invoice.id;
}

export function matchingInvoice<T extends Period & { currency: string; id: string }>(closed: T[], cost: Period & {currency: string}) {
  const matches = closed.filter((invoice) => invoice.currency === cost.currency && overlaps(invoice, cost));
  if (matches.length > 1 || matches.some((invoice) => !covers(invoice, cost))) throw new Error("INVOICE_PARTIAL_COVERAGE_REQUIRES_REVIEW");
  return matches[0] ?? null;
}
