import type { ReactNode } from "react";

type IconName = "arrow" | "grid" | "spark" | "user" | "leaderboard" | "logout" | "upload" | "close";
export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M5 19 19 5M5 5h14v14" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    spark: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    leaderboard: <path d="M4 21V12h5v9m0 0V4h6v17m0 0V9h5v12M2 21h20" />,
    logout: <path d="M10 4H4v16h6m4-12 4 4-4 4m-5-4h11" />,
    upload: <path d="M12 16V3m-5 5 5-5 5 5M3 15v5h18v-5" />,
    close: <path d="m5 5 14 14M19 5 5 19" />,
  };
  return <svg aria-hidden="true" className={`ui-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function Smile({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" className={`smile-art ${className}`} viewBox="0 0 100 100" fill="currentColor" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round"><circle cx="50" cy="50" r="44" /><path d="M30 54q20 31 40 0M33 32v10m34-10v10" fill="none" /></svg>;
}

export function CameraArtwork() {
  return <svg aria-hidden="true" className="studio-illustration" viewBox="0 0 260 210" stroke="var(--foreground)" strokeWidth="2"><path d="M53 80h150v110H53z" fill="var(--background)" /><path d="m71 81 12-24h50l12 24" fill="var(--play-green)" /><circle cx="128" cy="133" r="37" fill="var(--play-blue)" /><circle cx="128" cy="133" r="24" fill="var(--background)" /><path d="m210 14 8 21 22 2-17 14 5 23-18-13-21 12 8-23-17-15 23 1Z" fill="var(--play-orange)" /><circle cx="179" cy="103" r="7" fill="var(--play-red)" /><path d="M18 130c-6-39 12-75 43-89m-1 0-23 0m23 0-3 20M180 210h53" fill="none" /></svg>;
}

export function EmptyImageArtwork() {
  return <svg aria-hidden="true" className="empty-art" viewBox="0 0 160 160" stroke="var(--foreground)" strokeWidth="1.5"><path d="M25 35h110v90H25z" fill="var(--background)" /><circle cx="59" cy="61" r="11" fill="var(--play-orange)" /><path d="m25 112 36-28 21 16 29-39 24 39" fill="var(--play-green)" /><path d="m132 4 5 10 11 3-8 8 1 12-9-6-11 4 4-11-6-9 12-1Z" fill="var(--play-blue)" /></svg>;
}

export function ColorPlay({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`color-play ${className}`}><span /><span /><span /><span /></span>;
}
