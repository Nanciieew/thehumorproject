import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/profile";
import { ImageStudio } from "./studio";
import { supabase } from "@/lib/supabase";

export const metadata: Metadata = { title: "Image Studio | The Humor Project" };

export default async function ImageStudioPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { data, error } = await supabase.from("generated_images").select("id,storage_path").eq("contributor_id", viewer.user.id).order("created_at", { ascending: false }).limit(30);
  if (error) throw new Error("Couldn’t load saved images. Please refresh Image Studio.");
  const published = await supabase.from("gallery_photos").select("generation_id").eq("contributor_id", viewer.user.id).eq("source", "generated");
  if (published.error) throw new Error("Couldn’t check published images. Please refresh Image Studio.");
  const ids = new Set(published.data.map((row) => row.generation_id));
  const saved = await Promise.all(data.map(async (row) => {
    const signed = await supabase.storage.from("generated-images").createSignedUrl(row.storage_path, 3600);
    return { id: row.id, generationId: row.id, prompt: "Saved image", test: false, published: ids.has(row.id),
      ...(signed.data ? { url: signed.data.signedUrl } : { error: "Couldn’t load this saved photo. Please refresh." }),
    };
  }));
  return <ImageStudio configured={Boolean(process.env.ARK_API_KEY)} saved={saved} />;
}
