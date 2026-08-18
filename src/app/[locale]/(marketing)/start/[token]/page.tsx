import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { SignInButtons } from "@/components/sign-in-button";
import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { reserveBetaInvitation } from "@/server/commercial/onboarding";

export default async function BetaStartPage({ params }: PageProps<"/[locale]/start/[token]">) {
  const { locale, token } = await params;
  const [t, session] = await Promise.all([
    getTranslations("BetaStart"),
    getAuth().api.getSession({ headers: await headers() }),
  ]);
  const callbackURL = `/${locale}/start/${encodeURIComponent(token)}`;
  if (!session?.user) {
    return <main className="auth-page"><section className="auth-card"><span className="brand-mark">S</span><h1>{t("title")}</h1><p>{t("signIn")}</p><SignInButtons githubLabel={t("github")} googleLabel={t("google")} googleEnabled={Boolean(env.GOOGLE_OAUTH_CLIENT_ID&&env.GOOGLE_OAUTH_CLIENT_SECRET)} locale={locale} callbackURL={callbackURL}/><small>{t("verifiedEmail")}</small></section></main>;
  }
  if (!session.user.emailVerified) {
    return <main className="auth-page"><section className="auth-card"><span className="brand-mark">S</span><h1>{t("title")}</h1><p role="alert">{t("emailNotVerified")}</p></section></main>;
  }
  try {
    const invitation = await reserveBetaInvitation({ token, userId: session.user.id });
    redirect(`/${locale}/onboarding?invitation=${encodeURIComponent(invitation.id)}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return <main className="auth-page"><section className="auth-card"><span className="brand-mark">S</span><h1>{t("title")}</h1><p role="alert">{t("invalid")}</p></section></main>;
  }
}
