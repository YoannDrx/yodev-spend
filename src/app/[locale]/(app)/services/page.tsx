import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/utils";
import { requireWorkspaceContext } from "@/server/auth/context";
import { getPortfolioData } from "@/server/dashboard/queries";

export default async function ServicesPage({params}:PageProps<"/[locale]/services">){const {locale}=await params;const context=await requireWorkspaceContext(locale);const [t,data]=await Promise.all([getTranslations("Services"),getPortfolioData(context.workspaceId)]);return <><PageHeader title={t("title")} subtitle={t("subtitle")}/><table className="data-table"><thead><tr><th>{t("provider")}</th><th>{t("category")}</th><th>{t("projects")}</th><th>Status</th><th>{t("monthlyCost")}</th><th>{t("lastDetected")}</th></tr></thead><tbody>{data.services.map((item)=><tr key={item.slug}><td data-label={t("provider")}><Link href={`/services/${item.slug}`}><strong>{item.name}</strong></Link></td><td data-label={t("category")}>{item.category}</td><td data-label={t("projects")}>{item.projects}</td><td data-label="Status"><StatusBadge status={item.status as "active"|"confirmed"|"candidate"|"stale"}/></td><td data-label={t("monthlyCost")}>{formatMoney(item.monthly,"EUR",locale)}</td><td data-label={t("lastDetected")}>{item.last}</td></tr>)}</tbody></table></>}
