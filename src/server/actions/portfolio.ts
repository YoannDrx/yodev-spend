"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { alerts, billingAccounts, clients, integrationEvents, projectIntegrations, projects, providers, repositories } from "@/db/schema";
import { requireDb } from "@/db";
import { slugify } from "@/lib/utils";
import { requireWorkspaceContext, requireWorkspaceRole } from "@/server/auth/context";
import { isPossibleMigration } from "@/server/integrations/rules";

const clientInput = z.object({ locale:z.enum(["fr","en"]), name:z.string().trim().min(2).max(140), description:z.string().trim().max(2000).optional() });
const projectInput = z.object({ locale:z.enum(["fr","en"]), clientId:z.uuid(), name:z.string().trim().min(2).max(140), description:z.string().trim().max(2000).optional() });

export async function createClient(formData: FormData) {
  const input=clientInput.parse(Object.fromEntries(formData)); const context=await requireWorkspaceContext(input.locale); await requireWorkspaceRole(context.workspaceId,["owner","admin"],input.locale);
  await requireDb().insert(clients).values({ workspaceId:context.workspaceId,name:input.name,slug:`${slugify(input.name)}-${randomUUID().slice(0,6)}`,description:input.description });
  revalidatePath(`/${input.locale}/clients`);
}

export async function createProject(formData: FormData) {
  const input=projectInput.parse(Object.fromEntries(formData)); const context=await requireWorkspaceContext(input.locale); await requireWorkspaceRole(context.workspaceId,["owner","admin"],input.locale);
  const [client]=await requireDb().select({id:clients.id}).from(clients).where(and(eq(clients.id,input.clientId),eq(clients.workspaceId,context.workspaceId))).limit(1); if(!client) throw new Error("Client not found in workspace.");
  await requireDb().insert(projects).values({ workspaceId:context.workspaceId,clientId:input.clientId,name:input.name,slug:`${slugify(input.name)}-${randomUUID().slice(0,6)}`,description:input.description });
  revalidatePath(`/${input.locale}/projects`);
}

export async function archiveClient(formData: FormData) {
  const input=z.object({locale:z.enum(["fr","en"]),clientId:z.uuid()}).parse(Object.fromEntries(formData));
  const context=await requireWorkspaceContext(input.locale);await requireWorkspaceRole(context.workspaceId,["owner","admin"],input.locale);const db=requireDb();const now=new Date();
  await db.transaction(async(tx)=>{const [client]=await tx.update(clients).set({status:"archived",archivedAt:now,updatedAt:now}).where(and(eq(clients.id,input.clientId),eq(clients.workspaceId,context.workspaceId))).returning({id:clients.id});if(!client)throw new Error("Client not found in workspace.");const projectRows=await tx.update(projects).set({status:"archived",archivedAt:now,updatedAt:now}).where(and(eq(projects.clientId,input.clientId),eq(projects.workspaceId,context.workspaceId))).returning({id:projects.id});for(const project of projectRows)await tx.update(repositories).set({scanEnabled:false,archivedAt:now,updatedAt:now}).where(and(eq(repositories.projectId,project.id),eq(repositories.workspaceId,context.workspaceId)));});
  revalidatePath(`/${input.locale}/clients`);revalidatePath(`/${input.locale}/projects`);
}

export async function archiveProject(formData: FormData) {
  const input=z.object({locale:z.enum(["fr","en"]),projectId:z.uuid()}).parse(Object.fromEntries(formData));
  const context=await requireWorkspaceContext(input.locale);await requireWorkspaceRole(context.workspaceId,["owner","admin"],input.locale);const now=new Date();
  const db=requireDb();await db.transaction(async(tx)=>{const [project]=await tx.update(projects).set({status:"archived",archivedAt:now,updatedAt:now}).where(and(eq(projects.id,input.projectId),eq(projects.workspaceId,context.workspaceId))).returning({id:projects.id});if(!project)throw new Error("Project not found in workspace.");await tx.update(repositories).set({scanEnabled:false,archivedAt:now,updatedAt:now}).where(and(eq(repositories.projectId,input.projectId),eq(repositories.workspaceId,context.workspaceId)));});
  revalidatePath(`/${input.locale}/projects`);revalidatePath(`/${input.locale}/projects/${input.projectId}`);
}

export async function reviewDiscovery(formData: FormData) {
  const input=z.object({ locale:z.enum(["fr","en"]), integrationId:z.uuid(), decision:z.enum(["confirm","ignore"]) }).parse(Object.fromEntries(formData));
  const context=await requireWorkspaceContext(input.locale); const db=requireDb();
  const [integration]=await db.select().from(projectIntegrations).where(and(eq(projectIntegrations.id,input.integrationId),eq(projectIntegrations.workspaceId,context.workspaceId))).limit(1); if(!integration) throw new Error("Discovery not found.");
  const now=new Date();
  await db.transaction(async(tx)=>{
    await tx.update(projectIntegrations).set(input.decision==="confirm"?{lifecycleStatus:"active",reviewStatus:"confirmed",confirmedAt:now,updatedAt:now}:{reviewStatus:"ignored",ignoredAt:now,updatedAt:now}).where(eq(projectIntegrations.id,input.integrationId));
    await tx.insert(integrationEvents).values({workspaceId:context.workspaceId,integrationId:input.integrationId,actorUserId:context.userId,eventType:input.decision==="confirm"?"confirmed":"ignored"});
    if(input.decision==="confirm"){
      const [account]=await tx.select({id:billingAccounts.id}).from(billingAccounts).where(and(eq(billingAccounts.workspaceId,context.workspaceId),eq(billingAccounts.providerId,integration.providerId),eq(billingAccounts.status,"active"))).limit(1);
      if(!account)await tx.insert(alerts).values({workspaceId:context.workspaceId,type:"PROJECT_PROVIDER_WITHOUT_BILLING",severity:"info",dedupeKey:`PROJECT_PROVIDER_WITHOUT_BILLING:${integration.id}`,providerId:integration.providerId,projectId:integration.projectId,title:"Confirmed provider has no billing account",description:"Add or associate billing information if this provider has a cost."}).onConflictDoNothing();

      const [newProvider]=await tx.select({name:providers.name,category:providers.category}).from(providers).where(eq(providers.id,integration.providerId)).limit(1);
      const staleIntegrations=await tx.select({id:projectIntegrations.id,providerId:projectIntegrations.providerId,staleAt:projectIntegrations.staleAt,providerName:providers.name,category:providers.category}).from(projectIntegrations).innerJoin(providers,eq(providers.id,projectIntegrations.providerId)).where(and(eq(projectIntegrations.workspaceId,context.workspaceId),eq(projectIntegrations.projectId,integration.projectId),eq(projectIntegrations.lifecycleStatus,"stale")));
      for(const stale of staleIntegrations){
        if(!newProvider||!stale.staleAt||!isPossibleMigration({oldCategory:stale.category,newCategory:newProvider.category,oldStaleAt:stale.staleAt,newActiveAt:now}))continue;
        await tx.insert(alerts).values({workspaceId:context.workspaceId,type:"POSSIBLE_MIGRATION",severity:"warning",dedupeKey:`POSSIBLE_MIGRATION:${integration.projectId}:${stale.providerId}:${integration.providerId}`,projectId:integration.projectId,providerId:integration.providerId,title:`Possible migration: ${stale.providerName} → ${newProvider.name}`,description:"A provider in the same category became stale within thirty days of this confirmation."}).onConflictDoNothing();
      }
    }
  });
  revalidatePath(`/${input.locale}/discoveries`); revalidatePath(`/${input.locale}/dashboard`);
}
