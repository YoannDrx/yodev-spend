import { AlertTriangle, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/utils";
import { reviewAlertAction } from "@/server/actions/alerts";
import { requireWorkspaceContext } from "@/server/auth/context";
import { getDashboardData } from "@/server/dashboard/queries";
import { formatScaledDecimal } from "@/server/finops/decimal";

export default async function DashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  const context = await requireWorkspaceContext(locale);
  const [t, data] = await Promise.all([getTranslations("Dashboard"), getDashboardData(context.workspaceId)]);
  const metrics = [[t("monthToDate"), data.metrics.monthToDate, t("accrued")], [t("monthlyCommitment"), data.metrics.monthlyCommitment, t("recurring")], [t("forecast"), data.metrics.forecast, t("conservative")], [t("potentialWaste"), data.metrics.potentialWaste, t("advisory")], [t("annualized"), data.metrics.annualized, t("recurringTimesTwelve")]] as const;
  return <>
    <PageHeader title={t("title")} subtitle={t("subtitle")} />
    <section className="metric-grid">{metrics.map(([label, value, note], index) => <article className={`metric-card ${index === 3 ? "attention" : ""}`} key={label}><span>{label}</span><strong>{formatMoney(value, "EUR", locale)}</strong><small>{note}</small></article>)}</section>
    {data.excludedCurrencies.length > 0 ? <section className="panel" style={{ marginBottom: 16 }}><div className="panel-body"><strong>{t("otherCurrencies")}</strong><p className="hint">{data.excludedCurrencies.map((item) => formatMoney(item.amountMinor, item.currency, locale)).join(" · ")}. {t("excludedCurrency")}</p></div></section> : null}
    <section className="panel" style={{ marginBottom: 16 }}><div className="panel-body"><div className="list-row"><div><strong>{t("financialCoverage")}</strong><small>{t("financialCoverageHelp")}</small></div><div className="row-value">{(data.allocationCoverageBps / 100).toLocaleString(locale,{maximumFractionDigits:2})} %<small>{data.latestSuccessfulSyncAt?t("freshness",{date:new Date(data.latestSuccessfulSyncAt).toLocaleString(locale)}):t("neverSynced")}</small></div></div>{data.unallocated.map((item)=><div className="list-row" key={item.currency}><span>{t("unallocated")}</span><strong>{formatMoney(item.amountMinor,item.currency,locale)}</strong></div>)}{data.fxConversions.map((rate)=><div className="list-row" key={`${rate.from}-${rate.rateAt}`}><div><strong>{rate.from} → {rate.to}</strong><small>{t("fxRate",{date:new Date(rate.rateAt).toLocaleDateString(locale),source:rate.source.toUpperCase()})}</small></div><a href={rate.sourceUrl} target="_blank" rel="noreferrer">{formatScaledDecimal({value:rate.rateScaled,scale:rate.rateScale})}</a></div>)}</div></section>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-head"><h2>{t("byCategory")}</h2></div><div className="panel-body">{data.categories.map((item) => <div className="bar-row" key={item.name}><div className="bar-label"><span>{item.name}</span><strong>{formatMoney(item.amount, "EUR", locale)}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(item.share, 100)}%` }} /></div></div>)}<p className="hint">{t("excludedCurrency")}</p></div></section>
      <section className="panel"><div className="panel-head"><h2>{t("attention")}</h2><Link href="/discoveries">{t("view")} <ArrowRight size={11} /></Link></div><div className="panel-body">
        {data.alerts.map((item) => <div className="list-row" key={item.id}><div className="row-main"><span className="provider-dot"><AlertTriangle size={14} /></span><div><strong>{item.title}</strong><small>{item.detail}</small></div></div><div className="row-value">{item.amount ? formatMoney(item.amount, "EUR", locale) : "—"}{!item.id.startsWith("demo-") ? <div className="topbar-actions"><form action={reviewAlertAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="alertId" value={item.id} /><input type="hidden" name="decision" value="resolve" /><button className="button button-small" type="submit">{t("resolve")}</button></form><form action={reviewAlertAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="alertId" value={item.id} /><input type="hidden" name="decision" value="dismiss" /><button className="button button-small" type="submit">{t("dismiss")}</button></form></div> : null}</div></div>)}
        {!data.alerts.length ? <p className="hint">{t("noAlerts")}</p> : null}
      </div></section>
      <section className="panel"><div className="panel-head"><h2>{t("recentDiscoveries")}</h2><Link href="/discoveries">{t("viewAll")}</Link></div><div className="panel-body">{data.discoveries.map((item) => <div className="list-row" key={`${item.provider}-${item.project}`}><div className="row-main"><span className="provider-dot">{item.provider.slice(0, 2).toUpperCase()}</span><div><strong>{item.provider}</strong><small>{item.project}</small></div></div><div className="row-value">{item.confidence}%<small>{item.age}</small></div></div>)}</div></section>
      <section className="panel"><div className="panel-head"><h2>{t("projects")}</h2><Link href="/projects">{t("viewAll")}</Link></div><div className="panel-body">{data.projects.map((item) => <div className="list-row" key={item.id}><div><strong>{item.name}</strong><small>{t("projectSummary", { client: item.client, repositories: item.repositories, services: item.services })}</small></div><div className="row-value">{formatMoney(item.monthly, "EUR", locale)}<small>{item.scan}</small></div></div>)}</div></section>
    </div>
  </>;
}
