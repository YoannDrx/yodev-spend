"use client";

import { GitBranch, Globe2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function IdentityLinks({ locale, githubLabel, googleLabel, googleEnabled }: { locale: string; githubLabel: string; googleLabel: string; googleEnabled: boolean }) {
  const link = (provider: "github" | "google") => authClient.linkSocial({ provider, callbackURL: `/${locale}/settings`, errorCallbackURL: `/${locale}/settings` });
  return <div className="topbar-actions"><button className="button button-small" type="button" onClick={() => link("github")}><GitBranch size={14}/>{githubLabel}</button>{googleEnabled ? <button className="button button-small" type="button" onClick={() => link("google")}><Globe2 size={14}/>{googleLabel}</button> : null}</div>;
}
