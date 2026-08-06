import type { ComponentType, SVGProps } from "react";
import { IconSearch, IconHome, IconList, IconCalendar, IconUpload, IconUsers, IconTag, IconFileText } from "./icons";

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// Mirrors the reference screenshot's sidebar: MENU (day-to-day agent work,
// Worklist is the only page built out this phase) and MANAGER (admin
// screens - all placeholders for now, see PlaceholderPage).
export const MENU_NAV: NavItem[] = [
  { label: "Search", path: "/search", icon: IconSearch },
  { label: "Dashboard", path: "/dashboard", icon: IconHome },
  { label: "Worklist", path: "/worklist", icon: IconList },
  { label: "Calendar", path: "/calendar", icon: IconCalendar },
  { label: "Prospect Data Upload", path: "/prospect-upload", icon: IconUpload },
];

export const MANAGER_NAV: NavItem[] = [
  { label: "User Management", path: "/manager/users", icon: IconUsers },
  { label: "Lead Management", path: "/manager/leads", icon: IconTag },
  { label: "Templates", path: "/manager/templates", icon: IconFileText },
  { label: "Reports", path: "/manager/reports", icon: IconFileText },
];
