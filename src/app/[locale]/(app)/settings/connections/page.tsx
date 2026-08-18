import { and, desc, eq, isNull } from "drizzle-orm";
import { Cable, RefreshCw, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { connectorSyncRuns, externalResourceProjects, externalResources, projects, providerConnections, providers } from "@/db/schema";
import { requireWorkspaceContext } from "@/server/auth/context";
import { withAuthorizedWorkspace } from "@/server/auth/workspace-transaction";
import { archiveProviderConnectionAction, assignExternalResourceProjectAction, connectAwsAction, connectGitHubBillingAction, connectOpenAIAction, connectVercelAction, syncProviderConnectionAction } from "@/server/actions/connections";

export default async function ConnectionsPage({ params }: PageProps<"/[locale]/settings/connections">) {
  const { locale } = await params;
  const [context, t] = await Promise.all([requireWorkspaceContext(locale), getTranslations("Connections")]);
  const { connections, latestRuns, resources, projectRows, mappings } = await withAuthorizedWorkspace(context.workspaceId, async (db) => {
  const connections = await db.select({ connection: providerConnections, providerName: providers.name, providerSlug: providers.slug })
    .from(providerConnections)
    .innerJoin(providers, eq(providers.id, providerConnections.providerId))
    .where(and(eq(providerConnections.workspaceId, context.workspaceId), isNull(providerConnections.archivedAt)))
    .orderBy(providerConnections.name);
  const latestRuns = connections.length === 0 ? [] : await db.select().from(connectorSyncRuns)
    .where(eq(connectorSyncRuns.workspaceId, context.workspaceId))
    .orderBy(desc(connectorSyncRuns.createdAt))
    .limit(30);
  const resources = await db.select().from(externalResources).where(and(eq(externalResources.workspaceId, context.workspaceId), isNull(externalResources.archivedAt))).orderBy(externalResources.name);
  const projectRows = await db.select({ id: projects.id, name: projects.name }).from(projects).where(and(eq(projects.workspaceId, context.workspaceId), eq(projects.status, "active"))).orderBy(projects.name);
  const mappings = await db.select().from(externalResourceProjects).where(and(eq(externalResourceProjects.workspaceId, context.workspaceId), isNull(externalResourceProjects.effectiveTo)));
  return { connections, latestRuns, resources, projectRows, mappings };
  });
  const runByConnection = new Map(latestRuns.map((run) => [run.connectionId, run]));
  const mappingByResource = new Map(mappings.map((mapping) => [mapping.externalResourceId, mapping.projectId]));

  return <>
    <PageHeader title={t("title")} subtitle={t("subtitle")} />
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head"><h2><Cable size={14} /> {t("vercelTitle")}</h2></div>
      <form action={connectVercelAction} className="form-card">
        <input type="hidden" name="locale" value={locale} />
        <div className="field"><label htmlFor="connection-name">{t("connectionName")}</label><input id="connection-name" name="name" defaultValue="YoDev Vercel" required /></div>
        <div className="field"><label htmlFor="vercel-team-id">{t("teamId")}</label><input id="vercel-team-id" name="teamId" placeholder="team_…" required autoComplete="off" /></div>
        <div className="field"><label htmlFor="vercel-token">{t("accessToken")}</label><input id="vercel-token" name="token" type="password" required autoComplete="new-password" /></div>
        <button className="button button-primary" type="submit"><ShieldCheck size={14} /> {t("connect")}</button>
      </form>
      <div className="panel-body"><p className="hint">{t("credentialPolicy")}</p></div>
    </section>
    <div className="dashboard-grid" style={{ marginBottom: 16 }}>
      <section className="panel">
        <div className="panel-head"><h2><Cable size={14} /> {t("openaiTitle")}</h2></div>
        <form action={connectOpenAIAction} className="form-card">
          <input type="hidden" name="locale" value={locale} />
          <div className="field"><label htmlFor="openai-name">{t("connectionName")}</label><input id="openai-name" name="name" defaultValue="YoDev OpenAI" required /></div>
          <div className="field"><label htmlFor="openai-org">{t("organizationId")}</label><input id="openai-org" name="organizationId" placeholder="org_…" required autoComplete="off" /></div>
          <div className="field"><label htmlFor="openai-key">{t("adminKey")}</label><input id="openai-key" name="adminKey" type="password" required autoComplete="new-password" /></div>
          <button className="button button-primary" type="submit"><ShieldCheck size={14} /> {t("connect")}</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head"><h2><Cable size={14} /> {t("githubTitle")}</h2></div>
        <form action={connectGitHubBillingAction} className="form-card">
          <input type="hidden" name="locale" value={locale} />
          <div className="field"><label htmlFor="github-name">{t("connectionName")}</label><input id="github-name" name="name" defaultValue="YoDev GitHub" required /></div>
          <div className="field"><label htmlFor="github-org">{t("organization")}</label><input id="github-org" name="organization" required autoComplete="off" /></div>
          <div className="field"><label htmlFor="github-token">{t("githubToken")}</label><input id="github-token" name="token" type="password" required autoComplete="new-password" /></div>
          <button className="button button-primary" type="submit"><ShieldCheck size={14} /> {t("connect")}</button>
          <small>{t("githubPreview")}</small>
        </form>
      </section>
    </div>
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head"><h2><Cable size={14} /> {t("awsTitle")}</h2></div>
      <form action={connectAwsAction} className="form-card">
        <input type="hidden" name="locale" value={locale} />
        <div className="field"><label htmlFor="aws-name">{t("connectionName")}</label><input id="aws-name" name="name" defaultValue="YoDev AWS" required /></div>
        <div className="field"><label htmlFor="aws-account-id">{t("awsAccountId")}</label><input id="aws-account-id" name="accountId" inputMode="numeric" pattern="[0-9]{12}" required autoComplete="off" /></div>
        <div className="field"><label htmlFor="aws-account-name">{t("awsAccountName")}</label><input id="aws-account-name" name="accountName" autoComplete="off" /></div>
        <div className="field"><label htmlFor="aws-role-arn">{t("awsRoleArn")}</label><input id="aws-role-arn" name="roleArn" placeholder="arn:aws:iam::123456789012:role/SpendReadOnly" required autoComplete="off" /></div>
        <div className="field"><label htmlFor="aws-external-id">{t("awsExternalId")}</label><input id="aws-external-id" name="externalId" type="password" autoComplete="new-password" /></div>
        <div className="field"><label htmlFor="aws-tag">{t("awsAllocationTag")}</label><input id="aws-tag" name="allocationTagKey" placeholder="Project" autoComplete="off" /></div>
        <div className="field"><label htmlFor="aws-metric">{t("awsCostMetric")}</label><select id="aws-metric" name="costMetric" defaultValue="NetUnblendedCost"><option value="NetUnblendedCost">NetUnblendedCost</option><option value="AmortizedCost">AmortizedCost</option><option value="NetAmortizedCost">NetAmortizedCost</option></select></div>
        <button className="button button-primary" type="submit"><ShieldCheck size={14} /> {t("connect")}</button>
        <small>{t("awsRoleHelp")}</small>
      </form>
    </section>
    <section className="panel">
      <div className="panel-head"><h2>{t("connectedAccounts")}</h2></div>
      <div className="panel-body">
        {connections.length === 0 ? <p className="hint">{t("empty")}</p> : connections.map(({ connection, providerName }) => {
          const latest = runByConnection.get(connection.id);
          return <div className="list-row" key={connection.id}>
            <div className="row-main"><span className="provider-dot"><Cable size={14} /></span><div><strong>{connection.name}</strong><small>{providerName} · {connection.externalAccountName ?? connection.externalAccountId} · {latest ? `${latest.capability}: ${latest.status}` : t("neverSynced")}</small></div></div>
            <div className="topbar-actions">
              <form action={syncProviderConnectionAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="connectionId" value={connection.id} /><input type="hidden" name="capability" value="all" /><button className="button button-primary button-small" type="submit"><RefreshCw size={13} /> {t("sync")}</button></form>
              <form action={archiveProviderConnectionAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="connectionId" value={connection.id} /><button className="button button-small" type="submit">{t("archive")}</button></form>
            </div>
          </div>;
        })}
      </div>
    </section>
    {resources.length > 0 && <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><h2>{t("resourceMappings")}</h2></div>
      <div className="panel-body">{resources.map((resource) => <form action={assignExternalResourceProjectAction} className="list-row" key={resource.id}>
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="externalResourceId" value={resource.id} />
        <div className="row-main"><span className="provider-dot"><Cable size={14} /></span><div><strong>{resource.name}</strong><small>{resource.resourceType} · {resource.status}</small></div></div>
        <div className="topbar-actions"><select name="projectId" defaultValue={mappingByResource.get(resource.id) ?? ""} required><option value="" disabled>{t("chooseProject")}</option>{projectRows.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select><button className="button button-small" type="submit">{t("assign")}</button></div>
      </form>)}</div>
    </section>}
  </>;
}
