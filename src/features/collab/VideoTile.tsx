import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconMaximize, IconMicOff, IconMinimize, IconPin } from "../layout/icons";
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
  pinned?: boolean;
  // Present = show a pin button (spotlight this tile).
  onTogglePin?: () => void;
  // Extra hover buttons (host moderation).
  actions?: ReactNode;
  className?: string;
}

export function TileButton({ label, onClick, active, danger, children }: { label: string; onClick: () => void; active?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-full text-white backdrop-blur transition-colors ${
        active ? "bg-teal" : danger ? "bg-black/60 hover:bg-error" : "bg-black/60 hover:bg-black/80"
      }`}
    >
      {children}
    </button>
  );
}

export function VideoTile({ stream, name, muted, videoOn, audioOn, mirror, screen, status, pinned, onTogglePin, actions, className }: VideoTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) {
      // Autoplay with sound can be refused if the page hasn't had a click
      // yet; surface a button rather than staying silently mute.
      el.play().then(
        () => setBlocked(false),
        // Only a real autoplay refusal warrants the button - an empty stream
        // (someone we haven't connected to yet) also rejects, and isn't
        // something clicking can fix.
        (err: unknown) => setBlocked(err instanceof DOMException && err.name === "NotAllowedError"),
      );
    }
  }, [stream]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement === containerRef.current) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen().catch(() => {});
  }

  return (
    <div
      ref={containerRef}
      onDoubleClick={toggleFullscreen}
      className={`group relative overflow-hidden bg-[#123a3a] ${fullscreen ? "" : "rounded-card"} ${pinned ? "ring-2 ring-teal" : ""} ${className ?? ""}`}
    >
      {/* Kept mounted even with the camera off - it's also what plays the person's audio. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full ${screen || fullscreen ? "object-contain" : "object-cover"} ${mirror && !screen ? "-scale-x-100" : ""} ${videoOn ? "" : "invisible"}`}
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

      <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {actions}
        {onTogglePin && (
          <TileButton label={pinned ? "Unpin" : "Pin"} active={pinned} onClick={onTogglePin}>
            <IconPin width={15} height={15} />
          </TileButton>
        )}
        <TileButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
          {fullscreen ? <IconMinimize width={15} height={15} /> : <IconMaximize width={15} height={15} />}
        </TileButton>
      </div>

      <div className="absolute bottom-2 left-2 flex max-w-[90%] items-center gap-1.5 rounded bg-black/55 px-2 py-1 text-xs font-medium text-white">
        {pinned && <IconPin width={12} height={12} className="shrink-0 text-teal" />}
        {!audioOn && <IconMicOff width={12} height={12} className="shrink-0 text-red-300" />}
        <span className="truncate">{screen ? `${name} (screen)` : name}</span>
        {status && <span className="shrink-0 text-amber-300">· {status}</span>}
      </div>
    </div>
  );
}
