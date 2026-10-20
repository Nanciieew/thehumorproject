"use client";

import Image, { type ImageProps, type ImageLoaderProps } from "next/image";

const publicGallery = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/gallery-photos/` : null;
const privateThumbnail = /^\/api\/my-works\/[0-9a-f-]+\/thumbnail$/i;
function thumbnailLoader({ src, width }: ImageLoaderProps) {
  const size = width <= 320 ? 320 : width <= 640 ? 640 : 960;
  return `${src}?w=${size}`;
}

/** Public cards use Next's responsive cache; private cards stay behind session auth. */
export function MemeImage(props: Omit<ImageProps, "loader" | "unoptimized">) {
  const src = typeof props.src === "string" ? props.src : "";
  const privateImage = privateThumbnail.test(src);
  return <Image {...props} alt={props.alt} loader={privateImage ? thumbnailLoader : undefined}
    unoptimized={!privateImage && !(publicGallery && src.startsWith(publicGallery))} />;
}
