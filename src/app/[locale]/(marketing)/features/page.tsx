import { getTranslations } from "next-intl/server";

export default async function FeaturesPage() {
  const t = await getTranslations("FeaturesPage");
  const keys = ["inventory", "costs", "usage", "invoices", "recommendations", "allocations"] as const;
  return <main className="marketing-page"><header><span className="eyebrow">Spend FinOps</span><h1>{t("title")}</h1><p>{t("subtitle")}</p></header><section className="marketing-grid">{keys.map((key)=><article className="marketing-card" key={key}><h2>{t(`${key}Title`)}</h2><p>{t(`${key}Text`)}</p></article>)}</section><p className="marketing-note">{t("boundary")}</p></main>;
}
