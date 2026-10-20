"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadPhoto } from "../gallery";
import styles from "./checkboard.module.css";

export function UploadMeme() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return <><button className={styles.upload} onClick={() => setOpen(true)}><span aria-hidden="true">↥</span> Upload meme</button>{open && <UploadPhoto close={() => setOpen(false)} published={() => { setOpen(false); router.refresh(); }} />}</>;
}
