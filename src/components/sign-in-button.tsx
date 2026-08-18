"use client";

import { GitBranch, Globe2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignInButtons({
  githubLabel,
  googleLabel,
  googleEnabled,
  locale,
  callbackURL,
}: {
  githubLabel: string;
  googleLabel: string;
  googleEnabled: boolean;
  locale: string;
  callbackURL?: string;
}) {
  const signIn = (provider: "github" | "google") => authClient.signIn.social({
    provider,
    callbackURL: callbackURL ?? `/${locale}/dashboard`,
    errorCallbackURL: `/${locale}/sign-in`,
  });
  return <div className="auth-actions">
    <button className="button button-primary" type="button" onClick={() => signIn("github")}><GitBranch size={16}/>{githubLabel}</button>
    {googleEnabled ? <button className="button button-secondary" type="button" onClick={() => signIn("google")}><Globe2 size={16}/>{googleLabel}</button> : null}
  </div>;
}
