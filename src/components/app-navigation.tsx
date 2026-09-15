"use client";

import { Boxes, Building2, CircleDollarSign, FolderKanban, LayoutDashboard, Radar, Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export function AppNavigation() {
  const locale = useLocale();
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const items = [
    ["/dashboard", "overview", LayoutDashboard], ["/projects", "projects", FolderKanban],
    ["/services", "services", Boxes], ["/discoveries", "discoveries", Radar],
    ["/spend", "spend", CircleDollarSign], ["/clients", "clients", Building2],
    ["/settings", "settings", Settings],
  ] as const;
  const groups = [
    { label: locale === "fr" ? "Vue d’ensemble" : "Overview", keys: ["overview"] },
    { label: locale === "fr" ? "Votre stack" : "Your stack", keys: ["projects", "services", "discoveries"] },
    { label: locale === "fr" ? "Dépenses & clients" : "Expenses & clients", keys: ["spend", "clients"] },
    { label: locale === "fr" ? "Espace de travail" : "Workspace", keys: ["settings"] },
  ];
  return <nav aria-label={t("mainNavigation")}>{groups.map(group => <div className="nav-group" key={group.label}><p className="nav-group-label">{group.label}</p>{items.filter(([,key]) => group.keys.includes(key)).map(([href,key,Icon]) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return <Link href={href} key={href} className="nav-item" aria-current={active ? "page" : undefined}><Icon size={18} aria-hidden="true"/><span>{t(key)}</span></Link>;
  })}</div>)}</nav>;
}
