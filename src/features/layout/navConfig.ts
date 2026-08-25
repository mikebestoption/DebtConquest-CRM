import type { ComponentType, SVGProps } from "react";
import {
  IconSearch,
  IconHome,
  IconList,
  IconCalendar,
  IconUpload,
  IconUsers,
  IconTag,
  IconFileText,
  IconFlag,
  IconGrid,
  IconX,
  IconBell,
  IconBuilding,
  IconShield,
  IconBook,
  IconHistory,
} from "./icons";

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
      { label: "Organization", path: "/manager/organization", icon: IconBuilding },
    ],
  },
  {
    // Department + Job Title -> Access Profile engine's admin surface -
    // see accessProfile.service.ts. Kept as its own top-level group (not
    // nested under User Management) since it's meant to be visible only to
    // access administrators, not every manager.
    label: "Access Management",
    path: "/manager/access/profiles",
    icon: IconShield,
    children: [
      { label: "Access Profiles", path: "/manager/access/profiles", icon: IconShield },
      { label: "Permission Catalog", path: "/manager/access/permissions", icon: IconBook },
      { label: "Policy Versions", path: "/manager/access/versions", icon: IconHistory },
      { label: "Access Audit Log", path: "/manager/access/audit-log", icon: IconFileText },
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
