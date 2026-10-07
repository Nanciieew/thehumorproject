// node --env-file=.env.local --conditions=react-server --import tsx scripts/cleanup-gallery.ts
import { cleanupGalleryStaging } from "../lib/gallery-media";

cleanupGalleryStaging().catch(() => { console.error("Gallery staging cleanup failed."); process.exitCode = 1; });
