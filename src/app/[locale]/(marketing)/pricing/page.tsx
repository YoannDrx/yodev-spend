import { CircleCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function PricingPage() {
  const t = await getTranslations("PricingPage");
  const plans = [{ key: "solo", monthly: "19 €", annual: "182,40 €", limits: ["oneMember", "tenProjects", "fiveConnections", "twelveMonths"] }, { key: "studio", monthly: "49 €", annual: "470,40 €", limits: ["tenMembers", "fiftyProjects", "twentyConnections", "twentyFourMonths", "reports"] }] as const;
  return <main className="marketing-page"><header><span className="eyebrow">{t("eyebrow")}</span><h1>{t("title")}</h1><p>{t("subtitle")}</p></header><section className="pricing-grid">{plans.map((plan)=><article className="pricing-card" key={plan.key}><h2>{t(plan.key)}</h2><p><strong>{plan.monthly}</strong> {t("perMonth")}</p><small>{plan.annual} {t("perYear")}</small><ul>{plan.limits.map((limit)=><li key={limit}><CircleCheck size={14}/>{t(limit)}</li>)}</ul><Link className="button button-primary" href="/sign-in">{t("startTrial")}</Link></article>)}</section><p className="marketing-note">{t("trial")}</p></main>;
}
