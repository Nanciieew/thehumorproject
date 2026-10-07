"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { finishOnboarding } from "./profile/actions";
import { logout } from "./auth/actions";
import { StateSelect } from "./state-select";

const inputClass = "mt-2 w-full rounded-xl border border-current/25 bg-transparent px-4 py-3";

export function Onboarding({ firstName, lastName, stateCode }: { firstName: string; lastName: string; stateCode: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [error, setError] = useState("");
  const [state, action, pending] = useActionState(finishOnboarding, {});
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);

  function next(skipPhoto = false) {
    const element = form.current!;
    if (step === 0) {
      for (const name of ["first_name", "last_name"]) {
        const input = element.elements.namedItem(name) as HTMLInputElement;
        if (!input.value.trim() || !input.checkValidity()) {
          setError("Please enter both your first and last name."); input.focus(); return;
        }
      }
    }
    if (step === 1) {
      const photo = element.elements.namedItem("photo") as HTMLInputElement;
      if (skipPhoto) photo.value = "";
      const file = photo.files?.[0];
      if (file && (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
        setError("Choose a JPG, PNG, or WebP photo up to 2 MB, or skip for now."); return;
      }
    }
    setError(""); setStep(step + 1);
  }
  return <dialog ref={dialog} onCancel={(event) => event.preventDefault()} aria-labelledby="welcome-title" className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border border-current/10 bg-background p-7 text-foreground shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-sm sm:p-10">
    <p className="text-xs font-semibold uppercase tracking-widest opacity-60">Welcome to the Humor Project · {step + 1} / 3</p>
    <div className="my-5 flex gap-2" aria-hidden="true">{[0, 1, 2].map((index) => <span key={index} className={`h-1 flex-1 rounded-full ${index <= step ? "bg-foreground" : "bg-foreground/15"}`} />)}</div>
    <h2 ref={heading} tabIndex={-1} id="welcome-title" className="text-3xl font-bold outline-none">{["What should we call you?", "Put a face to the funny.", "Which state gets your bragging rights?"][step]}</h2>
    <p className="mt-3 text-sm leading-relaxed opacity-65">{["Every great joke starts with an introduction.", "Add your photo, or save your grand reveal for later.", "Plant your flag. Pick the state you’re repping in our corner of the internet."][step]}</p>
    <form ref={form} action={action} onKeyDown={(event) => { if (event.key === "Enter" && step < 2 && event.target instanceof HTMLInputElement && event.target.type !== "file") { event.preventDefault(); next(); } }} onSubmit={(event) => { if (step !== 2) { event.preventDefault(); next(); } }} className="mt-7 space-y-6">
      <fieldset hidden={step !== 0} disabled={pending} className={step === 0 ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
        <label className="text-sm font-medium">First name<input name="first_name" autoComplete="given-name" value={first} onChange={(event) => setFirst(event.target.value)} required maxLength={100} className={inputClass} /></label>
        <label className="text-sm font-medium">Last name<input name="last_name" autoComplete="family-name" value={last} onChange={(event) => setLast(event.target.value)} required maxLength={100} className={inputClass} /></label>
      </fieldset>
      <fieldset hidden={step !== 1} disabled={pending}>
        <label className="block text-sm font-medium">Profile photo <span className="opacity-60">(optional)</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-4 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:px-4 file:py-2" /></label>
        <p className="mt-3 text-xs opacity-60">JPG, PNG, or WebP · Up to 2 MB · Cropped to a square</p>
      </fieldset>
      <fieldset hidden={step !== 2} disabled={pending}><StateSelect id="welcome-state" value={stateCode} /></fieldset>
      {(error || state.error) && <p role="alert" className="text-sm text-red-600">{error || state.error} You can go back to revise your answers.</p>}
      <div className="flex flex-wrap items-center gap-3">
        {step > 0 && <button type="button" disabled={pending} onClick={() => { setError(""); setStep(step - 1); }} className="rounded-full border border-current/20 px-4 py-3 text-sm">Back</button>}
        {step < 2 ? <button type="button" onClick={() => next()} className="flex-1 rounded-full bg-foreground px-6 py-3 font-semibold text-background">Next</button> : <button disabled={pending} className="flex-1 rounded-full bg-foreground px-6 py-3 font-semibold text-background disabled:opacity-50">{pending ? "Saving…" : "start my journey!"}</button>}
      </div>
      {step === 1 && <button type="button" onClick={() => next(true)} className="block w-full text-sm underline underline-offset-4">Skip for now</button>}
    </form>
    <form action={logout} className="mt-6 text-center"><button className="text-xs opacity-60 hover:underline">Log out</button></form>
  </dialog>;
}
