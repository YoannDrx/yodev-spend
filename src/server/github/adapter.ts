import "server-only";

import { App } from "octokit";
import { env } from "@/lib/env";
import { selectCandidatePaths } from "@/server/scanner/candidate-files";
import type { ExternalRepository, RepositoryRef, RepositorySnapshot, RepositorySourceAdapter, ScanMode } from "@/server/scanner";

function app() {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) throw new Error("GitHub App configuration is incomplete.");
  return new App({ appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n") });
}

export async function configureGitHubAppWebhook() {
  if (!env.GITHUB_APP_WEBHOOK_SECRET) throw new Error("GitHub App webhook configuration is incomplete.");
  await app().octokit.rest.apps.updateWebhookConfigForApp({
    url: `${env.NEXT_PUBLIC_APP_URL}/api/github/webhooks`,
    content_type: "json",
    secret: env.GITHUB_APP_WEBHOOK_SECRET,
    insecure_ssl: "0",
  });
}

export class GitHubRepositoryAdapter implements RepositorySourceAdapter {
  constructor(private installationId: number) {}
  private async octokit() { return app().getInstallationOctokit(this.installationId); }
  async listRepositories(): Promise<ExternalRepository[]> {
    const octokit = await this.octokit();
    const response = await octokit.rest.apps.listReposAccessibleToInstallation({ per_page: 100 });
    return response.data.repositories.map((repo) => ({ externalId: repo.id, owner: repo.owner.login, name: repo.name, fullName: repo.full_name, defaultBranch: repo.default_branch, htmlUrl: repo.html_url, isPrivate: repo.private }));
  }
  async getDefaultBranchSha(repository: RepositoryRef) {
    const octokit = await this.octokit();
    const { data } = await octokit.rest.repos.getBranch({ owner: repository.owner, repo: repository.name, branch: repository.defaultBranch });
    return data.commit.sha;
  }
  async loadSnapshot(repository: RepositoryRef, mode: ScanMode): Promise<RepositorySnapshot> {
    const octokit = await this.octokit();
    const commitSha = await this.getDefaultBranchSha(repository);
    const tree = await octokit.rest.git.getTree({ owner: repository.owner, repo: repository.name, tree_sha: commitSha, recursive: "true" });
    const candidates = tree.data.tree.filter((item): item is typeof item & { path:string; size:number } => item.type === "blob" && Boolean(item.path) && typeof item.size === "number").map((item) => ({ path:item.path, size:item.size }));
    const selection = selectCandidatePaths(candidates, mode);
    const files = [];
    for (const candidate of selection.selected) {
      const { data } = await octokit.rest.repos.getContent({ owner: repository.owner, repo: repository.name, path: candidate.path, ref: commitSha });
      if (!Array.isArray(data) && data.type === "file" && "content" in data) files.push({ path:candidate.path, size:candidate.size, content:Buffer.from(data.content, "base64").toString("utf8") });
    }
    return { repository, commitSha, files, partial: selection.partial || Boolean(tree.data.truncated), warnings: tree.data.truncated ? ["github_tree_truncated"] : [] };
  }
}
