import "server-only";
import sharp from "sharp";
import { supabase } from "@/lib/supabase";

export const PHOTO_BUCKET = "profile-photos";
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export async function prepareProfilePhoto(file: File) {
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Choose a photo smaller than 2 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP photo.");
  }
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 24_000_000 });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) {
      throw new Error("Unsupported image");
    }
    // Decode and re-encode to verify the image, apply its orientation, and strip EXIF.
    return await image.rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
  } catch {
    throw new Error("This photo couldn’t be read. Choose a still JPG, PNG, or WebP image under 24 megapixels.");
  }
}

export async function profilePhotoUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
