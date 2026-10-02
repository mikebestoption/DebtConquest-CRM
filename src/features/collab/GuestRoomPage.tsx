import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import sidebarLogo from "../../assets/sidebarLogo.svg";
import { RoomVisit } from "./RoomPage";
import { guestAccess, readGuestIdentity } from "./roomRuntime";

// The room, for someone outside the CRM: opened from a session's guest link
// (/meet/:token) with no sign-in. It's the same lobby and live room staff get
// (RoomVisit) on a guest's RoomAccess - they type a name to join, and can't
// moderate, record, or reach anything else in the CRM. This page sits
// outside RequireAuth and the app shell on purpose.
export function GuestRoomPage() {
  const { token } = useParams<{ token: string }>();
  // Keyed so opening a different link in the same tab starts from scratch.
  return token ? <GuestRoom key={token} guestToken={token} /> : null;
}

function GuestRoom({ guestToken }: { guestToken: string }) {
  // Prefilled for someone coming back to the same link.
  const [name, setName] = useState(() => readGuestIdentity(guestToken).name ?? "");
  // Joining reads the name long after the render that built the access.
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);
  // "Rejoin" starts a new visit by remounting.
  const [visit, setVisit] = useState(0);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-white px-4 py-3 sm:px-6">
        <img src={sidebarLogo} alt="DebtConquest" className="h-7 w-auto" />
        <span className="text-sm font-medium text-muted">Meeting</span>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
        <RoomVisit
          key={visit}
          makeAccess={() => guestAccess(guestToken, () => nameRef.current)}
          autoJoin={visit > 0}
          onRejoin={() => setVisit((v) => v + 1)}
          guestName={{ value: name, onChange: setName }}
          heightClass="h-[calc(100dvh-7.5rem)]"
        />
      </main>
    </div>
  );
}
