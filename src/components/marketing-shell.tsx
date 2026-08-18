import { ArrowRight, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function MarketingShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Marketing");
  return <div className="marketing-shell"><header className="marketing-nav"><Link href="/" className="brand"><span className="brand-mark">S</span><span><strong>Spend</strong><small>by YoDev</small></span></Link><nav><Link href="/features">{t("features")}</Link><Link href="/pricing">{t("pricing")}</Link><Link href="/security"><ShieldCheck size={14}/>{t("security")}</Link></nav><Link href="/sign-in" className="button button-primary">{t("signIn")}<ArrowRight size={14}/></Link></header>{children}<footer className="marketing-footer"><span>© 2026 YoDev</span><nav><Link href="/legal">{t("legal")}</Link><Link href="/privacy">{t("privacy")}</Link><Link href="/terms">{t("terms")}</Link><Link href="/dpa">DPA</Link><Link href="/subprocessors">{t("subprocessors")}</Link></nav></footer></div>;
}
