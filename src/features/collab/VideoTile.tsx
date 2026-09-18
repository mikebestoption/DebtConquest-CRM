import { useEffect, useRef, useState } from "react";
import { IconMicOff } from "../layout/icons";
import { initials } from "./format";

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  // The local tile is muted so you don't hear yourself.
  muted?: boolean;
  videoOn: boolean;
  audioOn: boolean;
  // Mirror the local camera (not a screen share) like a mirror.
  mirror?: boolean;
  screen?: boolean;
  status?: string;
  className?: string;
}

export function VideoTile({ stream, name, muted, videoOn, audioOn, mirror, screen, status, className }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) {
      // Autoplay with sound can be refused if the page hasn't had a click
      // yet; surface a button rather than staying silently mute.
      el.play().then(
        () => setBlocked(false),
        () => setBlocked(true),
      );
    }
  }, [stream]);

  return (
    <div className={`relative overflow-hidden rounded-card bg-[#123a3a] ${className ?? ""}`}>
      {/* Kept mounted even with the camera off - it's also what plays the person's audio. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full ${screen ? "object-contain" : "object-cover"} ${mirror && !screen ? "-scale-x-100" : ""} ${videoOn ? "" : "invisible"}`}
      />
      {!videoOn && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal text-2xl font-bold text-white">{initials(name)}</div>
        </div>
      )}
      {blocked && (
        <button
          onClick={() => void videoRef.current?.play().then(() => setBlocked(false))}
          className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white"
        >
          Click to enable audio
        </button>
      )}
      <div className="absolute bottom-2 left-2 flex max-w-[90%] items-center gap-1.5 rounded bg-black/55 px-2 py-1 text-xs font-medium text-white">
        {!audioOn && <IconMicOff width={12} height={12} className="shrink-0 text-red-300" />}
        <span className="truncate">{screen ? `${name} (screen)` : name}</span>
        {status && <span className="shrink-0 text-amber-300">· {status}</span>}
      </div>
    </div>
  );
}
