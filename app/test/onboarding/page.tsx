import { Onboarding } from "@/app/onboarding";

export default function TestOnboardingPage() {
  return <main className="mx-auto max-w-3xl px-6 py-12">
    <h1 className="text-3xl font-bold">Try setting up your account</h1>
    <p className="mt-3 opacity-70">Preview the welcome questions without creating or changing an account.</p>
    <Onboarding preview firstName="" lastName="" stateCode="" />
  </main>;
}
