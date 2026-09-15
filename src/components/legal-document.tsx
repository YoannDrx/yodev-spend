import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { getLegalReadiness, legalDocumentVersion } from "@/server/commercial/legal-readiness";
import { legalCopy, type LegalDocumentKey } from "@/server/commercial/legal-copy";

export async function LegalDocument({documentKey}:{documentKey:LegalDocumentKey}) {
  const [t,locale]=await Promise.all([getTranslations("LegalDocuments"),getLocale()]);
  const language=locale==="en"?"en":"fr";
  const readiness=getLegalReadiness(env);
  return <main className="marketing-page legal-copy">
    <header><span className="eyebrow">{legalDocumentVersion}</span><h1>{t(`${documentKey}Title`)}</h1><p>{t(`${documentKey}Intro`)}</p></header>
    <nav className="legal-navigation" aria-label={t("navigation")}>
      {(["legal","privacy","terms","dpa","subprocessors"] as const).map(key=><Link key={key} href={`/${key}`} aria-current={key===documentKey?"page":undefined}>{t(`${key}Title`)}</Link>)}
    </nav>
    {!readiness.ready?<section className="legal-draft" role="status"><h2>{t("statusTitle")}</h2><p>{t("statusText")}</p></section>:null}
    {legalCopy[language][documentKey].map(section=><section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}
    <section><h2>{t("publisher")}</h2>{env.LEGAL_ENTITY_NAME?<address className="legal-identity">{[env.LEGAL_ENTITY_NAME,env.LEGAL_ENTITY_FORM,env.LEGAL_REGISTRATION,env.LEGAL_ADDRESS,env.LEGAL_VAT_NUMBER].filter(Boolean).map((line,index)=><p key={index}>{line}</p>)}{env.LEGAL_PUBLICATION_DIRECTOR?<p>{t("director")}: {env.LEGAL_PUBLICATION_DIRECTOR}</p>:null}{env.LEGAL_CONTACT_PHONE?<p>{env.LEGAL_CONTACT_PHONE}</p>:null}</address>:<p>{t("identityPending")}</p>}</section>
    <section><h2>{t("contactTitle")}</h2>{readiness.validEmail?<p><a href={`mailto:${env.SUPPORT_EMAIL}`}>{env.SUPPORT_EMAIL}</a></p>:<p>{t("contactPending")}</p>}</section>
  </main>;
}
