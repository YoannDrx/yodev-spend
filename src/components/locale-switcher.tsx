"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const next = locale === "fr" ? "en" : "fr";
  return <button className="locale-button" type="button" onClick={() => router.replace(pathname, { locale: next })}><Languages size={15} /><span>{next.toUpperCase()}</span></button>;
}
