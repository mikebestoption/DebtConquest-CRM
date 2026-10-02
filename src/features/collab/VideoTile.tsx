import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { IconMaximize, IconMicOff, IconMinimize, IconPin, IconPointer } from "../layout/icons";
import { initials } from "./format";
import type { RoomPointer } from "./roomClient";

// Where people are pointing on a shared screen (RoomRuntime's pointer
// store), and a way to point at it ourselves.
export interface PointerSource {
  subscribe: (listener: () => void) => () => void;
  get: () => RoomPointer[];
  send: (target: string, at: { x: number; y: number } | null) => void;
}

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
  // For a tile showing someone's shared screen: whose screen it is, and the
  // room's pointers. `canPoint` is off on our own screen (we're the one
  // being shown things).
  pointers?: PointerSource;
  pointerTarget?: string;
  canPoint?: boolean;
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
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-full text-white backdrop-blur transition-colors ${
        active ? "bg-teal" : danger ? "bg-black/60 hover:bg-error" : "bg-black/60 hover:bg-black/80"
      }`}
    >
      {children}
    </button>
  );
}

export function VideoTile({ stream, name, muted, videoOn, audioOn, mirror, screen, status, pinned, onTogglePin, actions, pointers, pointerTarget, canPoint, className }: VideoTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pointing, setPointing] = useState(false);

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

  // Pointing only makes sense while there's a shared screen to point at.
  const sharedScreen = !!screen && videoOn && pointers !== undefined && pointerTarget !== undefined;
  const pointingNow = pointing && sharedScreen && !!canPoint;
  useEffect(() => {
    if (!sharedScreen) setPointing(false);
  }, [sharedScreen]);

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
      {sharedScreen && <PointerLayer videoRef={videoRef} pointers={pointers} target={pointerTarget} pointing={pointingNow} />}
      {blocked && (
        <button
          onClick={() => void videoRef.current?.play().then(() => setBlocked(false))}
          className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white"
        >
          Click to enable audio
        </button>
      )}

      {/* Above the pointing surface (z-10) and the pointers (z-20), or the
          button that stops pointing couldn't be clicked while pointing. It
          also stays visible while pointing is on, so it's obvious how to stop -
          and always on touch screens, which have no hover to reveal it with. */}
      <div
        className={`absolute right-2 top-2 z-30 flex gap-1.5 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${pointingNow ? "opacity-100" : "opacity-0"}`}
      >
        {actions}
        {sharedScreen && canPoint && (
          <TileButton label={pointingNow ? "Stop pointing" : "Point at this screen"} active={pointingNow} onClick={() => setPointing((p) => !p)}>
            <IconPointer width={15} height={15} />
          </TileButton>
        )}
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
      {pointingNow && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-teal px-3 py-1 text-xs font-semibold text-white shadow">
          Pointing - everyone sees where your cursor is
        </div>
      )}
    </div>
  );
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Where the picture actually sits inside the <video> element. The element
// fills the tile but the picture is letterboxed inside it (object-contain),
// so positions have to be measured against the picture, not the element -
// otherwise a pointer lands in a different spot for everyone whose tile has
// a different shape.
function pictureBox(video: HTMLVideoElement): Box | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = video.clientWidth;
  const ch = video.clientHeight;
  if (!vw || !vh || !cw || !ch) return null;
  const scale = Math.min(cw / vw, ch / vh);
  const w = vw * scale;
  const h = vh * scale;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}

function sameBox(a: Box | null, b: Box | null): boolean {
  return a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);
}

const POINTER_COLORS = ["#f59e0b", "#ec4899", "#8b5cf6", "#22c55e", "#3b82f6", "#ef4444"];
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return POINTER_COLORS[hash % POINTER_COLORS.length];
}

// Draws everyone's pointer over a shared screen and, while `pointing` is
// on, sends ours. Positions travel as fractions of the picture, so they map
// onto the same spot of the screen at any tile size or resolution.
function PointerLayer({ videoRef, pointers, target, pointing }: { videoRef: RefObject<HTMLVideoElement | null>; pointers: PointerSource; target: string; pointing: boolean }) {
  const all = useSyncExternalStore(pointers.subscribe, pointers.get);
  const [box, setBox] = useState<Box | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Track the picture's place in the tile as the tile is resized and as the
  // shared screen's own resolution changes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const measure = () => setBox((prev) => {
      const next = pictureBox(video);
      return sameBox(prev, next) ? prev : next;
    });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(video);
    video.addEventListener("resize", measure);
    video.addEventListener("loadedmetadata", measure);
    return () => {
      observer.disconnect();
      video.removeEventListener("resize", measure);
      video.removeEventListener("loadedmetadata", measure);
    };
  }, [videoRef]);

  const { send } = pointers;
  useEffect(() => {
    if (!pointing) return;
    // A cursor held still sends no move events; repeat it so it doesn't
    // fade out on everyone else's screen while we're still pointing.
    const keepAlive = window.setInterval(() => {
      if (last.current) send(target, last.current);
    }, 1000);
    return () => {
      window.clearInterval(keepAlive);
      last.current = null;
      send(target, null);
    };
  }, [pointing, target, send]);

  function handleMove(e: ReactPointerEvent<HTMLDivElement>) {
    const video = videoRef.current;
    const picture = video ? pictureBox(video) : null;
    if (!video || !picture) return;
    const rect = video.getBoundingClientRect();
    const x = (e.clientX - rect.left - picture.x) / picture.w;
    const y = (e.clientY - rect.top - picture.y) / picture.h;
    // Over the letterbox bars there's nothing to point at.
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      if (last.current) {
        last.current = null;
        send(target, null);
      }
      return;
    }
    last.current = { x, y };
    send(target, last.current);
  }

  function handleLeave(e: ReactPointerEvent<HTMLDivElement>) {
    // A finger lifted off a touch screen "leaves" too - but there the marker
    // should stay on the spot that was touched (there's no cursor to rest
    // on it) until the next touch, or until pointing is turned off.
    if (e.pointerType !== "mouse" || !last.current) return;
    last.current = null;
    send(target, null);
  }

  const here = box ? all.filter((p) => p.target === target) : [];
  return (
    <>
      {pointing && (
        <div
          data-testid="pointer-surface"
          className="absolute inset-0 z-10 cursor-crosshair touch-none"
          onPointerMove={handleMove}
          onPointerDown={handleMove}
          onPointerLeave={handleLeave}
          onPointerCancel={handleLeave}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      )}
      {box &&
        here.map((p) => (
          <div
            key={p.from}
            data-testid="remote-pointer"
            data-from={p.from}
            className="pointer-events-none absolute left-0 top-0 z-20 transition-transform duration-75 ease-linear"
            style={{ transform: `translate(${box.x + p.x * box.w}px, ${box.y + p.y * box.h}px)` }}
          >
            <span className="absolute -left-2 -top-2 block h-4 w-4 rounded-full border-2 border-white shadow" style={{ backgroundColor: colorFor(p.from) }} />
            <span className="absolute -left-4 -top-4 block h-8 w-8 animate-ping rounded-full opacity-40" style={{ backgroundColor: colorFor(p.from) }} />
            <span className="absolute left-3 top-2 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold text-white shadow" style={{ backgroundColor: colorFor(p.from) }}>
              {p.name}
            </span>
          </div>
        ))}
    </>
  );
}
