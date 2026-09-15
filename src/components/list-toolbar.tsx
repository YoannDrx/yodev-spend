import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function ListToolbar({ query, status, count, path, page, pageCount }: {query: string; status: string; count: number; path: string; page: number; pageCount: number}) {
  const t = await getTranslations("Lists");
  const href = (value: number) => `${path}?${new URLSearchParams({q: query, status, page: String(value)})}`;
  return <div className="list-toolbar">
    <form method="get" className="list-search"><div className="search-field"><Search size={16} aria-hidden="true"/><input type="search" name="q" aria-label={t("search")} placeholder={t("search")} defaultValue={query} maxLength={140}/></div><select name="status" aria-label={t("status")} defaultValue={status}><option value="active">{t("active")}</option><option value="archived">{t("archived")}</option><option value="all">{t("all")}</option></select><button className="button" type="submit">{t("apply")}</button>{query || status !== "active" ? <Link href={path} className="button">{t("reset")}</Link> : null}</form>
    <div className="list-pagination"><span>{t("results", {count})}</span>{pageCount > 1 ? <><span>{t("page", {page, total: pageCount})}</span>{page > 1 ? <Link className="button button-small" href={href(page - 1)}>{t("previous")}</Link> : null}{page < pageCount ? <Link className="button button-small" href={href(page + 1)}>{t("next")}</Link> : null}</> : null}</div>
  </div>;
}
