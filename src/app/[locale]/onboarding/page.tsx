import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { requireSession } from "@/server/auth/context";
import { startCommercialCheckoutAction } from "@/server/actions/commercial";
import { getCommercialWorkspaceForUser, getReservedBetaInvitationForUser } from "@/server/commercial/onboarding";

export default async function OnboardingPage({ params, searchParams }: PageProps<"/[locale]/onboarding">) {
  const { locale } = await params;
  const query = await searchParams;
  const [session, t] = await Promise.all([requireSession(locale), getTranslations("Onboarding")]);
  const [membership, invitation] = await Promise.all([
    getCommercialWorkspaceForUser(session.user.id),
    getReservedBetaInvitationForUser(session.user.id),
  ]);
  if (membership?.workspace.commercialStatus === "private" || membership?.workspace.commercialStatus === "active" || membership?.workspace.commercialStatus === "trialing") {
    redirect(`/${locale}/dashboard`);
  }
  const stripeReady = env.STRIPE_BILLING_ENABLED === "true";
  const invitationReady = env.COMMERCIAL_SIGNUP_ENABLED === "true" || Boolean(invitation);
  return <main className="auth-page onboarding-page"><section className="auth-card onboarding-card">
    <span className="brand-mark">S</span>
    <h1>{t("title")}</h1>
    <p>{query.checkout === "success" ? t("checkoutPending") : query.checkout === "cancelled" ? t("checkoutCancelled") : t("subtitle")}</p>
    {!stripeReady ? <p className="hint">{t("stripeDisabled")}</p> : null}
    {!invitationReady ? <p className="hint" role="alert">{t("invitationRequired")}</p> : null}
    <form action={startCommercialCheckoutAction} className="onboarding-form">
      <input type="hidden" name="locale" value={locale}/>
      <input type="hidden" name="betaInvitationId" value={invitation?.id ?? ""}/>
      <label className="field"><span>{t("workspaceName")}</span><input name="workspaceName" defaultValue={membership?.workspace.name ?? ""} required minLength={2}/></label>
      <label className="field"><span>{t("legalName")}</span><input name="legalName" required minLength={2}/></label>
      <label className="field"><span>{t("billingEmail")}</span><input name="billingEmail" type="email" defaultValue={session.user.email} required/></label>
      <label className="field"><span>{t("country")}</span><input name="countryCode" defaultValue="FR" required maxLength={2}/></label>
      <label className="field field-wide"><span>{t("address")}</span><input name="addressLine1" required/></label>
      <label className="field field-wide"><span>{t("addressExtra")}</span><input name="addressLine2"/></label>
      <label className="field"><span>{t("postalCode")}</span><input name="postalCode" required/></label>
      <label className="field"><span>{t("city")}</span><input name="city" required/></label>
      <label className="field"><span>{t("vatId")}</span><input name="vatId"/></label>
      <label className="field"><span>{t("currency")}</span><select name="baseCurrency" defaultValue="EUR"><option value="EUR">EUR</option></select></label>
      <label className="field"><span>{t("plan")}</span><select name="planCode" defaultValue={invitation?.planCode ?? "solo"} disabled={Boolean(invitation)}><option value="solo">{t("solo")}</option><option value="studio">{t("studio")}</option></select>{invitation ? <input type="hidden" name="planCode" value={invitation.planCode}/> : null}</label>
      <label className="field"><span>{t("interval")}</span><select name="billingInterval" defaultValue="month"><option value="month">{t("monthly")}</option><option value="year">{t("annual")}</option></select></label>
      <label className="check-field field-wide"><input type="checkbox" name="businessConfirmed" required/><span>{t("businessConfirmation")}</span></label>
      <label className="check-field field-wide"><input type="checkbox" name="termsAccepted" required/><span>{t("termsConfirmation")}</span></label>
      <label className="check-field field-wide"><input type="checkbox" name="privacyAccepted" required/><span>{t("privacyConfirmation")}</span></label>
      <label className="check-field field-wide"><input type="checkbox" name="dpaAccepted" required/><span>{t("dpaConfirmation")}</span></label>
      <button className="button button-primary field-wide" type="submit" disabled={!stripeReady || !invitationReady}>{t("checkout")}</button>
    </form>
    <small>{t("activationNotice")}</small>
  </section></main>;
}
