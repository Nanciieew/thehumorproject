"use client";

import Image from "next/image";
import { useActionState } from "react";
import { saveProfile, type ProfileState } from "./actions";

export function ProfileEditor({ firstName, lastName, photoUrl }: {
  firstName: string; lastName: string; photoUrl: string | null;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});

  return (
    <form action={action} className="mt-8 space-y-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {photoUrl ? <Image src={photoUrl} alt="Your profile photo" width={112} height={112} unoptimized className="h-28 w-28 rounded-full border border-current/10 object-cover" /> : (
          <div aria-label="No profile photo" className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-3xl font-semibold">{firstName.slice(0, 1)}{lastName.slice(0, 1)}</div>
        )}
        <div className="min-w-0 flex-1">
          <label htmlFor="photo" className="block text-sm font-semibold">Profile photo</label>
          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} aria-describedby="photo-help" className="mt-3 block w-full text-sm file:mr-3 file:rounded-full file:border file:border-current/20 file:bg-transparent file:px-4 file:py-2 file:font-medium file:text-foreground disabled:opacity-50" />
          <p id="photo-help" className="mt-2 text-xs leading-relaxed opacity-60">JPG, PNG, or WebP, up to 2 MB and 24 megapixels. Photos are cropped to a square. Leave empty to keep your current photo.</p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="first_name" className="mb-2 block text-sm font-medium">First name</label><input id="first_name" name="first_name" defaultValue={firstName} autoComplete="given-name" required maxLength={100} disabled={pending} className="w-full rounded-xl border border-current/25 bg-transparent px-4 py-3 outline-offset-4 focus:outline-2 disabled:opacity-50" /></div>
        <div><label htmlFor="last_name" className="mb-2 block text-sm font-medium">Last name</label><input id="last_name" name="last_name" defaultValue={lastName} autoComplete="family-name" required maxLength={100} disabled={pending} className="w-full rounded-xl border border-current/25 bg-transparent px-4 py-3 outline-offset-4 focus:outline-2 disabled:opacity-50" /></div>
      </div>
      {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-green-700 dark:text-green-400">Your profile has been saved.</p>}
      <button disabled={pending} className="w-full rounded-full bg-foreground px-6 py-3 font-semibold text-background hover:opacity-85 disabled:opacity-50 sm:w-auto">{pending ? "Saving…" : "Save changes"}</button>
    </form>
  );
}
