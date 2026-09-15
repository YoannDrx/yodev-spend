"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { githubInstallations, projects, repositories } from "@/db/schema";
import { requireWorkspaceMutationContext } from "@/server/auth/context";
import { withWorkspaceMutation } from "@/server/auth/workspace-transaction";
import { configureGitHubAppWebhook, GitHubRepositoryAdapter } from "@/server/github/adapter";

export async function configureGitHubWebhookAction(formData:FormData){const input=z.object({locale:z.enum(["fr","en"])}).parse(Object.fromEntries(formData));const context=await requireWorkspaceMutationContext(input.locale);if(context.role!=="owner")throw new Error("Only the workspace owner can configure the GitHub App webhook.");await configureGitHubAppWebhook();revalidatePath(`/${input.locale}/settings/github`);}

export async function importGitHubRepository(formData: FormData) {
  const input=z.object({locale:z.enum(["fr","en"]),installationRecordId:z.uuid(),projectId:z.uuid(),externalId:z.coerce.number().int().positive()}).parse(Object.fromEntries(formData));
  const context=await requireWorkspaceMutationContext(input.locale);
  const installation=await withWorkspaceMutation(context.workspaceId,async(db)=>{
    const [row]=await db.select().from(githubInstallations).where(and(eq(githubInstallations.id,input.installationRecordId),eq(githubInstallations.workspaceId,context.workspaceId),eq(githubInstallations.status,"active"),isNotNull(githubInstallations.verifiedAt))).limit(1);
    return row;
  });
  if(!installation)throw new Error("Verified installation not found.");
  const canonical=await new GitHubRepositoryAdapter(installation.installationId).getRepository(input.externalId);
  if(canonical.externalId!==input.externalId)throw new Error("Repository identity mismatch.");
  await withWorkspaceMutation(context.workspaceId,async(db)=>{
    const [verified]=await db.select({id:githubInstallations.id}).from(githubInstallations).where(and(eq(githubInstallations.id,installation.id),eq(githubInstallations.workspaceId,context.workspaceId),eq(githubInstallations.status,"active"),isNotNull(githubInstallations.verifiedAt))).limit(1);
    const [project]=await db.select({id:projects.id}).from(projects).where(and(eq(projects.id,input.projectId),eq(projects.workspaceId,context.workspaceId),eq(projects.status,"active"))).limit(1);
    if(!verified||!project)throw new Error("Installation or active project unavailable.");
    await db.insert(repositories).values({workspaceId:context.workspaceId,projectId:project.id,githubInstallationId:verified.id,source:"github",...canonical,scanEnabled:true}).onConflictDoUpdate({target:[repositories.workspaceId,repositories.source,repositories.externalId],set:{...canonical,projectId:project.id,githubInstallationId:verified.id,scanEnabled:true,archivedAt:null,updatedAt:new Date()}});
  });
  revalidatePath(`/${input.locale}`,"layout");
}
