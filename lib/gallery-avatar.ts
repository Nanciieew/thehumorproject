import "server-only";
import { supabase } from "./supabase";
import { isUuid } from "./gallery-types";

export async function readPublicAvatar(id: string) {
  if (!isUuid(id)) return null;
  // Only published images and their public captions may appear on this route.
  const { data, error } = await supabase.from("images")
    .select("id,title,description,contributor_id,public_storage_path,published_at")
    .eq("id", id).not("published_at", "is", null).not("public_storage_path", "is", null).maybeSingle();
  if (error) throw new Error("Couldn’t load this avatar. Please try again.");
  if (!data) return null;
  const creator = await supabase.from("profiles").select("first_name,last_name").eq("id", data.contributor_id).maybeSingle();
  if (creator.error) throw new Error("Couldn’t load this avatar’s creator.");
  return {
    id: data.id, title: data.title, description: data.description,
    name: [creator.data?.first_name, creator.data?.last_name].filter(Boolean).join(" ") || "Community creator",
    photo_url: supabase.storage.from("gallery-photos").getPublicUrl(data.public_storage_path).data.publicUrl,
  };
}
