import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { MENU_NAV, MANAGER_NAV, type NavItem } from "./navConfig";
import { useAuthStore } from "../../state/authStore";
import { IconChevronDown, IconChevronLeft, IconPlayCircle, IconScript, IconSwitch, IconUser, IconX } from "./icons";
import logo from "../../assets/logo.svg";

function NavRow({ item, nested, collapsed }: { item: Omit<NavItem, "children">; nested?: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${nested && !collapsed ? "pl-9" : ""} ${
          collapsed ? "justify-center" : ""
        } ${isActive ? "bg-teal text-white" : "text-gray-300 hover:bg-teal-100 hover:text-white"}`
      }
    >
      {(!nested || collapsed) && <Icon className="shrink-0" />}
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
}

function NavGroup({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const childActive = item.children?.some((c) => location.pathname.startsWith(c.path)) ?? false;
  const [open, setOpen] = useState(childActive);
  const Icon = item.icon;

  if (!item.children) return <NavRow item={item} collapsed={collapsed} />;

  // Collapsed sidebars have no room for a flyout submenu this pass -
  // clicking the icon jumps straight to the group's first child instead.
  if (collapsed) {
    return (
      <button
        type="button"
        title={item.label}
        onClick={() => navigate(item.children![0].path)}
        className={`flex w-full items-center justify-center rounded-md px-3 py-2 transition-colors ${
          childActive ? "bg-teal text-white" : "text-gray-300 hover:bg-teal-100 hover:text-white"
        }`}
      >
        <Icon className="shrink-0" />
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          childActive ? "text-white" : "text-gray-300 hover:bg-teal-100 hover:text-white"
        }`}
      >
        <Icon className="shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <IconChevronDown width={14} height={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <NavRow key={child.path} item={child} nested collapsed={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarUserMenu({ collapsed }: { collapsed: boolean }) {
  const staff = useAuthStore((s) => s.staff);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const displayName = staff ? [staff.firstName, staff.lastName].filter(Boolean).join(" ") || staff.email : "";

  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-full left-0 z-10 mb-1 w-44 rounded-md border border-border bg-white py-1 shadow-card">
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-teal hover:bg-bg"
            onClick={() => {
              setOpen(false);
              navigate("/profile");
            }}
          >
            <IconUser width={14} height={14} /> Profile
          </button>
          <button
            title="No other accounts to switch to yet - single-company setup"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-400"
            disabled
          >
            <IconSwitch width={14} height={14} /> Switch Account
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-bg"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <IconX width={14} height={14} /> Logout
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? displayName : undefined}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-white hover:bg-teal-100 ${collapsed ? "justify-center" : ""}`}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal text-white">
          {staff?.avatarUrl ? <img src={staff.avatarUrl} alt="" className="h-full w-full object-cover" /> : <IconUser width={14} height={14} />}
        </div>
        {!collapsed && <span className="truncate text-sm font-medium">{displayName}</span>}
      </button>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`flex h-screen shrink-0 flex-col bg-deep py-4 transition-all ${collapsed ? "w-20 px-2" : "w-60 px-3"}`}>
      <div className={`mb-4 flex items-center gap-2 ${collapsed ? "justify-center" : "px-2"}`}>
        <img src={logo} alt="" className="h-8 w-8 shrink-0" />
        {!collapsed && <span className="truncate text-sm font-semibold text-white">DebtConquest CRM</span>}
      </div>

      {!collapsed && (
        <div className="relative mb-3 px-1">
          <IconSearchInput />
        </div>
      )}

      {/* No walkthrough tour / training script content exists yet - these
          are inert placeholders (see SidebarUserMenu's "Switch Account" for
          the same pattern) until there's something real for them to open. */}
      <div className="space-y-0.5 border-b border-white/10 pb-3">
        <button
          type="button"
          title="No walkthrough content yet"
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-300 ${collapsed ? "justify-center" : ""}`}
        >
          <IconPlayCircle className="shrink-0" />
          {!collapsed && <span className="truncate">Walkthrough</span>}
        </button>
        <button
          type="button"
          title="No training script yet"
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-300 ${collapsed ? "justify-center" : ""}`}
        >
          <IconScript className="shrink-0" />
          {!collapsed && <span className="truncate">Script Training</span>}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto">
        <div className="border-b border-white/10 py-3">
          {!collapsed && <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-gray-500">MENU</p>}
          <div className="space-y-0.5">
            {MENU_NAV.map((item) => (
              <NavGroup key={item.path} item={item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        <div className="py-3">
          {!collapsed && <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-gray-500">MANAGER</p>}
          <div className="space-y-0.5">
            {MANAGER_NAV.map((item) => (
              <NavGroup key={item.path} item={item} collapsed={collapsed} />
            ))}
          </div>
        </div>
      </nav>

      <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
        <SidebarUserMenu collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-teal-100 hover:text-white ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <IconChevronLeft className={`shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

function IconSearchInput() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-teal-100 px-3 py-2 text-gray-400">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        placeholder="Search menu items"
        className="w-full bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-500"
        disabled
      />
    </div>
  );
}
