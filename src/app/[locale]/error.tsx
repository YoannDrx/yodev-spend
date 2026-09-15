"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("Errors");
  return <section className="empty-state" role="alert"><span className="eyebrow">Spend</span><h1>{t("title")}</h1><p>{t("generic")}</p><div className="hero-actions"><button type="button" className="button button-primary" onClick={() => retry()}>{t("retry")}</button><Link href="/dashboard" className="button">{t("back")}</Link></div></section>;
}
