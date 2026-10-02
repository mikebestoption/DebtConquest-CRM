// Local camera / microphone / screen-share capture for a Teams room, kept
// outside React so the lobby preview and the live room share one set of
// tracks (and StrictMode's double-mounted effects can't open the camera
// twice). Components subscribe via useSyncExternalStore-style
// subscribe/getVersion - see roomRuntime.ts.

type Listener = () => void;
type Device = "camera" | "microphone";

const CAMERA_CONSTRAINTS: MediaTrackConstraints = { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24 } };

// Why a device isn't available, in words someone can act on.
function describeDeviceError(err: unknown, device: Device): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return `Your ${device} is blocked for this site. Allow it from the icon in the address bar (or your browser's site settings), then choose Try again.`;
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return `No ${device} was found. Plug one in and choose Try again - you can still join without it.`;
  if (name === "NotReadableError" || name === "AbortError") return `Your ${device} is being used by another app, or couldn't be started. Close the other app and choose Try again.`;
  return `Couldn't access your ${device}.`;
}

// Whether the browser already has this device set to "blocked" for the site
// (so asking again can't prompt). Unknown counts as not blocked - not every
// browser answers this.
async function isBlocked(device: Device): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: device as PermissionName });
    return status.state === "denied";
  } catch {
    return false;
  }
}

export class LocalMedia {
  audioTrack: MediaStreamTrack | null = null;
  cameraTrack: MediaStreamTrack | null = null;
  screenTrack: MediaStreamTrack | null = null;
  // Whether each is switched on - a present audio track can be muted, and a
  // camera that's turned off is stopped entirely (so its light goes out).
  micOn = false;
  camOn = false;
  // What's wrong with each device right now, if anything (null = fine, or
  // deliberately off). `error` is the one line the room shows.
  micError: string | null = null;
  camError: string | null = null;
  shareError: string | null = null;
  initialized = false;
  // True once the first permission prompt has been answered (or failed).
  ready = false;
  // A device request is in flight (the Try again button).
  busy = false;

  private listeners = new Set<Listener>();
  private version = 0;
  private previewStream: MediaStream | null = null;
  private previewTrackId: string | null = null;
  private stopped = false;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = (): number => this.version;

