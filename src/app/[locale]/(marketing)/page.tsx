import { ArrowRight, ChartNoAxesCombined, CircleCheck, DatabaseZap, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function LandingPage() {
  const t = await getTranslations("Landing");
  const cards = [["detect", DatabaseZap], ["reconcile", ReceiptText], ["optimize", ChartNoAxesCombined]] as const;
  return <main><section className="marketing-hero"><span className="eyebrow">{t("eyebrow")}</span><h1>{t("title")}</h1><p>{t("subtitle")}</p><div className="hero-actions"><Link href="/pricing" className="button button-primary">{t("seePricing")}<ArrowRight size={15}/></Link><Link href="/features" className="button">{t("seeFeatures")}</Link></div><small><CircleCheck size={14}/>{t("scope")}</small></section><section className="marketing-grid">{cards.map(([key, Icon])=><article className="marketing-card" key={key}><Icon size={20}/><h2>{t(`${key}Title`)}</h2><p>{t(`${key}Text`)}</p></article>)}</section><section className="marketing-callout"><div><span className="eyebrow">{t("betaEyebrow")}</span><h2>{t("betaTitle")}</h2><p>{t("betaText")}</p></div><Link href="/sign-in" className="button button-primary">{t("requestAccess")}</Link></section></main>;
}
