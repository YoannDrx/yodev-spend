import { and, eq, isNotNull } from "drizzle-orm";
import { ExternalLink, GitBranch, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { githubInstallations, projects } from "@/db/schema";
import { env } from "@/lib/env";
import { configureGitHubWebhookAction, importGitHubRepository } from "@/server/actions/github";
import { requireWorkspaceContext } from "@/server/auth/context";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";
import { GitHubRepositoryAdapter } from "@/server/github/adapter";

type AvailableRepository = {
  externalId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
  isPrivate: boolean;
  installationRecordId: string;
};

export default async function GitHubSettingsPage({ params }: PageProps<"/[locale]/settings/github">) {
  const { locale } = await params;
  const [context, t] = await Promise.all([requireWorkspaceContext(locale), getTranslations("Settings")]);
  const available: AvailableRepository[] = [];
  const connectionErrors: string[] = [];
  let projectRows: Array<{ id: string; name: string }> = [];
  let installations: Array<typeof githubInstallations.$inferSelect> = [];

  if (process.env.DATABASE_URL) {
    ({ installations, projectRows } = await withAuthorizedWorkspace(context.workspaceId, async (db) => ({
      installations: await db.select().from(githubInstallations).where(and(eq(githubInstallations.workspaceId, context.workspaceId), eq(githubInstallations.status, "active"), isNotNull(githubInstallations.verifiedAt))),
      projectRows: await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.workspaceId, context.workspaceId)),
    })));
  }
  if (env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY) {
    for (const installation of installations) {
      try {
        const repos = await new GitHubRepositoryAdapter(installation.installationId).listRepositories();
        available.push(...repos.map((repo) => ({ ...repo, installationRecordId: installation.id })));
      } catch {
        connectionErrors.push(installation.accountLogin);
      }
    }
  }

  return <>
    <PageHeader title="GitHub App" subtitle={t("githubDescription")} />
    <section className="panel"><div className="panel-body">
      <div className="list-row"><div className="row-main"><span className="provider-dot"><ShieldCheck size={15} /></span><div><strong>{t("leastPrivilege")}</strong><small>{t("permissions")}</small></div></div></div>
      <p className="hint">{t("tokenPolicy")}</p>
      {connectionErrors.length ? <p className="form-error" role="alert">{t("repositoryLoadFailed", { accounts: connectionErrors.join(", ") })}</p> : null}
      <div className="topbar-actions">
        {env.GITHUB_APP_SLUG && env.GITHUB_APP_CLIENT_ID && env.GITHUB_APP_CLIENT_SECRET && env.CONNECTOR_ENCRYPTION_KEY ? <form action="/api/github/install/start" method="post"><input type="hidden" name="locale" value={locale}/><button className="button button-primary" type="submit"><GitBranch size={14} />{t("connect")}<ExternalLink size={12} /></button></form> : <p>{t("notConfigured")}</p>}
        <form action={configureGitHubWebhookAction}><input type="hidden" name="locale" value={locale} /><button className="button" type="submit"><ShieldCheck size={14} />{t("syncWebhook")}</button></form>
      </div>
    </div></section>
    {available.length > 0 ? <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><h2>{t("availableRepos")}</h2></div>
      <div className="panel-body">{available.map((repo) => <form action={importGitHubRepository} className="list-row" key={`${repo.installationRecordId}-${repo.externalId}`}>
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="installationRecordId" value={repo.installationRecordId} /><input type="hidden" name="externalId" value={repo.externalId} /><input type="hidden" name="owner" value={repo.owner} /><input type="hidden" name="name" value={repo.name} /><input type="hidden" name="fullName" value={repo.fullName} /><input type="hidden" name="defaultBranch" value={repo.defaultBranch} /><input type="hidden" name="htmlUrl" value={repo.htmlUrl} /><input type="hidden" name="isPrivate" value={String(repo.isPrivate)} />
        <div className="row-main"><span className="provider-dot"><GitBranch size={14} /></span><div><strong>{repo.fullName}</strong><small>{repo.defaultBranch} · {repo.isPrivate ? t("privateRepository") : t("publicRepository")}</small></div></div>
        <div className="topbar-actions"><select name="projectId" required>{projectRows.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select><button className="button button-primary button-small" type="submit">{t("import")}</button></div>
      </form>)}</div>
    </section> : null}
  </>;
}
