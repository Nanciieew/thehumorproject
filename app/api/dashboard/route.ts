import { getViewer } from "@/lib/auth/profile";
import { readDashboard } from "@/lib/dashboard";

export async function GET() {
  if (!await getViewer()) return Response.json({ error: "Please log in and finish signup." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  try { return Response.json(await readDashboard(), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return Response.json({ error: "Couldn’t load your dashboard totals. Please try again." }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}
