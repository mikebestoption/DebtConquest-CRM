import { useSyncExternalStore } from "react";

// Subscribes to a CSS media query (e.g. "(min-width: 1024px)") so JS can
// branch on the same breakpoints Tailwind uses - needed where behaviour, not
// just styling, differs (the sidebar's collapse toggle only makes sense on
// desktop, where it's a persistent column rather than a drawer).
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// Tailwind's `lg` - below this the sidebar is an off-canvas drawer.
export const useIsDesktop = (): boolean => useMediaQuery("(min-width: 1024px)");
