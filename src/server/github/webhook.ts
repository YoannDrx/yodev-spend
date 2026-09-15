import "server-only";

import { and, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { requireServiceDb } from "@/db";
import { lockWorkspaceLifecycle } from "@/server/operations/workspace-lock";
import { githubInstallations, repositories, workspaceProfiles } from "@/db/schema";
import { getGitHubAppInstallation, GitHubRepositoryAdapter } from "./adapter";

export async function reconcileGitHubWebhook(event: string | null, payload: unknown) {
  if (event !== "installation" && event !== "installation_repositories") return;
  const parsed = z.object({action: z.string(), installation: z.object({id: z.number().int().positive()})}).safeParse(payload);
  if (!parsed.success) throw new Error("GITHUB_WEBHOOK_INVALID");
  const {action,installation} = parsed.data;
  if (event === "installation" && !["created","deleted","suspend","unsuspend","new_permissions_accepted"].includes(action)) return;
  if (event === "installation_repositories" && !["added","removed"].includes(action)) return;
  const db = requireServiceDb();
  const [row] = await db.select().from(githubInstallations).where(eq(githubInstallations.installationId,installation.id)).limit(1);
  if (!row) return;
  return db.transaction(async db=>{
  await lockWorkspaceLifecycle(db,row.workspaceId);
  const [workspace]=await db.select({status:workspaceProfiles.commercialStatus}).from(workspaceProfiles).where(eq(workspaceProfiles.id,row.workspaceId));
  if(!workspace||!["private","active","trialing","past_due"].includes(workspace.status))return;
  const now = new Date();
  if (event === "installation" && action === "deleted") {
    await db.update(githubInstallations).set({status:"deleted",lastSyncedAt:now,updatedAt:now}).where(eq(githubInstallations.id,row.id));
    return;
  }
  // Re-fetch current state: an unrelated or delayed delivery cannot reactivate access.
  const canonical = await getGitHubAppInstallation(installation.id);
  await db.update(githubInstallations).set({status:canonical.suspended?"suspended":"active",accountLogin:canonical.accountLogin,accountType:canonical.accountType,permissions:canonical.permissions,repositorySelection:canonical.repositorySelection,lastSyncedAt:now,updatedAt:now}).where(and(eq(githubInstallations.id,row.id),eq(githubInstallations.workspaceId,row.workspaceId)));
  if (event === "installation_repositories" && !canonical.suspended) {
    const accessible = await new GitHubRepositoryAdapter(installation.id).listRepositories();
    const conditions = [eq(repositories.workspaceId,row.workspaceId),eq(repositories.githubInstallationId,row.id)];
    if (accessible.length) conditions.push(notInArray(repositories.externalId,accessible.map(repo=>repo.externalId)));
    await db.update(repositories).set({scanEnabled:false,archivedAt:now,updatedAt:now}).where(and(...conditions));
  }
  });
}
