import { getTranslations } from "next-intl/server";
import { SignInButton } from "@/components/sign-in-button";

export default async function SignInPage({params}:PageProps<"/[locale]/sign-in">){const {locale}=await params;const t=await getTranslations("Auth");return <main className="auth-page"><section className="auth-card"><span className="brand-mark">S</span><h1>{t("title")}</h1><p>{t("subtitle")}</p><SignInButton label={t("signIn")} locale={locale}/><small>{t("private")}</small></section></main>}
