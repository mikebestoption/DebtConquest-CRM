// Small dependency-free icon set (this monorepo doesn't pull in an icon
// library anywhere else either) - one <svg> per glyph, all sharing the same
// stroke-based style so they read as one system.
import type { SVGProps } from "react";

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
);
export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v10h14V10" />
  </Svg>
);
export const IconList = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3 6h.01M3 12h.01M3 18h.01" />
  </Svg>
);
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);
export const IconUpload = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 15V3M7 8l5-5 5 5" />
    <path d="M4 17v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Svg>
);
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
    <circle cx="18" cy="8" r="2.5" />
    <path d="M17 12.5c2.2.4 4 2.1 4 4.5v1" />
  </Svg>
);
export const IconTag = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 2H4v8l10 10 8-8L12 2Z" />
    <circle cx="8" cy="7" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconFileText = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
    <path d="M14 2v6h6M8 13h8M8 17h8" />
  </Svg>
);
export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const IconChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
);
export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </Svg>
);
export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
  </Svg>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconLink = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M9 15 15 9" />
    <path d="M11 6h2a4 4 0 0 1 0 8h-1" />
    <path d="M13 18h-2a4 4 0 0 1 0-8h1" />
  </Svg>
);
export const IconArrowDown = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Svg>
);
export const IconFilter = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 5h16l-6.5 8v6l-3 1v-7L4 5Z" />
  </Svg>
);
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 3v12M7 10l5 5 5-5" />
    <path d="M4 20h16" />
  </Svg>
);
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
  </Svg>
);
export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);
export const IconCamera = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 8h3l2-2h6l2 2h3v11H4Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Svg>
);
export const IconLock = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);
export const IconSwitch = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M17 2 21 6l-4 4" />
    <path d="M3 12v-2a4 4 0 0 1 4-4h14" />
    <path d="M7 22 3 18l4-4" />
    <path d="M21 12v2a4 4 0 0 1-4 4H3" />
  </Svg>
);
export const IconMail = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </Svg>
);
export const IconPencil = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
);
export const IconBan = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.5 5.5 13 13" />
  </Svg>
);
export const IconPlayCircle = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5v7l6-3.5Z" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconScript = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M15 3v4h4" />
    <path d="M9 12h6M9 15.5h6M9 8.5h2" />
  </Svg>
);
export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Svg>
);
export const IconFlag = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M5 3v18" />
    <path d="M5 4h13l-3 4 3 4H5" />
  </Svg>
);
export const IconChevronUpDown = (p: SVGProps<SVGSVGElement>) => (
  <Svg width="12" height="12" {...p}>
    <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
  </Svg>
);
export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 3 5 6v6c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5Z" />
    <path d="M4 16.5A2.5 2.5 0 0 1 6.5 19H20" />
  </Svg>
);
export const IconHistory = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 9-9" />
    <path d="M3 4v5h5" />
    <path d="M12 7v5l3.5 2" />
  </Svg>
);
export const IconBuilding = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="4" y="3" width="10" height="18" rx="1" />
    <path d="M14 8h6v13h-6M7 7h.01M11 7h.01M7 11h.01M11 11h.01M7 15h.01M11 15h.01" />
  </Svg>
);
