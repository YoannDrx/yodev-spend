"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const next = locale === "fr" ? "en" : "fr";
  return <button className="locale-button" aria-label={t("switchLocale")} type="button" onClick={() => router.replace(pathname, { locale: next })}><Languages size={15} /><span>{next.toUpperCase()}</span></button>;
}
