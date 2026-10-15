export async function ego<T>(action: string, data: object = {}): Promise<T> {
  const r = await fetch("/api/ego", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }), cache: "no-store" });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error ?? "Couldn’t complete this action.");
  return body as T;
}
