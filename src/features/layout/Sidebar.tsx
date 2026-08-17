import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MENU_NAV, MANAGER_NAV, type NavItem } from "./navConfig";
import { IconChevronDown } from "./icons";

function NavRow({ item, nested }: { item: Omit<NavItem, "children">; nested?: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${nested ? "pl-9" : ""} ${
          isActive ? "bg-teal text-white" : "text-gray-300 hover:bg-teal-100 hover:text-white"
        }`
      }
    >
      {!nested && <Icon className="shrink-0" />}
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function NavGroup({ item }: { item: NavItem }) {
  const location = useLocation();
  const childActive = item.children?.some((c) => location.pathname.startsWith(c.path)) ?? false;
  const [open, setOpen] = useState(childActive);
  const Icon = item.icon;

  if (!item.children) return <NavRow item={item} />;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
          childActive ? "text-white" : "text-gray-300 hover:bg-teal-100 hover:text-white"
        }`}
      >
        <Icon className="shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <IconChevronDown width={14} height={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {item.children.map((child) => (
            <NavRow key={child.path} item={child} nested />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-deep px-3 py-4">
      <div className="mb-5 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal text-sm font-bold text-white">DC</div>
        <span className="text-sm font-semibold text-white">DebtConquest CRM</span>
      </div>

      <div className="relative mb-5 px-1">
        <IconSearchInput />
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto">
        <div>
          <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-gray-500">MENU</p>
          <div className="space-y-1">
            {MENU_NAV.map((item) => (
              <NavGroup key={item.path} item={item} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-gray-500">MANAGER</p>
          <div className="space-y-1">
            {MANAGER_NAV.map((item) => (
              <NavGroup key={item.path} item={item} />
            ))}
          </div>
        </div>
      </nav>
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