  private emit(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  get error(): string | null {
    return this.shareError ?? this.micError ?? this.camError;
  }

  // Something Try again could fix: a device we wanted and didn't get.
  get needsRetry(): boolean {
    return this.micError !== null || this.camError !== null;
  }

  get sharing(): boolean {
    return this.screenTrack !== null;
  }

  // Phones and some embedded browsers have no screen capture at all.
  get shareSupported(): boolean {
    return typeof navigator.mediaDevices?.getDisplayMedia === "function";
  }

  // What peers should see: the shared screen if there is one, else the camera.
  get outgoingVideo(): MediaStreamTrack | null {
    return this.screenTrack ?? this.cameraTrack;
  }

  // A MediaStream holding only the outgoing video, for the local tile. The
  // same instance is returned until the outgoing track changes, so <video>
  // elements don't get their srcObject reassigned on every render.
  getPreviewStream(): MediaStream | null {
    const track = this.outgoingVideo;
    if (!track) {
      this.previewStream = null;
      this.previewTrackId = null;
      return null;
    }
    if (this.previewTrackId !== track.id) {
      this.previewStream = new MediaStream([track]);
      this.previewTrackId = track.id;
    }
    return this.previewStream;
  }

  // Idempotent - safe to call from an effect that StrictMode runs twice.
  // Resolves once the devices have been sorted out (granted, refused or
  // absent).
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.micError = "This browser can't access a camera or microphone (a secure https:// or localhost page is required).";
      this.ready = true;
      this.emit();
      return;
    }
    await this.acquire({ audio: true, video: true });
    this.ready = true;
    this.emit();
  }

  // Asks for whichever of the two is wanted. One prompt for both when
  // possible; if that fails, each on its own, so a missing or blocked camera
  // doesn't cost the microphone as well (and each gets its own explanation).
  private async acquire(want: { audio: boolean; video: boolean }): Promise<void> {
    let stream: MediaStream | null = null;
    let refused: unknown = null;
    if (want.audio && want.video) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: CAMERA_CONSTRAINTS });
      } catch (err) {
        refused = err; // fall through to asking for them separately
      }
    }
    if (stream) {
      this.adoptAudio(stream.getAudioTracks()[0] ?? null);
      this.adoptCamera(stream.getVideoTracks()[0] ?? null);
      return;
    }
    if (want.audio) {
      // Already known to be blocked: say so rather than prompt a second time.
      if (refused && (await isBlocked("microphone"))) this.micError = describeDeviceError(refused, "microphone");
      else {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.adoptAudio(s.getAudioTracks()[0] ?? null);
        } catch (err) {
          this.micError = describeDeviceError(err, "microphone");
        }
      }
    }
    if (want.video) {
      if (refused && (await isBlocked("camera"))) this.camError = describeDeviceError(refused, "camera");
      else {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: CAMERA_CONSTRAINTS });
          this.adoptCamera(s.getVideoTracks()[0] ?? null);
        } catch (err) {
          this.camError = describeDeviceError(err, "camera");
        }
      }
    }
  }

  private adoptAudio(track: MediaStreamTrack | null): void {
    if (this.stopped) {
      track?.stop();
      return;
    }
    this.audioTrack = track;
    this.micOn = track !== null;
    this.micError = track ? null : "No microphone was found - others won't hear you.";
    // The device was unplugged, or the system took it away.
    track?.addEventListener("ended", () => {
      if (this.audioTrack !== track) return;
      this.audioTrack = null;
      this.micOn = false;
      this.micError = "Your microphone stopped working - it may have been unplugged or taken over by another app. Choose Try again to reconnect it.";
      this.emit();
    });
  }

  private adoptCamera(track: MediaStreamTrack | null): void {
    if (this.stopped) {
      track?.stop();
      return;
    }
    this.cameraTrack = track;
    this.camOn = track !== null;
    this.camError = track ? null : "No camera was found - joining with audio only.";
    track?.addEventListener("ended", () => {
      if (this.cameraTrack !== track) return;
      this.cameraTrack = null;
      this.camOn = false;
      this.camError = "Your camera stopped working - it may have been unplugged or taken over by another app. Choose Try again to turn it back on.";
      this.emit();
    });
  }

  // "Try again": re-requests whichever device we don't have - after the
  // person has allowed it in the browser, plugged it in, or closed the app
  // that was holding it. No page reload needed.
  async retry(): Promise<void> {
    if (this.busy || !navigator.mediaDevices?.getUserMedia) return;
    this.busy = true;
    this.emit();
    await this.acquire({ audio: this.audioTrack === null, video: this.cameraTrack === null });
    this.busy = false;
    this.emit();
  }

  async toggleMic(): Promise<void> {
    if (!this.audioTrack) {
      // No microphone yet (blocked or missing at first) - this is the
      // button people reach for, so make it ask again.
      if (this.busy || !navigator.mediaDevices?.getUserMedia) return;
      this.busy = true;
      this.emit();
      await this.acquire({ audio: true, video: false });
      this.busy = false;
      this.emit();
      return;
    }
    this.micOn = !this.micOn;
    this.audioTrack.enabled = this.micOn;
    this.emit();
  }

  // Used when the host mutes us - never the other way round; only the person
  // themselves can switch a microphone back on.
  muteMic(): void {
    if (!this.audioTrack || !this.micOn) return;
    this.micOn = false;
    this.audioTrack.enabled = false;
    this.emit();
  }

  async toggleCamera(): Promise<void> {
    if (this.camOn) {
      const track = this.cameraTrack;
      this.cameraTrack = null;
      this.camOn = false;
      this.camError = null;
      track?.stop();
      this.emit();
      return;
    }
    if (this.busy || !navigator.mediaDevices?.getUserMedia) return;
    this.busy = true;
    this.emit();
    await this.acquire({ audio: false, video: true });
    this.busy = false;
    this.emit();
  }

  async startShare(): Promise<void> {
    if (this.screenTrack) return;
    if (!this.shareSupported) {
      this.shareError = "Screen sharing isn't available in this browser. On a phone or tablet, join from a computer to share your screen.";
      this.emit();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      if (!track || this.stopped) {
        track?.stop();
        return;
      }
      // Text and UI should stay sharp rather than smooth.
      track.contentHint = "detail";
      // The browser's own "Stop sharing" bar ends the track without going
      // through stopShare().
      track.addEventListener("ended", () => {
        if (this.screenTrack === track) this.stopShare();
      });
      this.screenTrack = track;
      this.shareError = null;
    } catch (err) {
      // Cancelling the picker is a normal action, not an error.
      this.shareError = err instanceof DOMException && err.name === "NotAllowedError" ? null : "Couldn't start screen sharing. Check that your browser is allowed to record the screen, then try again.";
    }
    this.emit();
  }

  stopShare(): void {
    if (!this.screenTrack) return;
    const track = this.screenTrack;
    this.screenTrack = null;
    track.stop();
    this.emit();
  }

  stopAll(): void {
    this.stopped = true;
    const tracks = [this.audioTrack, this.cameraTrack, this.screenTrack];
    this.audioTrack = this.cameraTrack = this.screenTrack = null;
    for (const t of tracks) t?.stop();
    this.micOn = this.camOn = false;
    this.previewStream = null;
    this.previewTrackId = null;
    this.emit();
  }
}
