import Image from "next/image";
import { connection } from "next/server";
import { getJokes } from "@/lib/jokes";

export default async function Home() {
  await connection();
  const { data: jokes, error } = await getJokes();

  if (error) {
    console.error("Could not fetch jokes:", error.code, error.message);
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <header className="border-b border-current/15 pb-8">
        <p className="text-sm font-semibold uppercase tracking-widest opacity-60">
          The Humor Project
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Jokes</h1>
        <p className="mt-3 text-lg opacity-70">A photo, a question, a little laugh.</p>
        {!error && (
          <p className="mt-4 text-sm opacity-60">
            {jokes?.length ?? 0} {jokes?.length === 1 ? "joke" : "jokes"} · Newest first
          </p>
        )}
      </header>

      {error ? (
        <p role="alert" className="mt-10">
          We couldn&apos;t load the jokes. Please try again later.
        </p>
      ) : !jokes?.length ? (
        <p className="mt-10">No jokes yet. Check back soon for a laugh!</p>
      ) : (
        <ul aria-label="Jokes" className="mt-10 grid list-none gap-8 sm:grid-cols-2">
          {jokes.map((joke) => (
            <li key={joke.id}>
              <article className="h-full overflow-hidden rounded-2xl border border-current/15">
                <Image
                  src={joke.photo_url}
                  alt={`Photo for: ${joke.funny_question}`}
                  width={800}
                  height={600}
                  unoptimized
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="space-y-3 p-6">
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-60">
                    The question
                  </p>
                  <h2 className="text-xl font-semibold">{joke.funny_question}</h2>
                  <p className="pt-3 text-xs font-semibold uppercase tracking-widest opacity-60">
                    The punchline
                  </p>
                  <p className="opacity-80">{joke.funny_answer}</p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
