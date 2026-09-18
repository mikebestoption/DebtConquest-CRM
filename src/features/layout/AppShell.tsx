import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { NotificationBanner } from "./NotificationBanner";

export function AppShell() {
  // Only meaningful below `lg`, where the sidebar is a slide-in drawer.
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  // Navigating (tapping a menu link) should close the drawer.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    // h-dvh, not h-screen: on phones 100vh is taller than the visible area
    // (the URL bar), which pushes the bottom of the page off-screen.
    <div className="flex h-dvh bg-bg">
      <Sidebar mobileOpen={navOpen} onMobileClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setNavOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-14 lg:py-7">
          <NotificationBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
