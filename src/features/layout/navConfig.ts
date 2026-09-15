import type { ComponentType, SVGProps } from "react";
import {
  IconHome,
  IconList,
  IconCalendar,
  IconUsers,
  IconTag,
  IconFileText,
  IconBell,
  IconBuilding,
  IconShield,
  IconBook,
  IconHistory,
  IconBan,
  IconTarget,
  IconCamera,
  IconPlayCircle,
  IconInfo,
  IconScript,
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
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: IconHome,
    children: [
      { label: "Dashboard", path: "/dashboard", icon: IconHome },
      { label: "Reports", path: "/manager/reports", icon: IconFileText },
    ],
  },
  {
    label: "Worklist",
    path: "/worklist",
    icon: IconList,
    // Deals/Cancelled deliberately don't nest under /worklist (e.g.
    // /worklist/deals) - NavLink's default active-matching treats any path
    // sharing that prefix as "active" too (relied on elsewhere, e.g. Users
    // staying highlighted on a user's own detail page), which would wrongly
    // highlight Leads whenever Deals/Cancelled is open.
    children: [
      { label: "Leads", path: "/worklist", icon: IconList },
      { label: "Deals", path: "/deals", icon: IconTag },
      { label: "Cancelled", path: "/cancelled", icon: IconBan },
    ],
  },
  { label: "Opportunities", path: "/opportunities", icon: IconTarget },
  { label: "Calendar", path: "/calendar", icon: IconCalendar },
  {
    // Distinct from the existing org-structure "Teams" under User
    // Management (department/team-capacity admin) - this is a live-
    // collaboration module (huddle rooms, meetings, support sessions and
    // their recordings), so it gets its own top-level entry rather than
    // sharing that one.
    label: "Teams",
    path: "/teams/huddle-room",
    icon: IconCamera,
    children: [
      { label: "Huddle Room", path: "/teams/huddle-room", icon: IconUsers },
      { label: "Meeting", path: "/teams/meeting", icon: IconCalendar },
      { label: "Support Session", path: "/teams/support-session", icon: IconInfo },
      { label: "Recordings", path: "/teams/recordings", icon: IconPlayCircle },
    ],
  },
];

export const MANAGER_NAV: NavItem[] = [
  {
    label: "User Management",
    path: "/manager/users",
    icon: IconUsers,
    children: [
      { label: "Departments", path: "/manager/organization", icon: IconBuilding },
      { label: "Teams", path: "/manager/teams", icon: IconUsers },
      { label: "Users", path: "/manager/users", icon: IconUsers },
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
    label: "Marketing",
    path: "/manager/leads/campaigns",
    icon: IconBell,
    children: [
      { label: "Campaigns", path: "/manager/leads/campaigns", icon: IconBell },
      { label: "Templates", path: "/manager/templates", icon: IconFileText },
      { label: "Marketing Agents", path: "/manager/marketing/agents", icon: IconUsers },
    ],
  },
];

// Its own section below MANAGER (see Sidebar.tsx's border-t divider) rather
// than folded into either list above - was two inert, non-navigable
// placeholder buttons; now a real dropdown like every other grouped item,
// just kept visually and structurally separate the way the reference
// sidebar had it.
export const TRAINING_NAV: NavItem[] = [
  {
    label: "Training",
    path: "/training/walkthrough",
    icon: IconPlayCircle,
    children: [
      { label: "Walkthrough", path: "/training/walkthrough", icon: IconPlayCircle },
      { label: "Script Training", path: "/training/script-training", icon: IconScript },
    ],
  },
];

// Every route this sidebar can navigate to, parents and children flattened
// - App.tsx uses this to generate placeholder routes for anything not built
// out yet, and to know which paths exist at all.
export const ALL_NAV_ITEMS: Omit<NavItem, "children">[] = [...MENU_NAV, ...MANAGER_NAV, ...TRAINING_NAV].flatMap((item) =>
  item.children ? item.children : [item],
);
