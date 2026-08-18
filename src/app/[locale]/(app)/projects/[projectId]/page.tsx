import { Archive, GitBranch } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { archiveProject, updateProject } from "@/server/actions/portfolio";
import { scanRepositoryAction } from "@/server/actions/scans";
import { requireWorkspaceContext } from "@/server/auth/context";
import { getProjectDetail } from "@/server/dashboard/queries";
import { formatMoney } from "@/lib/utils";

export default async function ProjectDetailPage({ params }: PageProps<"/[locale]/projects/[projectId]">) {
  const { locale, projectId } = await params;
  const context = await requireWorkspaceContext(locale);
  const [data, t] = await Promise.all([getProjectDetail(context.workspaceId, projectId), getTranslations("Projects")]);
  if (!data) notFound();
  const { project } = data;
  const action = project.status !== "archived" && !project.id.startsWith("demo-") ? <form action={archiveProject}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="projectId" value={projectId}/><button className="button" type="submit"><Archive size={13}/>{t("archive")}</button></form> : <StatusBadge status="archived"/>;
  return <>
    <PageHeader title={project.name} subtitle={`${project.client} · ${project.repositories} ${t("repositories").toLowerCase()}`} action={action}/>
    {!project.id.startsWith("demo-") ? <details className="panel" style={{marginBottom:16}}><summary className="panel-head"><h2>{t("edit")}</h2></summary><form action={updateProject} className="form-card"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="projectId" value={projectId}/><label className="field"><span>{t("name")}</span><input name="name" defaultValue={project.name} required/></label><label className="field"><span>{t("description")}</span><textarea name="description" defaultValue={project.description??""}/></label><label className="field"><span>{t("status")}</span><select name="status" defaultValue={project.status}><option value="active">{t("active")}</option><option value="maintenance">{t("maintenance")}</option><option value="archived">{t("archived")}</option></select></label><button className="button button-primary" type="submit">{t("save")}</button></form></details> : null}
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-head"><h2>{t("repositories")}</h2></div><div className="panel-body">{data.repositories.map((repository)=><div className="list-row" key={repository.id}><div className="row-main"><span className="provider-dot"><GitBranch size={15}/></span><div><strong>{repository.fullName}</strong><small>{repository.defaultBranch} · {repository.lastScan ? t("lastScanValue",{date:repository.lastScan}) : t("neverScanned")}</small></div></div><div className="topbar-actions"><StatusBadge status="active" label={repository.scanEnabled?t("enabled"):t("disabled")}/>{repository.id==="demo-repository"?<span className="status-badge">Demo</span>:<form action={scanRepositoryAction}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="repositoryId" value={repository.id}/><input type="hidden" name="mode" value="quick"/><input type="hidden" name="force" value="true"/><button className="button button-small" type="submit">{t("scanNow")}</button></form>}</div></div>)}</div></section>
      <section className="panel"><div className="panel-head"><h2>{t("integrations")}</h2></div><div className="panel-body">{data.services.map((service)=><div className="list-row" key={service.slug}><strong>{service.name}</strong><StatusBadge status={service.status as "active"|"candidate"|"stale"|"removed"}/></div>)}</div></section>
    </div>
    <section className="panel" style={{marginTop:16}}><div className="panel-head"><h2>{t("costBreakdown")}</h2></div><div className="panel-body">{data.costBreakdown.length?data.costBreakdown.map((cost)=><div className="list-row" key={`${cost.provider}-${cost.allocationMethod}-${cost.amountBasis}-${cost.source}`}><div><strong>{cost.provider}</strong><small>{t("costEvidence",{method:cost.allocationMethod,basis:cost.amountBasis,status:cost.amountStatus,source:cost.source})}</small></div><div className="row-value">{formatMoney(cost.amountMinor,cost.currency,locale)}<small>{t("costFreshness",{date:new Date(cost.freshness).toLocaleString(locale)})}</small></div></div>):<p className="hint">{t("noAttributedCosts")}</p>}</div></section>
  </>;
}
