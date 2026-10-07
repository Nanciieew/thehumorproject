import { getViewer } from "@/lib/auth/profile";
import { SEEDREAM_MODEL } from "@/lib/seedream";

export const maxDuration = 180;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Please sign in and finish signup to generate images." }, { status: 401 });
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof body?.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 4000) {
    return Response.json({ error: "Enter a prompt between 1 and 4,000 characters." }, { status: 400 });
  }
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) return Response.json({ error: "Image generation is not configured. Add ARK_API_KEY to the server environment." }, { status: 503 });
  try {
    const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: SEEDREAM_MODEL, prompt: body.prompt.trim(), size: "2K", response_format: "url", watermark: true }),
      signal: AbortSignal.timeout(150_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      const error = failure?.error?.code === "SetLimitExceeded"
        ? "This model is paused because your Ark account reached its set usage limit. Adjust or close Safe Experience Mode on Ark’s Model Activation page, then try again."
        : response.status === 401 || response.status === 403
        ? "Ark rejected access. Check the server API key and model permissions."
        : response.status === 429 ? "Ark is busy or your quota is exhausted. Please try again later."
        : "Ark could not generate this image. Try a different prompt or try again later.";
      return Response.json({ error }, { status: 502 });
    }
    const result = await response.json();
    const url = result.data?.[0]?.url;
    if (typeof url !== "string" || new URL(url).protocol !== "https:") {
      return Response.json({ error: "The model returned no usable image. Please try again." }, { status: 502 });
    }
    return Response.json({ url, model: SEEDREAM_MODEL }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return Response.json({ error: timedOut ? "Generation timed out. Please try again." : "Could not connect to Ark. Please try again later." }, { status: timedOut ? 504 : 502 });
  }
}
