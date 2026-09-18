// Records a Teams room in the browser. There's no media server, so the
// recording is built client-side: every participant's video is drawn into a
// canvas grid and every participant's audio is mixed through WebAudio, then
// the combined stream goes through MediaRecorder. The result is uploaded by
// roomRuntime.ts once recording stops.

export interface RecorderTile {
  id: string;
  label: string;
  stream: MediaStream;
  // A shared screen gets the big slot; everyone else shrinks to thumbnails.
  screen?: boolean;
  // Whether this person's camera is actually on (else show a name card).
  videoOn: boolean;
}

export type RecordingMode = "video" | "audio";

export interface RecordingResult {
  blob: Blob;
  durationSeconds: number;
}

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 12;
// Server rejects anything over 300MB (collab.route.ts) - stop a little
// short of that so the final chunk still fits.
const MAX_BYTES = 285 * 1024 * 1024;

const VIDEO_MIME_CANDIDATES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
const AUDIO_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType(candidates: string[]): string | undefined {
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

export function recordingSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && typeof AudioContext !== "undefined";
}

interface TileVideo {
  tile: RecorderTile;
  video: HTMLVideoElement;
}

export class RoomRecorder {
  private mode: RecordingMode;
  private onLimit: () => void;
  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private audioCtx: AudioContext;
  private audioDest: MediaStreamAudioDestinationNode;
  private audioSources = new Map<string, MediaStreamAudioSourceNode>();
  private holder: HTMLDivElement | null = null;
  private tiles = new Map<string, TileVideo>();
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private bytes = 0;
  private startedAt = 0;
  private drawTimer: number | null = null;
  private limitFired = false;

  constructor(mode: RecordingMode, onLimit: () => void) {
    this.mode = mode;
    this.onLimit = onLimit;
    this.audioCtx = new AudioContext();
    this.audioDest = this.audioCtx.createMediaStreamDestination();
  }

  get isRecording(): boolean {
    return this.recorder?.state === "recording";
  }

  get elapsedSeconds(): number {
    return this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
  }

