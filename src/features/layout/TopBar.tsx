import { IconBell, IconCalendar, IconMenu, IconSearch } from "./icons";
import logo from "../../assets/logo.svg";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <div className="border-b border-border bg-white">
      {/* Back button hidden for now - re-add a onClick={() => navigate(-1)}
          button here if it comes back. Account menu (Profile/Switch
          Account/Logout) moved to the Sidebar's bottom section - see
          Sidebar.tsx's SidebarUserMenu. The notification banner that used
          to live here moved to AppShell.tsx as an inset card - see
          NotificationBanner.tsx. The menu button + logo only show below `lg`,
          where the sidebar is a drawer instead of a fixed column. */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 lg:hidden">
          <button onClick={onMenuClick} aria-label="Open menu" className="-ml-1.5 rounded-md p-1.5 text-ink hover:bg-bg">
            <IconMenu width={22} height={22} />
          </button>
          <img src={logo} alt="" className="h-7 w-7" />
        </div>
        <div className="ml-auto flex items-center gap-4">
          <IconSearch className="text-gray-500" />
          <IconBell className="text-gray-500" />
          <IconCalendar className="text-gray-500" />
        </div>
      </div>
    </div>
  );
}
