import { useNavigate } from "react-router-dom";
import { IconBell, IconCalendar, IconSearch } from "./icons";

export function TopBar() {
  const navigate = useNavigate();

  return (
    <div className="border-b border-border bg-white">
      <div className="flex items-center justify-between px-6 py-3">
        <button className="rounded-md p-1.5 text-gray-500 hover:bg-bg" aria-label="Back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {/* Account menu (Profile/Switch Account/Logout) moved to the
            Sidebar's bottom section - see Sidebar.tsx's SidebarUserMenu.
            The notification banner that used to live here moved to
            AppShell.tsx as an inset card - see NotificationBanner.tsx. */}
        <div className="flex items-center gap-4">
          <IconSearch className="text-gray-500" />
          <IconBell className="text-gray-500" />
          <IconCalendar className="text-gray-500" />
        </div>
      </div>
    </div>
  );
}
