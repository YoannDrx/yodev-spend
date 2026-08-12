"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { githubInstallations, projects, repositories } from "@/db/schema";
import { requireDb } from "@/db";
import { requireWorkspaceContext } from "@/server/auth/context";
import { configureGitHubAppWebhook } from "@/server/github/adapter";

export async function configureGitHubWebhookAction(formData:FormData){const input=z.object({locale:z.enum(["fr","en"])}).parse(Object.fromEntries(formData));const context=await requireWorkspaceContext(input.locale);if(context.role!=="owner")throw new Error("Only the workspace owner can configure the GitHub App webhook.");await configureGitHubAppWebhook();revalidatePath(`/${input.locale}/settings/github`);}

export async function importGitHubRepository(formData:FormData){const input=z.object({locale:z.enum(["fr","en"]),installationRecordId:z.uuid(),projectId:z.uuid(),externalId:z.coerce.number().int().positive(),owner:z.string().min(1),name:z.string().min(1),fullName:z.string().min(1),defaultBranch:z.string().min(1),htmlUrl:z.url(),isPrivate:z.enum(["true","false"])}).parse(Object.fromEntries(formData));const context=await requireWorkspaceContext(input.locale);const db=requireDb();const [[installation],[project]]=await Promise.all([db.select({id:githubInstallations.id}).from(githubInstallations).where(and(eq(githubInstallations.id,input.installationRecordId),eq(githubInstallations.workspaceId,context.workspaceId),eq(githubInstallations.status,"active"))).limit(1),db.select({id:projects.id}).from(projects).where(and(eq(projects.id,input.projectId),eq(projects.workspaceId,context.workspaceId))).limit(1)]);if(!installation||!project)throw new Error("Installation or project does not belong to the workspace.");await db.insert(repositories).values({workspaceId:context.workspaceId,projectId:project.id,githubInstallationId:installation.id,source:"github",externalId:input.externalId,owner:input.owner,name:input.name,fullName:input.fullName,defaultBranch:input.defaultBranch,htmlUrl:input.htmlUrl,isPrivate:input.isPrivate==="true",scanEnabled:true}).onConflictDoUpdate({target:[repositories.workspaceId,repositories.source,repositories.externalId],set:{projectId:project.id,githubInstallationId:installation.id,defaultBranch:input.defaultBranch,htmlUrl:input.htmlUrl,isPrivate:input.isPrivate==="true",archivedAt:null,updatedAt:new Date()}});revalidatePath(`/${input.locale}/settings/github`);revalidatePath(`/${input.locale}/projects`);}
