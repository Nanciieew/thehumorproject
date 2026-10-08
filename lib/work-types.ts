export type Work = {
  work_id: string; source: "upload" | "generated"; created_at: string;
  photo_id: string | null; title: string; description: string; photo_url: string;
};
export type WorksPage = { items: Work[]; next_cursor: string | null };
