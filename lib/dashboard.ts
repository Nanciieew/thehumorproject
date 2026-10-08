import "server-only";
import { getViewer } from "./auth/profile";
import { supabase } from "./supabase";
import type { DashboardSummary } from "./dashboard-types";

// Trusted server callers must supply the authenticated contributor, never a request parameter.
export async function readDashboardTotals(contributorId: string): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc("personal_dashboard_summary", { p_contributor_id: contributorId });
  if (!error) return data as DashboardSummary;
  // Support the existing live schema until the aggregate migration is installed.
  if (error.code !== "PGRST202") throw new Error("Couldn’t load your dashboard totals. Please try again.");
  const asOf = new Date().toISOString();
  const size = 250;
  let published = BigInt(0), upvotes = BigInt(0), revenue = BigInt(0);
  let afterImage: string | null = null;
  while (true) {
    let query = supabase.from("images").select("id").eq("contributor_id", contributorId)
      .not("published_at", "is", null).lte("published_at", asOf).order("id").limit(size);
    if (afterImage) query = query.gt("id", afterImage);
    const { data: images, error: imageError } = await query;
    if (imageError) throw new Error("Couldn’t load your dashboard totals. Please try again.");
    if (!images.length) break;
    const { data: votes, error: voteError } = await supabase.from("gallery_vote_totals").select("upvotes").in("photo_id", images.map(image => image.id));
    if (voteError) throw new Error("Couldn’t load your dashboard totals. Please try again.");
    published += BigInt(images.length);
    upvotes += votes.reduce((sum, vote) => sum + BigInt(vote.upvotes), BigInt(0));
    afterImage = images[images.length - 1].id;
    if (images.length < size) break;
  }
  let afterSale: string | null = null;
  while (true) {
    let query = supabase.from("image_sales").select("id,amount_cents,refunded_cents").eq("seller_id", contributorId)
      .lte("sold_at", asOf).lte("recorded_at", asOf).order("id").limit(size);
    if (afterSale) query = query.gt("id", afterSale);
    const { data: sales, error: saleError } = await query;
    if (saleError) throw new Error("Couldn’t load your dashboard totals. Please try again.");
    if (!sales.length) break;
    revenue += sales.reduce((sum, sale) => sum + BigInt(sale.amount_cents) - BigInt(sale.refunded_cents), BigInt(0));
    afterSale = sales[sales.length - 1].id;
    if (sales.length < size) break;
  }
  return { published_count: published.toString(), upvotes: upvotes.toString(), revenue_cents: revenue.toString() };
}
export async function readDashboard(): Promise<DashboardSummary> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Please log in and finish signup.");
  return readDashboardTotals(viewer.user.id);
}
