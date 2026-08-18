import { getTranslations } from "next-intl/server";
import { AcceptInvitation } from "@/components/accept-invitation";
import { SignInButtons } from "@/components/sign-in-button";
import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { headers } from "next/headers";

export default async function InvitationPage({ params }: PageProps<"/[locale]/invite/[token]">) {
  const { locale, token } = await params;
  const [t, session] = await Promise.all([getTranslations("Invite"), getAuth().api.getSession({ headers: await headers() })]);
  const callbackURL = `/${locale}/invite/${encodeURIComponent(token)}`;
  return <main className="auth-page"><section className="auth-card"><span className="brand-mark">S</span><h1>{t("title")}</h1><p>{t("subtitle")}</p>{session?.user ? <AcceptInvitation invitationId={token} label={t("accept")} failureLabel={t("failure")}/> : <SignInButtons githubLabel={t("github")} googleLabel={t("google")} googleEnabled={Boolean(env.GOOGLE_OAUTH_CLIENT_ID&&env.GOOGLE_OAUTH_CLIENT_SECRET)} locale={locale} callbackURL={callbackURL}/>}<small>{t("verifiedEmail")}</small></section></main>;
}
