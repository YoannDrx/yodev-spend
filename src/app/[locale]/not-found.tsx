import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("Errors");
  return <section className="empty-state"><span className="eyebrow">404</span><h1>{t("notFound")}</h1><p>{t("notFoundHelp")}</p><Link className="button button-primary" href="/dashboard">{t("back")}</Link></section>;
}
