"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { alerts, billingAccounts, costEntries, providers, subscriptions } from "@/db/schema";
import { requireDb } from "@/db";
import { requireWorkspaceContext } from "@/server/auth/context";

export async function createBillingAccount(formData: FormData) {
  const input=z.object({locale:z.enum(["fr","en"]),name:z.string().trim().min(2).max(180),providerSlug:z.string().min(1),ownerType:z.enum(["workspace","client","shared"]),amountMinor:z.coerce.bigint().nonnegative(),billingInterval:z.enum(["month","year"])}).parse(Object.fromEntries(formData));
  const context=await requireWorkspaceContext(input.locale); const db=requireDb(); const [provider]=await db.select({id:providers.id}).from(providers).where(eq(providers.slug,input.providerSlug)).limit(1); if(!provider) throw new Error("Provider not found.");
  await db.transaction(async(tx)=>{ const [account]=await tx.insert(billingAccounts).values({workspaceId:context.workspaceId,providerId:provider.id,name:input.name,ownerType:input.ownerType}).returning({id:billingAccounts.id}); await tx.insert(subscriptions).values({workspaceId:context.workspaceId,billingAccountId:account.id,name:input.name,billingModel:input.billingInterval==="year"?"fixed_yearly":"fixed_monthly",amountMinor:input.amountMinor,currency:"EUR",billingInterval:input.billingInterval,status:"active"}); if(input.amountMinor>0n)await tx.insert(alerts).values({workspaceId:context.workspaceId,type:"PAID_PROVIDER_WITHOUT_PROJECT",severity:"warning",dedupeKey:`PAID_PROVIDER_WITHOUT_PROJECT:${account.id}`,providerId:provider.id,billingAccountId:account.id,title:`${input.name} has no project`,description:"This active recurring account is not associated with an active project yet."}).onConflictDoNothing(); });
  revalidatePath(`/${input.locale}/spend`); revalidatePath(`/${input.locale}/dashboard`);
}

export async function createCostEntry(formData: FormData) {
  const input = z.object({
    locale: z.enum(["fr", "en"]),
    billingAccountId: z.uuid(),
    type: z.enum(["subscription", "usage", "credit", "tax", "manual"]),
    amountMinor: z.coerce.bigint(),
    currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    description: z.string().trim().max(240).optional(),
  }).refine((value) => value.periodEnd >= value.periodStart, {
    message: "The end of the period must be after its start.",
    path: ["periodEnd"],
  }).parse(Object.fromEntries(formData));

  const context = await requireWorkspaceContext(input.locale);
  const db = requireDb();
  const [account] = await db.select({ id: billingAccounts.id })
    .from(billingAccounts)
    .where(and(eq(billingAccounts.id, input.billingAccountId), eq(billingAccounts.workspaceId, context.workspaceId)))
    .limit(1);
  if (!account) throw new Error("Billing account not found.");

  const amountMinor = input.type === "credit" && input.amountMinor > 0n
    ? -input.amountMinor
    : input.amountMinor;
  await db.insert(costEntries).values({
    workspaceId: context.workspaceId,
    billingAccountId: account.id,
    kind: input.type,
    amountMinor,
    currency: input.currency,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    description: input.description || null,
    source: "manual",
  });
  revalidatePath(`/${input.locale}/spend`);
  revalidatePath(`/${input.locale}/dashboard`);
}

export async function archiveBillingAccount(formData: FormData) {
  const input=z.object({locale:z.enum(["fr","en"]),billingAccountId:z.uuid()}).parse(Object.fromEntries(formData));const context=await requireWorkspaceContext(input.locale);const db=requireDb();const now=new Date();
  await db.transaction(async(tx)=>{const [account]=await tx.update(billingAccounts).set({status:"archived",archivedAt:now,updatedAt:now}).where(and(eq(billingAccounts.id,input.billingAccountId),eq(billingAccounts.workspaceId,context.workspaceId))).returning({id:billingAccounts.id});if(!account)throw new Error("Billing account not found.");await tx.update(subscriptions).set({status:"cancelled",cancelledAt:now,updatedAt:now}).where(and(eq(subscriptions.billingAccountId,input.billingAccountId),eq(subscriptions.workspaceId,context.workspaceId),eq(subscriptions.status,"active")));});
  revalidatePath(`/${input.locale}/spend`);revalidatePath(`/${input.locale}/dashboard`);
}
