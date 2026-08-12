import { describe, expect, it } from "vitest";
import { extractEnvironmentVariableNames, safeErrorMessage, sanitizeMetadata } from "./sanitizer";

describe("secret sanitization",()=>{
  it("keeps names and discards every env value",()=>{const source=`# comment\nOPENAI_API_KEY=sk-proj-secret\nexport RESEND_API_KEY="re_secret"\nINVALID LINE\nNEXT_PUBLIC_URL=https://example.com`;expect(extractEnvironmentVariableNames(source)).toEqual(["OPENAI_API_KEY","RESEND_API_KEY","NEXT_PUBLIC_URL"]);expect(JSON.stringify(extractEnvironmentVariableNames(source))).not.toContain("secret");});
  it("allowlists harmless scalar metadata",()=>{expect(sanitizeMetadata({scanMode:"quick",value:"secret",token:"secret",count:2,nested:{bad:true}})).toEqual({scanMode:"quick",count:2});});
  it("redacts credentials in errors",()=>{expect(safeErrorMessage(new Error("token=ghs_secret password: hunter2"))).toBe("token=[REDACTED] password=[REDACTED]");});
});
