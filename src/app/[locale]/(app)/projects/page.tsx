import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { ProjectForm } from "@/components/project-form";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/utils";
import { requireWorkspaceContext } from "@/server/auth/context";
import { getPortfolioData } from "@/server/dashboard/queries";

export default async function ProjectsPage({params}:PageProps<"/[locale]/projects">){const {locale}=await params;const context=await requireWorkspaceContext(locale);const [t,data]=await Promise.all([getTranslations("Projects"),getPortfolioData(context.workspaceId)]);return <><PageHeader title={t("title")} subtitle={t("subtitle")}/><ProjectForm locale={locale} clients={data.clients} labels={{name:t("name"),client:t("client"),submit:t("new")}}/><table className="data-table"><thead><tr><th>{t("name")}</th><th>{t("client")}</th><th>{t("repositories")}</th><th>{t("services")}</th><th>{t("monthlyCost")}</th><th>{t("lastScan")}</th></tr></thead><tbody>{data.projects.map((item)=><tr key={item.id}><td data-label={t("name")}><Link href={`/projects/${item.id}`}><strong>{item.name}</strong></Link></td><td data-label={t("client")}>{item.client}</td><td data-label={t("repositories")}>{item.repositories}</td><td data-label={t("services")}>{item.services}</td><td data-label={t("monthlyCost")}>{formatMoney(item.monthly,"EUR",locale)}</td><td data-label={t("lastScan")}>{item.scan}</td></tr>)}</tbody></table></>}
