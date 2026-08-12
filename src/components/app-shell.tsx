import { Bell, Boxes, Building2, CircleDollarSign, FolderKanban, LayoutDashboard, Radar, Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Nav");
  const common = await getTranslations("Common");
  const items = [
    ["/dashboard", t("overview"), LayoutDashboard], ["/projects", t("projects"), FolderKanban],
    ["/services", t("services"), Boxes], ["/discoveries", t("discoveries"), Radar],
    ["/spend", t("spend"), CircleDollarSign], ["/clients", t("clients"), Building2],
    ["/settings", t("settings"), Settings],
  ] as const;
  return <div className="app-frame">
    <aside className="sidebar">
      <Link href="/dashboard" className="brand"><span className="brand-mark">S</span><span><strong>Spend</strong><small>by YoDev</small></span></Link>
      <nav>{items.map(([href, label, Icon]) => <Link key={href} href={href} className="nav-item"><Icon size={17} /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-foot"><div className="workspace-chip"><span>Y</span><div><strong>YoDev</strong><small>Owner</small></div></div></div>
    </aside>
    <div className="main-column"><header className="topbar"><div className="topbar-context"><span className="health-dot" />{common("allSystems")}</div><div className="topbar-actions"><button className="icon-button" aria-label="Alerts"><Bell size={16} /></button><LocaleSwitcher /><ThemeToggle /></div></header><main className="content">{children}</main></div>
  </div>;
}
