import "server-only";

// Durations only: never log snapshots, captions, credentials, or account IDs.
export function createRoastTiming(flow: "roast" | "meme") {
  const started = performance.now();
  const stages: Record<string, number> = {};
  return {
    async measure<T>(stage: string, run: () => Promise<T>): Promise<T> {
      const start = performance.now();
      try { return await run(); }
      finally { stages[stage] = Math.round((performance.now() - start) * 10) / 10; }
    },
    headers(status: number) {
      const total = Math.round((performance.now() - started) * 10) / 10;
      console.info("[get-checked]", { flow, status, ...stages, total });
      return {
        "Cache-Control": "private, no-store",
        "Server-Timing": Object.entries({ ...stages, total }).map(([name, ms]) => `${name};dur=${ms}`).join(", "),
      };
    },
  };
}
