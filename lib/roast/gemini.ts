import "server-only";
import type { RoastRequest } from "./contracts";

import { roastInstruction } from "../ai/prompts";
import { auditedGeneration, readProviderResponse, type GenerationContext } from "../ai/audit";

export async function generateRoast(body: RoastRequest, jokes: string[], signal: AbortSignal, context: GenerationContext) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!key || !model || !/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error("CONFIG");
  const payload = {
    systemInstruction: { parts: [{ text: roastInstruction }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify({ settings: body.settings, events: body.events, frameTimes: body.frames.map(f => f.capturedAtMs), recentJokes: jokes }) }, ...body.frames.map(f => ({ inlineData: { mimeType: f.mimeType, data: f.base64 } }))] }],
    generationConfig: { responseMimeType: "application/json", responseJsonSchema: { type: "object", properties: { status: { type: "string", enum: ["ok", "skip"] }, roast: { type: ["string", "null"] }, anchor: { type: "string", enum: ["face", "screen"] } }, required: ["status", "roast", "anchor"], additionalProperties: false }, maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: "low" } }
  };
  return auditedGeneration({ context, provider: "Google Gemini", model, request: payload }, async capture => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), cache: "no-store",
      body: JSON.stringify(payload)
    });
    const data = await readProviderResponse(response, capture);
    if (!response.ok) throw new Error(response.status === 429 ? "QUOTA" : "PROVIDER");
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    try { return JSON.parse(parts.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? "").join("")); } catch { return null; }
  });
}
