"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { alerts, billingAccountProjects, billingAccounts, clients, costEntries, projects, providers, subscriptions } from "@/db/schema";
import { requireWorkspaceMutationContext } from "@/server/auth/context";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";
import { equalAllocationBps } from "@/server/billing/money";

export async function createBillingAccount(formData: FormData) {
  const input=z.object({locale:z.enum(["fr","en"]),name:z.string().trim().min(2).max(180),providerSlug:z.string().min(1),ownerType:z.enum(["workspace","client","shared"]),clientId:z.union([z.literal(""),z.uuid()]).optional(),projectIds:z.array(z.uuid()).max(50),allocationMethod:z.enum(["equal","manual"]).default("equal"),amountMinor:z.coerce.bigint().nonnegative(),billingInterval:z.enum(["month","year"])}).superRefine((value,context)=>{if(value.ownerType==="client"&&!value.clientId)context.addIssue({code:"custom",path:["clientId"],message:"A client owner is required."});if(value.ownerType==="shared"&&!value.projectIds.length)context.addIssue({code:"custom",path:["projectIds"],message:"Select at least one project for a shared account."});}).parse({...Object.fromEntries(formData),projectIds:formData.getAll("projectIds")});
  const context=await requireWorkspaceMutationContext(input.locale);
  await withAuthorizedWorkspace(context.workspaceId,async(tx)=>{
    const [provider]=await tx.select({id:providers.id}).from(providers).where(eq(providers.slug,input.providerSlug)).limit(1); if(!provider) throw new Error("Provider not found.");
    let associatedProjects:Array<{id:string}>=[];
    if(input.ownerType==="client"){
      const [client]=await tx.select({id:clients.id}).from(clients).where(and(eq(clients.id,input.clientId!),eq(clients.workspaceId,context.workspaceId),eq(clients.status,"active"))).limit(1);if(!client)throw new Error("Client not found in workspace.");
      associatedProjects=await tx.select({id:projects.id}).from(projects).where(and(eq(projects.workspaceId,context.workspaceId),eq(projects.clientId,client.id),eq(projects.status,"active")));
    }else if(input.ownerType==="shared"){
      associatedProjects=await tx.select({id:projects.id}).from(projects).where(and(eq(projects.workspaceId,context.workspaceId),eq(projects.status,"active"),inArray(projects.id,input.projectIds)));
      if(associatedProjects.length!==new Set(input.projectIds).size)throw new Error("One or more projects do not belong to the workspace.");
    }
    const [account]=await tx.insert(billingAccounts).values({workspaceId:context.workspaceId,providerId:provider.id,clientId:input.ownerType==="client"?input.clientId||null:null,name:input.name,ownerType:input.ownerType}).returning({id:billingAccounts.id});
    if(associatedProjects.length){const sorted=[...associatedProjects].sort((left,right)=>left.id.localeCompare(right.id));const allocationMethod=input.ownerType==="shared"?input.allocationMethod:"equal";const allocations=allocationMethod==="manual"?manualAllocationBps(formData,sorted.map((project)=>project.id)):equalAllocationBps(sorted.length);await tx.insert(billingAccountProjects).values(sorted.map((project,index)=>({workspaceId:context.workspaceId,billingAccountId:account.id,projectId:project.id,allocationBps:allocations[index],allocationMethod,confirmedByUser:input.ownerType==="shared"})));}
    await tx.insert(subscriptions).values({workspaceId:context.workspaceId,billingAccountId:account.id,name:input.name,billingModel:input.billingInterval==="year"?"fixed_yearly":"fixed_monthly",amountMinor:input.amountMinor,currency:"EUR",billingInterval:input.billingInterval,status:"active"});
    if(input.amountMinor>0n&&!associatedProjects.length)await tx.insert(alerts).values({workspaceId:context.workspaceId,type:"PAID_PROVIDER_WITHOUT_PROJECT",severity:"warning",dedupeKey:`PAID_PROVIDER_WITHOUT_PROJECT:${account.id}`,providerId:provider.id,billingAccountId:account.id,title:`${input.name} has no project`,description:"This active recurring account is not associated with an active project yet."}).onConflictDoNothing();
  });
  revalidatePath(`/${input.locale}/spend`); revalidatePath(`/${input.locale}/dashboard`);
}

