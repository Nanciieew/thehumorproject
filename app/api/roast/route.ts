import sharp from "sharp";
import { getViewer } from "@/lib/auth/profile";
import { validRequest, validOutput } from "@/lib/roast/contracts";
import { acquireSharedSession } from "@/lib/roast/shared-store";
import { signReceipt } from "@/lib/roast/receipt";
import { generateRoast } from "@/lib/roast/gemini";
import { readBoundedJson } from "@/lib/roast/read-body";
export const runtime = "nodejs";
export const maxDuration = 20;
const error = (code: string, message: string, status: number) => Response.json({ code, message }, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return error("INVALID_REQUEST", "Invalid request origin.", 403);
  const viewer = await getViewer();
  if (!viewer) return error("INVALID_REQUEST", "Please sign in and finish signup.", 401);
  if (process.env.ROAST_PROVIDER !== "gemini") return error("PROVIDER_UNAVAILABLE", "Live AI roasting is not enabled.", 503);
  let body;
  try {
    body = await readBoundedJson(request, 1048576);
    if (!validRequest(body)) throw new Error();
    for (const frame of body.frames) {
      const bytes = Buffer.from(frame.base64, "base64");
      if (bytes.length > 204800) throw new Error();
      const image = sharp(bytes, { limitInputPixels: 640 * 640 });
      const meta = await image.metadata();
      if (meta.format !== "jpeg" || !meta.width || !meta.height || Math.max(meta.width, meta.height) > 640) throw new Error();
      await image.stats();
    }
  } catch { return error("INVALID_REQUEST", "Use 1–3 recent JPEG snapshots under 200 KB and 640 pixels each.", 400); }
  let lock;
  try { lock = await acquireSharedSession(viewer.user.id, body.sessionId); }
  catch { return error("PROVIDER_UNAVAILABLE", "Shared roast storage is unavailable. Install the Ego Check database migration.", 503); }
  if (!lock) return error("RATE_LIMITED", "Please wait a moment before trying again.", 429);
  try {
    const signal = request.signal;
    const output = await generateRoast(body, lock.jokes, signal);
    const duplicate = validOutput(output) && output.roast && lock.jokes.some(j => j.toLowerCase().replace(/\W/g, "") === output.roast!.toLowerCase().replace(/\W/g, ""));
    const excluded = validOutput(output) && output.roast && body.settings.excludedTopics.some(t => t.trim() && output.roast!.toLowerCase().includes(t.toLowerCase()));
    const accepted = !signal.aborted && validOutput(output) && !duplicate && !excluded;
    const result = accepted ? output : { status: "skip", roast: null, anchor: "screen" };
    const current = await lock.finish(accepted && output.status === "ok" ? output.roast! : null);
    if (!current) return Response.json({ sessionId: body.sessionId, requestId: body.requestId, status: "skip", roast: null, anchor: "screen" });
    const receipt = accepted && output.status === "ok" ? signReceipt(viewer.user.id, output.roast!, body.frames[body.frames.length - 1].base64) : undefined;
    return Response.json({ sessionId: body.sessionId, requestId: body.requestId, ...result, receipt }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const name = e instanceof Error ? e.message : "";
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return error(timeout ? "PROVIDER_TIMEOUT" : name === "QUOTA" ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE", timeout ? "The roast timed out. You can resume when ready." : name === "CONFIG" ? "Gemini credentials or model are missing. Ask the site owner to configure them." : "AI roasting is unavailable. Check quota or try again later.", timeout ? 504 : name === "QUOTA" ? 429 : 503);
  } finally { await lock.finish(null).catch(() => {}); }
}
