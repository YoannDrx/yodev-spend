import { getTranslations } from "next-intl/server";

export async function LegalDocument({ documentKey }: { documentKey: "legal" | "privacy" | "terms" | "dpa" | "subprocessors" }) {
  const t = await getTranslations("LegalDocuments");
  return <main className="marketing-page legal-copy"><header><span className="eyebrow">{t("version")}</span><h1>{t(`${documentKey}Title`)}</h1><p>{t(`${documentKey}Intro`)}</p></header><section><h2>{t("statusTitle")}</h2><p>{t("statusText")}</p></section><section><h2>{t("contactTitle")}</h2><p>{t("contactText")}</p></section></main>;
}
