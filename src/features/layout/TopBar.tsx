import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../state/authStore";
import { IconBell, IconCalendar, IconSearch, IconUser, IconX } from "./icons";

export function TopBar() {
  const staff = useAuthStore((s) => s.staff);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const displayName = staff ? [staff.firstName, staff.lastName].filter(Boolean).join(" ") || staff.email : "";

  return (
    <div className="border-b border-border bg-white">
      <div className="flex items-center justify-between px-6 py-3">
        <button className="rounded-md p-1.5 text-gray-500 hover:bg-bg" aria-label="Back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div className="flex items-center gap-4">
          <IconSearch className="text-gray-500" />
          <IconBell className="text-gray-500" />
          <IconCalendar className="text-gray-500" />
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-bg"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-white">
                <IconUser width={14} height={14} />
              </div>
              <span className="text-sm font-medium text-ink">{displayName}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-40 rounded-md border border-border bg-white py-1 shadow-card">
                <button
                  className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-bg"
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!bannerDismissed && (
        <div className="flex items-center justify-between gap-3 bg-sky-50 px-6 py-2.5 text-sm text-sky-900">
          <span>
            Click on the following link to receive notifications on this device{" "}
            <button className="font-medium text-orange hover:underline" onClick={() => setBannerDismissed(true)}>
              Allow
            </button>
          </span>
          <button aria-label="Dismiss" onClick={() => setBannerDismissed(true)} className="text-sky-700 hover:text-sky-900">
            <IconX width={16} height={16} />
          </button>
        </div>
      )}
    </div>
  );
}
