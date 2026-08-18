import type { ComponentType, SVGProps } from "react";
import { IconSearch, IconHome, IconList, IconCalendar, IconUpload, IconUsers, IconTag, IconFileText, IconFlag, IconGrid, IconX, IconBell } from "./icons";

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // Expandable group (e.g. "User Management" -> Users/Teams) - the parent
  // itself isn't a route, clicking it just toggles the group open.
  children?: Omit<NavItem, "children">[];
}

// Mirrors the reference screenshot's sidebar: MENU (day-to-day agent work,
// Worklist is the only page built out this phase) and MANAGER (admin
// screens - all placeholders except User Management > Users, see
// PlaceholderPage).
export const MENU_NAV: NavItem[] = [
  { label: "Search", path: "/search", icon: IconSearch },
  { label: "Dashboard", path: "/dashboard", icon: IconHome },
  { label: "Worklist", path: "/worklist", icon: IconList },
  { label: "Calendar", path: "/calendar", icon: IconCalendar },
  { label: "Prospect Data Upload", path: "/prospect-upload", icon: IconUpload },
];

export const MANAGER_NAV: NavItem[] = [
  {
    label: "User Management",
    path: "/manager/users",
    icon: IconUsers,
    children: [
      { label: "Users", path: "/manager/users", icon: IconUsers },
      { label: "Teams", path: "/manager/teams", icon: IconUsers },
    ],
  },
  {
    label: "Lead Management",
    path: "/manager/leads/sources",
    icon: IconTag,
    children: [
      { label: "Sources", path: "/manager/leads/sources", icon: IconTag },
      { label: "Client Status", path: "/manager/leads/client-status", icon: IconFlag },
      { label: "Programs States", path: "/manager/leads/programs-states", icon: IconGrid },
      { label: "Reject Reasons", path: "/manager/leads/reject-reasons", icon: IconX },
      { label: "Campaigns", path: "/manager/leads/campaigns", icon: IconBell },
    ],
  },
  { label: "Templates", path: "/manager/templates", icon: IconFileText },
  { label: "Reports", path: "/manager/reports", icon: IconFileText },
];

// Every route this sidebar can navigate to, parents and children flattened
// - App.tsx uses this to generate placeholder routes for anything not built
// out yet, and to know which paths exist at all.
export const ALL_NAV_ITEMS: Omit<NavItem, "children">[] = [...MENU_NAV, ...MANAGER_NAV].flatMap((item) =>
  item.children ? item.children : [item],
);
