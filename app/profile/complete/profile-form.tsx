"use client";

import { useActionState } from "react";
import { completeProfile, type FormState } from "@/app/auth/actions";

export function ProfileForm({ firstName, lastName }: { firstName: string | null; lastName: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(completeProfile, {});
  return (
    <form action={action} className="mt-8 space-y-5">
      {([{ name: "first_name", label: "First name", value: firstName, autoComplete: "given-name" }, { name: "last_name", label: "Last name", value: lastName, autoComplete: "family-name" }]).map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="mb-2 block text-sm font-medium">{field.label}</label>
          {field.value?.trim() ? <p className="rounded-lg bg-foreground/5 px-3 py-3">{field.value}</p> : (
            <input id={field.name} name={field.name} autoComplete={field.autoComplete} required maxLength={100} disabled={pending} className="w-full rounded-lg border border-current/25 bg-transparent px-3 py-3 outline-offset-4 focus:outline-2 disabled:opacity-50" />
          )}
        </div>
      ))}
      {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-foreground px-5 py-3 font-semibold text-background transition hover:opacity-85 disabled:opacity-50">{pending ? "Saving…" : "Save and continue"}</button>
    </form>
  );
}
