"use server";

import { createHash } from "node:crypto";
import { and, eq, gt, inArray, isNull, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { billingAccounts, costEntries, invoices } from "@/db/schema";
import { requireWorkspaceMutationContext } from "@/server/auth/context";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";
import { currencyScale } from "@/server/finops/decimal";

export async function createManualInvoiceAction(formData: FormData) {
  const input = z.object({
    locale: z.enum(["fr", "en"]),
    billingAccountId: z.uuid(),
    invoiceNumber: z.string().trim().min(1).max(180),
    issuedAt: z.coerce.date(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    totalMinor: z.coerce.bigint(),
    currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  }).refine((value) => value.periodEnd >= value.periodStart, { path: ["periodEnd"], message: "Invoice period is invalid." }).parse(Object.fromEntries(formData));
  const context = await requireWorkspaceMutationContext(input.locale);
  await withAuthorizedWorkspace(context.workspaceId, async (db) => {
  const [account] = await db.select().from(billingAccounts).where(and(
    eq(billingAccounts.workspaceId, context.workspaceId),
    eq(billingAccounts.id, input.billingAccountId),
  )).limit(1);
  if (!account) throw new Error("Billing account not found.");

  const identity = createHash("sha256").update([
    account.id,
    input.invoiceNumber,
    input.issuedAt.toISOString(),
    input.totalMinor.toString(),
    input.currency,
  ].join("\u001f")).digest("hex");
  const now = new Date();
  await (async (tx) => {
    const [invoice] = await tx.insert(invoices).values({
      workspaceId: context.workspaceId,
      billingAccountId: account.id,
      connectionId: account.connectionId,
      externalId: `manual:${identity}`,
      invoiceNumber: input.invoiceNumber,
      issuedAt: input.issuedAt,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      currency: input.currency,
      totalMinor: input.totalMinor,
      status: "issued",
      source: "manual",
      documentHash: identity,
    }).onConflictDoNothing().returning({ id: invoices.id });
    if (!invoice) return;

    await tx.update(costEntries).set({ supersededAt: now, supersededByInvoiceId: invoice.id, updatedAt: now }).where(and(
      eq(costEntries.workspaceId, context.workspaceId),
      eq(costEntries.billingAccountId, account.id),
      eq(costEntries.currency, input.currency),
      inArray(costEntries.amountStatus, ["accrued", "estimated"]),
      inArray(costEntries.amountBasis, ["provider_charge", "usage_calculation"]),
      isNull(costEntries.supersededAt),
      lt(costEntries.periodStart, input.periodEnd),
      gt(costEntries.periodEnd, input.periodStart),
    ));
    await tx.insert(costEntries).values({
      workspaceId: context.workspaceId,
      billingAccountId: account.id,
      connectionId: account.connectionId,
      invoiceId: invoice.id,
      amountMinor: input.totalMinor,
      exactAmountScaled: input.totalMinor,
      exactAmountScale: currencyScale(input.currency),
      currency: input.currency,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      kind: "manual",
      amountStatus: "final",
      amountBasis: "invoice",
      source: "manual-invoice",
      externalId: identity,
      description: `Invoice ${input.invoiceNumber}`,
    });
  })(db);
  });
  revalidatePath(`/${input.locale}/spend`);
  revalidatePath(`/${input.locale}/dashboard`);
}
