import { useState } from "react";
import { IconX } from "./icons";

// Moved out of TopBar's full-bleed header strip into its own inset card
// living at the top of the page content - same rounded/shadowed treatment
// as every other card on the page, instead of a banner stretching edge to
// edge under the header.
export function NotificationBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-card border border-sky-100 bg-sky-50 px-5 py-3 text-sm text-sky-900 shadow-card">
      <span>
        Click on the following link to receive notifications on this device{" "}
        <button className="font-medium text-teal hover:underline" onClick={() => setDismissed(true)}>
          Allow
        </button>
      </span>
      <button aria-label="Dismiss" onClick={() => setDismissed(true)} className="shrink-0 text-sky-700 hover:text-sky-900">
        <IconX width={16} height={16} />
      </button>
    </div>
  );
}
