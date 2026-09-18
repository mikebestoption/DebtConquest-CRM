import type { ReactNode } from "react";
import { create } from "zustand";

// App-wide replacement for window.confirm / window.alert. Any code (a
// component's click handler or plain module code) can `await
// confirmAction({...})` and get back true/false; the one <ConfirmDialog />
// mounted in App.tsx renders it. Requests made while another is showing are
// queued rather than dropped.

export type ConfirmTone = "danger" | "warning" | "primary";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  // For irreversible actions: the confirm button stays disabled until the
  // user types this exact text (e.g. "DELETE").
  requireText?: string;
  // Turns the dialog into a notice: a single OK button, resolves true.
  hideCancel?: boolean;
  // Adds a text field (used by promptAction, which returns what was typed).
  input?: { label: string; placeholder?: string; required?: boolean; multiline?: boolean };
}

export interface PendingConfirmView {
  id: number;
  options: ConfirmOptions;
  resolve: (confirmed: boolean, value: string) => void;
}

interface ConfirmState {
  queue: PendingConfirmView[];
  enqueue: (options: ConfirmOptions, resolve: (confirmed: boolean, value: string) => void) => void;
  settle: (id: number, confirmed: boolean, value?: string) => void;
}

let nextId = 1;

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  queue: [],
  enqueue: (options, resolve) => set((s) => ({ queue: [...s.queue, { id: nextId++, options, resolve }] })),
  settle: (id, confirmed, value = "") => {
    const item = get().queue.find((q) => q.id === id);
    if (!item) return;
    set((s) => ({ queue: s.queue.filter((q) => q.id !== id) }));
    item.resolve(confirmed, value);
  },
}));

export async function confirmAction(options: ConfirmOptions): Promise<boolean> {
  // The dialog lives outside any element that's in full screen (e.g. a Teams
  // room's stage), where it would be invisible - leave full screen first.
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  return new Promise((resolve) => useConfirmStore.getState().enqueue(options, (confirmed) => resolve(confirmed)));
}

// Replacement for window.prompt: resolves the trimmed text, or null if cancelled.
export async function promptAction(options: Omit<ConfirmOptions, "hideCancel" | "requireText"> & { input: NonNullable<ConfirmOptions["input"]> }): Promise<string | null> {
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  return new Promise((resolve) =>
    useConfirmStore.getState().enqueue(options, (confirmed, value) => resolve(confirmed ? value.trim() : null)),
  );
}

// Same dialog with a single OK button, for "invite sent" / "upload failed"
// style messages that used to be window.alert.
export function notifyAction(options: Omit<ConfirmOptions, "hideCancel" | "cancelLabel" | "requireText">): Promise<boolean> {
  return confirmAction({ confirmLabel: "OK", ...options, hideCancel: true });
}
