import { NavigationDisclosure } from "@/brand/navigation-disclosure";
import { YodevBrand, ProductLinks } from "@/brand/brand";
import { Bell, ShieldCheck, Menu } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import { AppNavigation } from "./app-navigation";
import { SignOutButton } from "./sign-out-button";

export async function AppShell({ children, workspaceName, role, demo = false }: { children: React.ReactNode; workspaceName: string; role: string; demo?: boolean }) {
  const locale = await getLocale();
  const t = await getTranslations("Nav");
  return <div className="app-frame">
    <a className="skip-link" href="#main-content">{t("skipToContent")}</a>
    <aside className="sidebar">
      <Link href="/dashboard" className="brand"><YodevBrand product="spend"/></Link>
      <AppNavigation/>
      <div className="sidebar-foot"><ProductLinks current="spend" locale={locale}/><div className="workspace-chip"><span>{workspaceName.slice(0,1).toUpperCase()}</span><div><strong>{workspaceName}</strong><small>{["owner", "admin", "member"].includes(role) ? t(role) : role}</small></div></div>{!demo ? <SignOutButton/> : null}</div>
    </aside>
    <div className="main-column"><header className="topbar"><Link href="/dashboard" className="mobile-brand"><YodevBrand product="spend"/></Link><div className="topbar-context"><ShieldCheck size={14} aria-hidden="true"/>{t("workspaceContext", {name: workspaceName})}</div><div className="topbar-actions"><Link href="/dashboard#alerts" className="icon-button" aria-label={t("alerts")}><Bell size={16} /></Link><LocaleSwitcher/><ThemeToggle/><NavigationDisclosure className="spend-mobile-menu" label={locale === "fr" ? "Navigation complète" : "Full navigation"} icon={<Menu size={20}/>}><div className="spend-menu-panel"><AppNavigation/><ProductLinks current="spend" locale={locale}/>{!demo ? <SignOutButton/> : null}</div></NavigationDisclosure></div></header>
      <main id="main-content" className="content" tabIndex={-1}>{demo ? <p className="demo-banner">{t("demo")}</p> : null}{children}</main>
    </div>
  </div>;
}