function manualAllocationBps(formData: FormData, projectIds: string[]) {
  const allocations = projectIds.map((projectId) => z.coerce.number().int().min(0).max(10_000).parse(formData.get(`allocationBps:${projectId}`)));
  if (allocations.reduce((sum, value) => sum + value, 0) !== 10_000) throw new Error("Manual allocations must total exactly 10,000 basis points.");
  return allocations;
}

export async function updateBillingAccountAllocation(formData: FormData) {
  const input = z.object({
    locale: z.enum(["fr", "en"]),
    billingAccountId: z.uuid(),
    projectIds: z.array(z.uuid()).min(1).max(50),
    allocationMethod: z.enum(["equal", "manual"]),
  }).parse({ ...Object.fromEntries(formData), projectIds: formData.getAll("projectIds") });
  const context = await requireWorkspaceMutationContext(input.locale);
  const now = new Date();
  await withAuthorizedWorkspace(context.workspaceId, async (db) => {
    const [account] = await db.select({ id: billingAccounts.id }).from(billingAccounts).where(and(
      eq(billingAccounts.id, input.billingAccountId),
      eq(billingAccounts.workspaceId, context.workspaceId),
      eq(billingAccounts.status, "active"),
    )).limit(1);
    if (!account) throw new Error("Billing account not found.");
    const selected = await db.select({ id: projects.id }).from(projects).where(and(
      eq(projects.workspaceId, context.workspaceId),
      eq(projects.status, "active"),
      inArray(projects.id, input.projectIds),
    ));
    if (selected.length !== new Set(input.projectIds).size) throw new Error("One or more projects do not belong to the workspace.");
    const sorted = [...selected].sort((left, right) => left.id.localeCompare(right.id));
    const allocations = input.allocationMethod === "manual"
      ? manualAllocationBps(formData, sorted.map((project) => project.id))
      : equalAllocationBps(sorted.length);
    await db.update(billingAccountProjects).set({ effectiveTo: now, updatedAt: now }).where(and(
      eq(billingAccountProjects.workspaceId, context.workspaceId),
      eq(billingAccountProjects.billingAccountId, account.id),
      isNull(billingAccountProjects.effectiveTo),
    ));
    await db.insert(billingAccountProjects).values(sorted.map((project, index) => ({
      workspaceId: context.workspaceId,
      billingAccountId: account.id,
      projectId: project.id,
      allocationBps: allocations[index],
      allocationMethod: input.allocationMethod,
      confirmedByUser: true,
      effectiveFrom: now,
    })));
  });
  revalidatePath(`/${input.locale}/spend`);
  revalidatePath(`/${input.locale}/dashboard`);
  revalidatePath(`/${input.locale}/projects`);
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

  const context = await requireWorkspaceMutationContext(input.locale);
  await withAuthorizedWorkspace(context.workspaceId, async (db) => {
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
  });
  revalidatePath(`/${input.locale}/spend`);
  revalidatePath(`/${input.locale}/dashboard`);
}

export async function archiveBillingAccount(formData: FormData) {
  const input=z.object({locale:z.enum(["fr","en"]),billingAccountId:z.uuid()}).parse(Object.fromEntries(formData));const context=await requireWorkspaceMutationContext(input.locale);const now=new Date();
  await withAuthorizedWorkspace(context.workspaceId,async(tx)=>{const [account]=await tx.update(billingAccounts).set({status:"archived",archivedAt:now,updatedAt:now}).where(and(eq(billingAccounts.id,input.billingAccountId),eq(billingAccounts.workspaceId,context.workspaceId))).returning({id:billingAccounts.id});if(!account)throw new Error("Billing account not found.");await tx.update(subscriptions).set({status:"cancelled",cancelledAt:now,updatedAt:now}).where(and(eq(subscriptions.billingAccountId,input.billingAccountId),eq(subscriptions.workspaceId,context.workspaceId),eq(subscriptions.status,"active")));});
  revalidatePath(`/${input.locale}/spend`);revalidatePath(`/${input.locale}/dashboard`);
}
