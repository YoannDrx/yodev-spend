"use client";

import { useId, useState, useTransition, type ComponentProps } from "react";
import { useTranslations } from "next-intl";

type Props = Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (data: FormData) => Promise<void | {error: string}>;
  resetOnSuccess?: boolean;
};

/** Keeps entered values on failure and prevents repeated submissions. */
export function ActionForm({ action, children, resetOnSuccess = false, ...props }: Props) {
  const t = useTranslations("Forms");
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [errorKey, setErrorKey] = useState("error");
  return <form {...props} action={async (data) => { await action(data); }} aria-busy={pending} aria-describedby={status ? id : undefined} onSubmit={(event) => {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form, (event.nativeEvent as SubmitEvent).submitter);
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await action(data);
        if (result?.error) { setErrorKey(result.error); setStatus("error"); return; }
        if (resetOnSuccess) form.reset();
        setStatus("success");
      } catch {
        // Server error messages can contain provider or database details.
        setErrorKey("error"); setStatus("error");
      }
    });
  }}>
    <fieldset className="form-fields" disabled={pending}>{children}</fieldset>
    {pending ? <p className="form-feedback" role="status">{t("pending")}</p> : null}
    {status && !pending ? <p id={id} className={`form-feedback form-feedback-${status}`} role={status === "error" ? "alert" : "status"}>{t(status === "error" ? errorKey : "success")}</p> : null}
  </form>;
}
