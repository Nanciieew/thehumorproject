export type Work = {
  work_id: string; source: "upload" | "generated"; created_at: string; published_at?: string | null;
  upvotes?: string; downvotes?: string;
  photo_id: string | null; title: string; description: string; photo_url: string;
};
export type WorksSort = "top" | "newest";
export type WorksPage = { items: Work[]; next_cursor: string | null; received?: { upvotes: string; downvotes: string } };
