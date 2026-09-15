export const legalDocumentVersion = "2026-09-06";
export const legalIdentityKeys = ["LEGAL_ENTITY_NAME","LEGAL_ENTITY_FORM","LEGAL_REGISTRATION","LEGAL_ADDRESS","LEGAL_PUBLICATION_DIRECTOR","LEGAL_CONTACT_PHONE","SUPPORT_EMAIL"] as const;
export function getLegalReadiness(configuration: Record<string,string|undefined>) {
  const missing=legalIdentityKeys.filter(key=>!configuration[key]?.trim());
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuration.SUPPORT_EMAIL??"")&&!configuration.SUPPORT_EMAIL?.endsWith(".invalid");
  const approved=configuration.LEGAL_APPROVED_VERSION===legalDocumentVersion;
  return {ready:missing.length===0&&validEmail&&approved,missing,approved,validEmail,version:legalDocumentVersion};
}
