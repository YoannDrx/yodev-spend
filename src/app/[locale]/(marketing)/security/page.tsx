import { getTranslations } from "next-intl/server";

export default async function SecurityPage() {
  const t = await getTranslations("SecurityPage");
  const keys = ["leastPrivilege", "credentials", "content", "tenancy", "recovery", "control"] as const;
  return <main className="marketing-page legal-copy"><header><span className="eyebrow">Security</span><h1>{t("title")}</h1><p>{t("subtitle")}</p></header>{keys.map((key)=><section key={key}><h2>{t(`${key}Title`)}</h2><p>{t(`${key}Text`)}</p></section>)}</main>;
}
