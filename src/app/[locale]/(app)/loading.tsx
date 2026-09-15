import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("Common");
  return <div role="status" aria-live="polite"><p className="muted">{t("loading")}</p><div className="loading-heading skeleton"/><div className="metric-grid" aria-hidden="true">{Array.from({length: 5}, (_, i) => <div key={i} className="metric-card skeleton" style={{height: 120}}/>)}</div><div className="panel skeleton" style={{height: 260}} aria-hidden="true"/></div>;
}
