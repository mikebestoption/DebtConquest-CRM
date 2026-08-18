import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { NotificationBanner } from "./NotificationBanner";

export function AppShell() {
  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-10 py-7">
          <NotificationBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
