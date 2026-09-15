import { ListToolbar } from "@/components/list-toolbar";
import { portfolioList } from "@/server/portfolio/list";
import { getTranslations } from "next-intl/server";
import { ClientForm } from "@/components/client-form";
import { PageHeader } from "@/components/page-header";
import { Link } from "@/i18n/navigation";
import { requireWorkspaceContext } from "@/server/auth/context";
import { getPortfolioData } from "@/server/dashboard/queries";

export default async function ClientsPage({params,searchParams}:PageProps<"/[locale]/clients">){const {locale}=await params;const context=await requireWorkspaceContext(locale);const [t,data]=await Promise.all([getTranslations("Clients"),getPortfolioData(context.workspaceId)]);const list=portfolioList(data.clients,await searchParams);return <><PageHeader title={t("title")} subtitle={t("subtitle")}/><ClientForm locale={locale} labels={{name:t("name"),description:t("description"),submit:t("new")}}/><ListToolbar {...list} path="/clients"/><table className="data-table"><thead><tr><th>{t("name")}</th><th>{t("description")}</th><th>{t("projects")}</th></tr></thead><tbody>{list.rows.map((item)=><tr key={item.id}><td data-label={t("name")}><Link href={`/clients/${item.id}`}><strong>{item.name}</strong></Link></td><td data-label={t("description")}>{item.description}</td><td data-label={t("projects")}>{item.projects}</td></tr>)}</tbody></table>{!list.rows.length&&<div className="empty">{t("empty")}</div>}</>}
