import sharp from "sharp";
import { galleryWriter } from "@/lib/gallery-http";
import { readBoundedJson } from "@/lib/roast/read-body";
import { signReceipt, verifyReceipt } from "@/lib/roast/receipt";
import { generateSeedreamOutput } from "@/lib/seedream-generation";
import { fetchGeneratedImage, normalizeGalleryImage } from "@/lib/gallery-media";
import { createRoastTiming } from "@/lib/roast/timing";

export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  const timing = createRoastTiming("meme");
  const viewer = await timing.measure("auth", () => galleryWriter(request));
  if (viewer instanceof Response) {
    for (const [name, value] of Object.entries(timing.headers(viewer.status))) viewer.headers.set(name, value);
    return viewer;
  }
  try {
    const body = await readBoundedJson(request, 300000) as { receipt?: string; snapshot?: string };
    if (typeof body.receipt !== "string" || typeof body.snapshot !== "string" || !body.snapshot.length || body.snapshot.length > 273068 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.snapshot)) throw new Error("Choose a completed live roast.");
    const roast = verifyReceipt(body.receipt, viewer.user.id, body.snapshot);
    const meta = await sharp(Buffer.from(body.snapshot, "base64"), { limitInputPixels: 640 * 640 }).metadata();
    if (meta.format !== "jpeg" || !meta.width || !meta.height || Math.max(meta.width, meta.height) > 640) throw new Error("Invalid roast snapshot.");
    const prompt = `Turn this exact screenshot into a finished meme. Preserve the person's identity, facial features, expression, clothing, background, framing and aspect ratio. Do not add people or change the scene. Add only this punchline, verbatim (render in uppercase): ${JSON.stringify(roast)}. Match the Checked Factory format: bold condensed Anton-style white uppercase lettering with a thick black outline, centered at the bottom inside the image, generous side and bottom margins, wrapped into at most three readable lines. Keep the face visible. No other text, panels, borders or collage.`;
    const url = await timing.measure("seedream", () => generateSeedreamOutput(prompt, `data:image/jpeg;base64,${body.snapshot}`, request.signal, { userId: viewer.user.id, source: "roast_meme", workflow: "roast_meme" }));
    const downloaded = await timing.measure("download", () => fetchGeneratedImage(url, request.signal));
    const bytes = await timing.measure("compress", () => normalizeGalleryImage(downloaded.bytes, downloaded.mime, 20 * 1024 * 1024));
    const snapshot = bytes.toString("base64");
    return Response.json({ snapshot, receipt: signReceipt(viewer.user.id, roast, snapshot, "meme") }, { headers: timing.headers(200) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Couldn’t generate your meme. Please retry." }, { status: 400, headers: timing.headers(400) });
  }
}
