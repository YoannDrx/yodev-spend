"use client";

import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return <><button className="nav-item sign-out" disabled={pending} onClick={async () => {
    setPending(true);
    setFailed(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("SIGN_OUT_FAILED");
      router.replace(`/${locale}/sign-in`);
      router.refresh();
    } catch { setFailed(true); setPending(false); }
  }}><LogOut size={17} aria-hidden="true"/><span>{t("signOut")}</span></button>{failed ? <p role="alert">{t("signOutError")}</p> : null}</>;
}
