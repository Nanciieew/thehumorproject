export type Intensity = "playful" | "savage" | "profane";
export type RoastEvent = { type: "head_tilt" | "lean_in" | "mouth_open" | "smile_change" | "reentered_frame"; observedAtMs: number };
export type RoastRequest = { sessionId: string; requestId: string; settings: { intensity: Intensity; excludedTopics: string[]; direction?: string }; frames: { mimeType: "image/jpeg"; base64: string; capturedAtMs: number }[]; events: RoastEvent[] };
export type RoastResponse = { sessionId: string; requestId: string; status: "ok" | "skip"; roast: string | null; anchor: "face" | "screen"; receipt?: string };
export function validRequest(b: unknown): b is RoastRequest {
  if (!b || typeof b !== "object") return false;
  const r = b as RoastRequest;
  const id = (s: unknown) => typeof s === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(s);
  return id(r.sessionId) && id(r.requestId) && !!r.settings && ["playful", "savage", "profane"].includes(r.settings.intensity)
    && (r.settings.direction === undefined || (typeof r.settings.direction === "string" && r.settings.direction.length <= 500))
    && Array.isArray(r.settings.excludedTopics) && r.settings.excludedTopics.length <= 10 && r.settings.excludedTopics.every(t => typeof t === "string" && t.length <= 80)
    && Array.isArray(r.frames) && r.frames.length >= 1 && r.frames.length <= 3 && r.frames.every(f => f && f.mimeType === "image/jpeg" && typeof f.base64 === "string" && f.base64.length <= 273068 && /^[A-Za-z0-9+/]+={0,2}$/.test(f.base64) && Number.isFinite(f.capturedAtMs) && Math.abs(Date.now() - f.capturedAtMs) < 15000)
    && Array.isArray(r.events) && r.events.length <= 8 && r.events.every(e => e && ["head_tilt", "lean_in", "mouth_open", "smile_change", "reentered_frame"].includes(e.type) && Number.isFinite(e.observedAtMs) && Math.abs(Date.now() - e.observedAtMs) < 15000);
}
export function validOutput(v: unknown): v is Pick<RoastResponse, "status" | "roast" | "anchor"> {
  if (!v || typeof v !== "object") return false;
  const r = v as RoastResponse;
  return ["face", "screen"].includes(r.anchor) && ((r.status === "skip" && r.roast === null) || (r.status === "ok" && typeof r.roast === "string" && r.roast.trim().length > 0 && r.roast.length <= 240 && r.roast.trim().split(/\s+/).length <= 35));
}
