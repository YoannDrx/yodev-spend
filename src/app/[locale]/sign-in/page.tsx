import { YodevBrand } from "@/brand/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getTranslations } from "next-intl/server";
import { SignInButtons } from "@/components/sign-in-button";
import { env } from "@/lib/env";

export default async function SignInPage({params}:PageProps<"/[locale]/sign-in">){const {locale}=await params;const t=await getTranslations("Auth");return <main className="auth-page"><section className="auth-card"><div className="auth-appearance"><LocaleSwitcher/><ThemeToggle/></div><YodevBrand product="spend"/><h1>{t("title")}</h1><p>{t("subtitle")}</p><SignInButtons githubLabel={t("signInGithub")} googleLabel={t("signInGoogle")} googleEnabled={Boolean(env.GOOGLE_OAUTH_CLIENT_ID&&env.GOOGLE_OAUTH_CLIENT_SECRET)} locale={locale}/><small>{t("beta")}</small></section></main>}
