"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function AcceptInvitation({ invitationId, label, failureLabel }: { invitationId: string; label: string; failureLabel: string }) {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  async function accept() {
    setPending(true);
    setError(false);
    const result = await authClient.organization.acceptInvitation({ invitationId });
    if (result.error) { setError(true); setPending(false); return; }
    router.push("/dashboard");
  }
  return <div className="auth-actions"><button className="button button-primary" type="button" disabled={pending} onClick={accept}>{label}</button>{error ? <p className="hint" role="alert">{failureLabel}</p> : null}</div>;
}
