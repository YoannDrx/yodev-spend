"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const t = useTranslations("Common");
  const { setTheme } = useTheme();
  return <button className="y-theme-toggle" type="button" aria-label={t("theme")} onClick={() => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")}><Sun size={16} className="y-dark-icon" aria-hidden="true"/><Moon size={16} className="y-light-icon" aria-hidden="true"/></button>;
}