  start(tiles: RecorderTile[]): void {
    const mimeType = pickMimeType(this.mode === "video" ? VIDEO_MIME_CANDIDATES : AUDIO_MIME_CANDIDATES);
    if (!mimeType) throw new Error("This browser can't record in a supported format.");

    // A context created without a gesture starts suspended; starting a
    // recording is always a click, so resuming here is allowed.
    void this.audioCtx.resume();

    const outStream = new MediaStream(this.audioDest.stream.getAudioTracks());
    if (this.mode === "video") {
      this.canvas = document.createElement("canvas");
      this.canvas.width = WIDTH;
      this.canvas.height = HEIGHT;
      this.ctx2d = this.canvas.getContext("2d");
      // Detached <video> elements can be throttled or not decoded at all, so
      // they live in an off-screen holder in the document.
      this.holder = document.createElement("div");
      this.holder.style.cssText = "position:fixed;left:-10000px;top:0;width:2px;height:2px;overflow:hidden;pointer-events:none;";
      document.body.appendChild(this.holder);
      for (const t of this.canvas.captureStream(FPS).getVideoTracks()) outStream.addTrack(t);
    }

    this.setTiles(tiles);

    const recorder = new MediaRecorder(outStream, {
      mimeType,
      videoBitsPerSecond: this.mode === "video" ? 800_000 : undefined,
      audioBitsPerSecond: 64_000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      this.chunks.push(e.data);
      this.bytes += e.data.size;
      if (this.bytes >= MAX_BYTES && !this.limitFired) {
        this.limitFired = true;
        this.onLimit();
      }
    };
    this.recorder = recorder;
    this.startedAt = Date.now();
    recorder.start(1000);

    if (this.mode === "video") {
      this.draw();
      // setInterval, not requestAnimationFrame: rAF stops entirely in a
      // background tab, which would freeze the video. (Browsers still slow
      // intervals down there, so frames get sparse - the UI tells people to
      // keep the tab in front.)
      this.drawTimer = window.setInterval(() => this.draw(), 1000 / FPS);
    }
  }

  // Called whenever people join/leave or toggle their camera - keeps the
  // video grid and the mixed audio in step with the room.
  setTiles(tiles: RecorderTile[]): void {
    const ids = new Set(tiles.map((t) => t.id));

    for (const [id, entry] of this.tiles) {
      if (!ids.has(id)) {
        entry.video.srcObject = null;
        entry.video.remove();
        this.tiles.delete(id);
      }
    }

    const liveAudioTrackIds = new Set<string>();
    for (const tile of tiles) {
      const existing = this.tiles.get(tile.id);
      if (existing) {
        existing.tile = tile;
        if (existing.video.srcObject !== tile.stream) existing.video.srcObject = tile.stream;
      } else if (this.mode === "video" && this.holder) {
        const video = document.createElement("video");
        video.muted = true; // audio goes through the WebAudio mix, not the element
        video.playsInline = true;
        video.autoplay = true;
        video.srcObject = tile.stream;
        this.holder.appendChild(video);
        void video.play().catch(() => {});
        this.tiles.set(tile.id, { tile, video });
      }

      for (const track of tile.stream.getAudioTracks()) {
        liveAudioTrackIds.add(track.id);
        if (!this.audioSources.has(track.id)) {
          const source = this.audioCtx.createMediaStreamSource(new MediaStream([track]));
          source.connect(this.audioDest);
          this.audioSources.set(track.id, source);
        }
      }
    }

    for (const [trackId, source] of this.audioSources) {
      if (!liveAudioTrackIds.has(trackId)) {
        source.disconnect();
        this.audioSources.delete(trackId);
      }
    }
  }

  private draw(): void {
    const ctx = this.ctx2d;
    if (!ctx) return;
    ctx.fillStyle = "#0b1f1f";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const entries = [...this.tiles.values()];
    if (entries.length === 0) return;
    const presenter = entries.find((e) => e.tile.screen);

    if (presenter) {
      const others = entries.filter((e) => e !== presenter);
      const stripH = others.length ? 150 : 0;
      this.drawTile(ctx, presenter, 0, 0, WIDTH, HEIGHT - stripH);
      const thumbW = others.length ? Math.min(220, WIDTH / others.length) : 0;
      others.forEach((e, i) => this.drawTile(ctx, e, i * thumbW, HEIGHT - stripH, thumbW, stripH));
      return;
    }

    const cols = Math.ceil(Math.sqrt(entries.length));
    const rows = Math.ceil(entries.length / cols);
    const w = WIDTH / cols;
    const h = HEIGHT / rows;
    entries.forEach((e, i) => this.drawTile(ctx, e, (i % cols) * w, Math.floor(i / cols) * h, w, h));
  }

  private drawTile(ctx: CanvasRenderingContext2D, entry: TileVideo, x: number, y: number, w: number, h: number): void {
    const { tile, video } = entry;
    const pad = 4;
    const bx = x + pad;
    const by = y + pad;
    const bw = w - pad * 2;
    const bh = h - pad * 2;

    ctx.fillStyle = "#123a3a";
    ctx.fillRect(bx, by, bw, bh);

    if (tile.videoOn && video.videoWidth > 0) {
      // object-fit: contain
      const scale = Math.min(bw / video.videoWidth, bh / video.videoHeight);
      const dw = video.videoWidth * scale;
      const dh = video.videoHeight * scale;
      ctx.drawImage(video, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 ${Math.max(14, Math.min(36, bh / 5))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tile.label, bx + bw / 2, by + bh / 2, bw - 16);
    }

    ctx.font = "600 14px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const text = tile.screen ? `${tile.label} (screen)` : tile.label;
    const tw = Math.min(ctx.measureText(text).width + 12, bw);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(bx, by + bh - 24, tw, 24);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, bx + 6, by + bh - 7, tw - 12);
  }

  stop(): Promise<RecordingResult> {
    const recorder = this.recorder;
    if (!recorder) return Promise.reject(new Error("Not recording"));
    return new Promise((resolve, reject) => {
      const finish = () => {
        const durationSeconds = this.elapsedSeconds;
        const blob = new Blob(this.chunks, { type: recorder.mimeType });
        this.cleanup();
        if (blob.size === 0) reject(new Error("Nothing was recorded"));
        else resolve({ blob, durationSeconds });
      };
      recorder.onstop = finish;
      recorder.onerror = () => {
        this.cleanup();
        reject(new Error("Recording failed"));
      };
      if (recorder.state !== "inactive") recorder.stop();
      else finish();
    });
  }

  private cleanup(): void {
    if (this.drawTimer !== null) window.clearInterval(this.drawTimer);
    this.drawTimer = null;
    for (const entry of this.tiles.values()) {
      entry.video.srcObject = null;
      entry.video.remove();
    }
    this.tiles.clear();
    this.holder?.remove();
    this.holder = null;
    for (const source of this.audioSources.values()) source.disconnect();
    this.audioSources.clear();
    for (const t of this.recorder?.stream.getTracks() ?? []) t.stop();
    void this.audioCtx.close().catch(() => {});
  }
}
