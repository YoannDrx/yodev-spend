import { GitBranch, Languages, ScanLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Link } from "@/i18n/navigation";

export default async function SettingsPage(){const t=await getTranslations("Settings");return <><PageHeader title={t("title")} subtitle={t("subtitle")}/><div className="dashboard-grid"><section className="panel"><div className="panel-head"><h2><GitBranch size={14}/> {t("github")}</h2></div><div className="panel-body"><p>{t("githubDescription")}</p><p className="hint">{t("permissions")}</p><Link className="button button-primary" href="/settings/github">{t("connect")}</Link></div></section><section className="panel"><div className="panel-head"><h2><ScanLine size={14}/> Automation</h2></div><div className="panel-body"><p>{t("dailyScan")}</p><p className="hint">SHA-aware · bounded batches · idempotent</p></div></section><section className="panel"><div className="panel-head"><h2><Languages size={14}/> Languages</h2></div><div className="panel-body"><p>Français / English</p></div></section></div></>}
