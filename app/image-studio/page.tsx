import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { ImageStudio } from "./studio";
import { supabase } from "@/lib/supabase";

export const metadata: Metadata = { title: "Image Studio | The Humor Project" };

export default async function ImageStudioPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { data, error } = await supabase.from("images").select("id,private_storage_path,published_at")
    .eq("contributor_id", viewer.user.id).eq("source", "generated")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(30);
  if (error) throw new Error("Couldn’t load saved images. Please refresh Image Studio.");
  const saved = await Promise.all(data.map(async (row) => {
    const signed = await supabase.storage.from("generated-images").createSignedUrl(row.private_storage_path, 3600);
    return { id: row.id, generationId: row.id, prompt: "Saved image", test: false, published: row.published_at !== null,
      ...(signed.data ? { url: signed.data.signedUrl } : { error: "Couldn’t load this saved photo. Please refresh." }),
    };
  }));
  return <ImageStudio configured={Boolean(process.env.ARK_API_KEY)} saved={saved} />;
}
