import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { requireServiceDb } from "@/db";
import { githubInstallations, repositories } from "@/db/schema";

const mock = vi.hoisted(() => ({installation: vi.fn(), repos: vi.fn()}));
vi.mock("./adapter",()=>({getGitHubAppInstallation:mock.installation, GitHubRepositoryAdapter:class { listRepositories=mock.repos; }}));
import { reconcileGitHubWebhook } from "./webhook";

const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite("GitHub webhook access lifecycle",()=>{
  const workspaceId="00000000-0000-4000-8000-000000000001";
  it("ignores unrelated events and reconciles a delayed unsuspend with GitHub's current state", async()=>{
    const id=Number(BigInt(`0x${randomUUID().replaceAll("-","").slice(0,10)}`));
    const [row]=await requireServiceDb().insert(githubInstallations).values({workspaceId,installationId:id,accountLogin:"audit",accountType:"Organization",status:"suspended",verifiedAt:new Date()}).returning();
    await reconcileGitHubWebhook("push",{action:"anything",installation:{id}});
    expect(mock.installation).not.toHaveBeenCalled();
    mock.installation.mockResolvedValue({installationId:id,accountLogin:"audit",accountType:"Organization",repositorySelection:"selected",permissions:{contents:"read"},suspended:true});
    await reconcileGitHubWebhook("installation",{action:"unsuspend",installation:{id}});
    const [updated]=await requireServiceDb().select().from(githubInstallations).where(eq(githubInstallations.id,row.id));
    expect(updated.status).toBe("suspended");
  });
  it("archives removed repositories without deleting their history",async()=>{
    const id=Number(BigInt(`0x${randomUUID().replaceAll("-","").slice(0,10)}`));
    const [row]=await requireServiceDb().insert(githubInstallations).values({workspaceId,installationId:id,accountLogin:"audit",accountType:"Organization",verifiedAt:new Date()}).returning();
    const [repo]=await requireServiceDb().insert(repositories).values({workspaceId,projectId:"00000000-0000-4000-8000-000000000021",githubInstallationId:row.id,source:"github",externalId:id,owner:"audit",name:"removed",fullName:"audit/removed",htmlUrl:"https://github.com/audit/removed",defaultBranch:"main",isPrivate:true,scanEnabled:true}).returning();
    mock.installation.mockResolvedValue({installationId:id,accountLogin:"audit",accountType:"Organization",repositorySelection:"selected",permissions:{contents:"read"},suspended:false});
    mock.repos.mockResolvedValue([]);
    await reconcileGitHubWebhook("installation_repositories",{action:"removed",installation:{id}});
    const [stored]=await requireServiceDb().select().from(repositories).where(eq(repositories.id,repo.id));
    expect(stored.scanEnabled).toBe(false);
    expect(stored.archivedAt).not.toBeNull();
  });
});
