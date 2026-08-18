import { IconBell, IconCalendar, IconSearch } from "./icons";

export function TopBar() {
  return (
    <div className="border-b border-border bg-white">
      {/* Back button hidden for now - re-add a onClick={() => navigate(-1)}
          button here if it comes back. Account menu (Profile/Switch
          Account/Logout) moved to the Sidebar's bottom section - see
          Sidebar.tsx's SidebarUserMenu. The notification banner that used
          to live here moved to AppShell.tsx as an inset card - see
          NotificationBanner.tsx. */}
      <div className="flex items-center justify-end px-6 py-3">
        <div className="flex items-center gap-4">
          <IconSearch className="text-gray-500" />
          <IconBell className="text-gray-500" />
          <IconCalendar className="text-gray-500" />
        </div>
      </div>
    </div>
  );
}
