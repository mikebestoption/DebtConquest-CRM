// Local camera / microphone / screen-share capture for a Teams room, kept
// outside React so the lobby preview and the live room share one set of
// tracks (and StrictMode's double-mounted effects can't open the camera
// twice). Components subscribe via useSyncExternalStore-style
// subscribe/getVersion - see roomRuntime.ts.

type Listener = () => void;

const CAMERA_CONSTRAINTS: MediaTrackConstraints = { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24 } };

function describeMediaError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "Camera/microphone access was blocked. Allow it in your browser's site settings to be seen and heard.";
    if (err.name === "NotFoundError") return "No camera or microphone was found. You can still join to listen and chat.";
    if (err.name === "NotReadableError") return "Your camera or microphone is being used by another app.";
  }
  return "Couldn't access your camera or microphone.";
}

export class LocalMedia {
  audioTrack: MediaStreamTrack | null = null;
  cameraTrack: MediaStreamTrack | null = null;
  screenTrack: MediaStreamTrack | null = null;
  // Whether each is switched on - a present audio track can be muted, and a
  // camera that's turned off is stopped entirely (so its light goes out).
  micOn = false;
  camOn = false;
  error: string | null = null;
  initialized = false;
  // True once the first permission prompt has been answered (or failed).
  ready = false;

  private listeners = new Set<Listener>();
  private version = 0;
  private previewStream: MediaStream | null = null;
  private previewTrackId: string | null = null;

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

  get sharing(): boolean {
    return this.screenTrack !== null;
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
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error = "This browser can't access a camera or microphone (a secure https:// or localhost page is required).";
      this.ready = true;
      this.emit();
      return;
    }

    let stream: MediaStream | null = null;
    let lastError: unknown = null;
    for (const constraints of [
      { audio: true, video: CAMERA_CONSTRAINTS },
      { audio: true, video: false },
      { audio: false, video: CAMERA_CONSTRAINTS },
    ] satisfies MediaStreamConstraints[]) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!stream) {
      this.error = describeMediaError(lastError);
    } else {
      this.audioTrack = stream.getAudioTracks()[0] ?? null;
      this.cameraTrack = stream.getVideoTracks()[0] ?? null;
      this.micOn = this.audioTrack !== null;
      this.camOn = this.cameraTrack !== null;
      // Got audio but not video (or vice versa) - not an error, just tell them.
      if (!this.audioTrack) this.error = "No microphone found - others won't hear you.";
      else if (!this.cameraTrack) this.error = "No camera found - joining with audio only.";
    }
    this.ready = true;
    this.emit();
  }

  toggleMic(): void {
    if (!this.audioTrack) return;
    this.micOn = !this.micOn;
    this.audioTrack.enabled = this.micOn;
    this.emit();
  }

  async toggleCamera(): Promise<void> {
    if (this.camOn) {
      this.cameraTrack?.stop();
      this.cameraTrack = null;
      this.camOn = false;
      this.emit();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: CAMERA_CONSTRAINTS });
      this.cameraTrack = stream.getVideoTracks()[0] ?? null;
      this.camOn = this.cameraTrack !== null;
      this.error = null;
    } catch (err) {
      this.error = describeMediaError(err);
    }
    this.emit();
  }

  async startShare(): Promise<void> {
    if (this.screenTrack) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      this.error = "Screen sharing isn't supported in this browser.";
      this.emit();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      // The browser's own "Stop sharing" bar ends the track without going
      // through stopShare().
      track.addEventListener("ended", () => this.stopShare());
      this.screenTrack = track;
      this.error = null;
    } catch (err) {
      // Cancelling the picker is a normal action, not an error.
      if (!(err instanceof DOMException && err.name === "NotAllowedError")) this.error = "Couldn't start screen sharing.";
    }
    this.emit();
  }

  stopShare(): void {
    if (!this.screenTrack) return;
    this.screenTrack.stop();
    this.screenTrack = null;
    this.emit();
  }

  stopAll(): void {
    for (const t of [this.audioTrack, this.cameraTrack, this.screenTrack]) t?.stop();
    this.audioTrack = this.cameraTrack = this.screenTrack = null;
    this.micOn = this.camOn = false;
    this.previewStream = null;
    this.previewTrackId = null;
    this.emit();
  }
}
