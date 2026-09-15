"use server";

import { parseMoneyInput } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspaceMutationContext } from "@/server/auth/context";
import { withWorkspaceMutation } from "@/server/auth/workspace-transaction";
import { recordManualInvoice } from "@/server/billing/reconciliation";

export async function createManualInvoiceAction(formData: FormData) {
  const input = z.object({
    locale: z.enum(["fr", "en"]),
    billingAccountId: z.uuid(),
    invoiceNumber: z.string().trim().min(1).max(180),
    issuedAt: z.coerce.date(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    totalMinor: z.coerce.bigint(),
    currency: z.string().trim().toUpperCase().refine((value) => Intl.supportedValuesOf("currency").includes(value), "Invalid currency"),
  }).refine((value) => value.periodEnd > value.periodStart, { path: ["periodEnd"], message: "Invoice period is invalid." }).parse({...Object.fromEntries(formData),totalMinor:formData.has("amount")?parseMoneyInput(String(formData.get("amount")),String(formData.get("currency")??"EUR")):formData.get("totalMinor")});
  const context = await requireWorkspaceMutationContext(input.locale);
  try {
    await withWorkspaceMutation(context.workspaceId, (db) => recordManualInvoice(db, context.workspaceId, input));
  } catch (error) {
    if (error instanceof Error && ["INVOICE_CONFLICT_REQUIRES_REVIEW","INVOICE_OVERLAP_REQUIRES_REVIEW","INVOICE_FINAL_COSTS_REQUIRE_REVIEW","INVOICE_PARTIAL_COVERAGE_REQUIRES_REVIEW"].includes(error.message)) return {error:"invoiceConflict"};
    throw error;
  }
  revalidatePath(`/${input.locale}`, "layout");
}
