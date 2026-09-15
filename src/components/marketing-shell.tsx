import { YodevBrand, ProductLinks } from "@/brand/brand";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function MarketingShell({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("Marketing");
  return <div className="marketing-shell"><header className="marketing-nav"><Link href="/" className="brand"><YodevBrand product="spend"/></Link><nav><Link href="/features">{t("features")}</Link><Link href="/pricing">{t("pricing")}</Link><Link href="/security"><ShieldCheck size={14}/>{t("security")}</Link></nav><div className="marketing-controls"><LocaleSwitcher/><ThemeToggle/><Link href="/sign-in" className="button button-primary">{t("signIn")}<ArrowRight size={14}/></Link></div></header>{children}<footer className="marketing-footer"><span>© 2026 Yodev</span><nav><Link href="/legal">{t("legal")}</Link><Link href="/privacy">{t("privacy")}</Link><Link href="/terms">{t("terms")}</Link><Link href="/dpa">DPA</Link><Link href="/subprocessors">{t("subprocessors")}</Link></nav><ProductLinks current="spend" locale={locale}/></footer></div>;
}
