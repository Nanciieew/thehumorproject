import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
function secret() { const s = process.env.SUPABASE_SECRET_KEY; if (!s) throw new Error("Receipt signing is unavailable."); return s; }
export function signReceipt(user: string, roast: string, base64: string) {
  const data = Buffer.from(JSON.stringify({ user, roast, hash: createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex"), expires: Date.now() + 15 * 60000 })).toString("base64url");
  return `${data}.${createHmac("sha256", secret()).update(data).digest("base64url")}`;
}
export function verifyReceipt(token: string, user: string, base64: string): string {
  if (typeof token !== "string" || token.length > 3000) throw new Error("Invalid receipt.");
  const [data, signature, extra] = token.split(".");
  if (!data || !signature || extra) throw new Error("Invalid receipt.");
  const expected = createHmac("sha256", secret()).update(data).digest(); const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error("Invalid receipt.");
  const payload = JSON.parse(Buffer.from(data, "base64url").toString());
  const hash = createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex");
  if (payload.user !== user || payload.hash !== hash || payload.expires < Date.now() || typeof payload.roast !== "string" || payload.roast.length > 240) throw new Error("This receipt has expired or does not match your snapshot. Run a new roast.");
  return payload.roast;
}
