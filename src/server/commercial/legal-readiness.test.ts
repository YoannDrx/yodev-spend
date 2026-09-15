import {describe,expect,it} from "vitest";
import {getLegalReadiness,legalIdentityKeys,legalDocumentVersion} from "./legal-readiness";
describe("commercial legal release gate",()=>{
  const complete={...Object.fromEntries(legalIdentityKeys.map(key=>[key,"Configured"])),SUPPORT_EMAIL:"support@example.com",LEGAL_APPROVED_VERSION:legalDocumentVersion};
  it("requires complete identity, usable support and approval of the current version",()=>{
    expect(getLegalReadiness({}).ready).toBe(false);
    expect(getLegalReadiness(complete).ready).toBe(true);
    expect(getLegalReadiness({...complete,LEGAL_ENTITY_NAME:""}).ready).toBe(false);
    expect(getLegalReadiness({...complete,SUPPORT_EMAIL:"support@example.invalid"}).ready).toBe(false);
    expect(getLegalReadiness({...complete,LEGAL_APPROVED_VERSION:"2026-08-13"}).ready).toBe(false);
  });
});
