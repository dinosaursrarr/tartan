import type { ReactNode, SVGProps } from "react";

export type IconName = "plus" | "copy" | "download" | "external" | "trash" | "grip" | "check" | "search" | "refresh" | "chevron" | "x" | "link" | "code" | "github" | "scissors" | "palette" | "image" | "undo" | "redo" | "arrow-left" | "arrow-right" | "expand";

const paths: Record<IconName, ReactNode> = {
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
  external: <><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></>,
  grip: <><circle cx="9" cy="5" r="1" fill="currentColor" /><circle cx="15" cy="5" r="1" fill="currentColor" /><circle cx="9" cy="12" r="1" fill="currentColor" /><circle cx="15" cy="12" r="1" fill="currentColor" /><circle cx="9" cy="19" r="1" fill="currentColor" /><circle cx="15" cy="19" r="1" fill="currentColor" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  refresh: <><path d="M20 7v5h-5" /><path d="M4.8 9A7.5 7.5 0 0 1 18.2 6L20 12" /><path d="M4 17v-5h5" /><path d="M19.2 15A7.5 7.5 0 0 1 5.8 18L4 12" /></>,
  chevron: <path d="m7 10 5 5 5-5" />,
  x: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" /></>,
  code: <><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="m14 5-4 14" /></>,
  github: <><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.7A5.2 5.2 0 0 0 18.8 3a4.8 4.8 0 0 0-.1-3S17.5-.4 15 1.5a13.3 13.3 0 0 0-7 0C5.5-.4 4.3 0 4.3 0a4.8 4.8 0 0 0-.1 3A5.2 5.2 0 0 0 2.8 6.8c0 5.2 3.1 6.4 6.1 6.7A3.4 3.4 0 0 0 8 16.1V22" transform="translate(2 1) scale(.85)" /></>,
  scissors: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="m8 8 12 10M8 16 20 6" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18h1.2a2.2 2.2 0 0 0 1.4-3.9 1.8 1.8 0 0 1 1.1-3.2h1.8A3.5 3.5 0 0 0 21 10.4C21 6.3 17 3 12 3Z" /><circle cx="7.5" cy="10" r="1" fill="currentColor" /><circle cx="11" cy="7" r="1" fill="currentColor" /><circle cx="15.5" cy="8.5" r="1" fill="currentColor" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-2" /></>,
  redo: <><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h2" /></>,
  "arrow-left": <><path d="m14 18-6-6 6-6" /><path d="M8 12h12" /></>,
  "arrow-right": <><path d="m10 18 6-6-6-6" /><path d="M4 12h12" /></>,
  expand: <><path d="M8 3H3v5" /><path d="M3 3l7 7" /><path d="M16 3h5v5" /><path d="m21 3-7 7" /><path d="M3 16v5h5" /><path d="m3 21 7-7" /><path d="M21 16v5h-5" /><path d="m21 21-7-7" /></>,
};

export function Icon({ name, size = 16, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
