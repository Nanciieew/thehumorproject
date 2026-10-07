"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { saveProfile, type ProfileState } from "./actions";
import { StateSelect } from "../state-select";
import { PhotoInput } from "../photo-input";

export function ProfileEditor({ firstName, lastName, photoUrl, stateCode }: {
  firstName: string; lastName: string; photoUrl: string | null; stateCode: string;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});

  const [photoName, setPhotoName] = useState("");

  return (
    <form noValidate onReset={() => setPhotoName("")} action={action} className="mt-8 space-y-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {photoUrl ? <Image src={photoUrl} alt="Your profile photo" width={112} height={112} unoptimized className="profile-avatar h-24 w-24 rounded-full object-cover" /> : (
          <div aria-label="No profile photo" className="profile-avatar flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-3xl font-semibold">{firstName.slice(0, 1)}{lastName.slice(0, 1)}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Profile photo</p>
          <PhotoInput fileName={photoName} onSelect={setPhotoName} disabled={pending} describedBy="photo-help" />
          <p id="photo-help" className="mt-2 text-xs leading-relaxed opacity-60">JPG, PNG, or WebP, up to 2 MB and 24 megapixels. Photos are cropped to a square. Leave empty to keep your current photo.</p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="first_name" className="mb-2 block text-sm font-medium">First name</label><input id="first_name" name="first_name" defaultValue={firstName} autoComplete="given-name" required maxLength={100} disabled={pending} className="w-full rounded-xl border border-current/25 bg-transparent px-4 py-3 outline-offset-4 focus:outline-2 disabled:opacity-50" /></div>
        <div><label htmlFor="last_name" className="mb-2 block text-sm font-medium">Last name</label><input id="last_name" name="last_name" defaultValue={lastName} autoComplete="family-name" required maxLength={100} disabled={pending} className="w-full rounded-xl border border-current/25 bg-transparent px-4 py-3 outline-offset-4 focus:outline-2 disabled:opacity-50" /></div>
      </div>
      <StateSelect value={stateCode} disabled={pending} />
      {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-green-700 dark:text-green-400">Your profile has been saved.</p>}
      <button disabled={pending} className="action-button">{pending ? "Saving…" : "Save changes"}</button>
    </form>
  );
}
