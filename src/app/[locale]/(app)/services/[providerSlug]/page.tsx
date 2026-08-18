import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/utils";
import { requireWorkspaceContext } from "@/server/auth/context";
import { getServiceDetail } from "@/server/dashboard/queries";

export default async function ServiceDetailPage({ params }: PageProps<"/[locale]/services/[providerSlug]">) {
  const { locale, providerSlug } = await params;
  const [context, t] = await Promise.all([
    requireWorkspaceContext(locale),
    getTranslations("ServiceDetail"),
  ]);
  const data = await getServiceDetail(context.workspaceId, providerSlug);
  if (!data) notFound();

  return <>
    <PageHeader
      title={data.service.name}
      subtitle={t("subtitle", { category: data.service.category, count: data.service.projects })}
    />
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-head"><h2>{t("projectsAndEvidence")}</h2></div>
        <div className="panel-body">
          {data.integrations.map((integration) => {
            const evidence = data.evidence.filter((item) => item.projectId === integration.projectId);
            return <div className="list-row" key={integration.id}>
              <div>
                <Link href={`/projects/${integration.projectId}`}><strong>{integration.projectName}</strong></Link>
                <small>{evidence.length ? evidence.slice(0, 3).map((item) => `${item.filePath ?? item.type} → ${item.key}`).join(" · ") : t("noStoredEvidence")}</small>
              </div>
              <StatusBadge status={integration.lifecycleStatus} />
            </div>;
          })}
          {!data.integrations.length ? <div className="empty">{t("noProjects")}</div> : null}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>{t("billing")}</h2></div>
        <div className="panel-body">
          {data.recurring.map((total) => <div className="metric-card" key={total.currency}>
            <span>{t("monthlyRecurring")}</span>
            <strong>{formatMoney(total.amountMinor, total.currency, locale)}</strong>
            <small>{t("activeSubscriptions")}</small>
          </div>)}
          {!data.recurring.length ? <div className="empty">{t("noBilling")}</div> : null}
        </div>
      </section>
    </div>
  </>;
}
