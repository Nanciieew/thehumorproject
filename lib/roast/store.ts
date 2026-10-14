type Session = { jokes: string[]; updated: number; busy: boolean; next: number; controller?: AbortController };
const sessions = new Map<string, Session>();
const users = new Map<string, { count: number; until: number }>();
let active = 0;
export function resetSession(user: string, id: string) { const key = `${user}:${id}`; sessions.get(key)?.controller?.abort(); sessions.delete(key); }
export function acquireSession(user: string, id: string) {
  const now = Date.now();
  for (const [key, s] of sessions) if (now - s.updated > 900000) { s.controller?.abort(); sessions.delete(key); }
  for (const [key, u] of users) if (u.until < now) users.delete(key);
  const key = `${user}:${id}`;
  let s = sessions.get(key);
  const u = users.get(user) ?? { count: 0, until: now + 60000 };
  if (u.count >= 10 || active >= 4 || s?.busy || (s && s.next > now) || (!s && sessions.size >= 500) || (!users.has(user) && users.size >= 1000)) return null;
  u.count++; users.set(user, u);
  if (!s) { s = { jokes: [], updated: now, busy: false, next: 0 }; sessions.set(key, s); }
  s.busy = true; s.updated = now; s.next = now + 8000; s.controller = new AbortController(); active++;
  const session = s;
  return { session, current: () => sessions.get(key) === session && !session.controller?.signal.aborted, release: () => { session.busy = false; active--; } };
}
