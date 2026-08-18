import { getTranslations } from "next-intl/server";
import { SignInButtons } from "@/components/sign-in-button";
import { env } from "@/lib/env";

export default async function SignInPage({params}:PageProps<"/[locale]/sign-in">){const {locale}=await params;const t=await getTranslations("Auth");return <main className="auth-page"><section className="auth-card"><span className="brand-mark">S</span><h1>{t("title")}</h1><p>{t("subtitle")}</p><SignInButtons githubLabel={t("signInGithub")} googleLabel={t("signInGoogle")} googleEnabled={Boolean(env.GOOGLE_OAUTH_CLIENT_ID&&env.GOOGLE_OAUTH_CLIENT_SECRET)} locale={locale}/><small>{t("beta")}</small></section></main>}
