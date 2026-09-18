import { useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent, type SVGProps } from "react";
import { useConfirmStore, type ConfirmTone, type PendingConfirmView } from "../state/confirmStore";
import { IconAlertTriangle, IconInfo } from "../features/layout/icons";

// Renders whatever confirmAction()/notifyAction() (state/confirmStore.ts)
// has queued. Mounted once in App.tsx.

const TONES: Record<ConfirmTone, { icon: ComponentType<SVGProps<SVGSVGElement>>; iconWrap: string; button: string }> = {
  danger: { icon: IconAlertTriangle, iconWrap: "bg-red-50 text-error", button: "bg-error text-white hover:opacity-90" },
  warning: { icon: IconAlertTriangle, iconWrap: "bg-amber-50 text-amber-600", button: "bg-amber-500 text-white hover:bg-amber-600" },
  primary: { icon: IconInfo, iconWrap: "bg-bg text-teal", button: "bg-teal text-white hover:bg-teal-hover" },
};

export function ConfirmDialog() {
  const current = useConfirmStore((s) => s.queue[0]);
  // Keyed by request id so queued dialogs each get fresh state (typed text, focus).
  return current ? <ConfirmCard key={current.id} item={current} /> : null;
}

function ConfirmCard({ item }: { item: PendingConfirmView }) {
  const settle = useConfirmStore((s) => s.settle);
  const { options } = item;
  const tone = TONES[options.tone ?? "primary"];
  const Icon = tone.icon;
  const titleId = useId();
  const messageId = useId();
  const [typed, setTyped] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const wantsInput = !!options.requireText || !!options.input;
  const canConfirm = options.requireText ? typed === options.requireText : options.input?.required ? typed.trim() !== "" : true;
  const isDestructive = (options.tone ?? "primary") === "danger";

  // Focus the safe choice first: for destructive actions that's Cancel, so a
  // stray Enter/Space can't delete something. Focus goes back to whatever
  // opened the dialog when it closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const target = inputRef.current ?? (isDestructive && !options.hideCancel ? cancelRef.current : confirmRef.current);
    target?.focus();
    return () => previouslyFocused?.focus?.();
  }, [isDestructive, options.hideCancel]);

  function cancel() {
    settle(item.id, false);
  }
  function confirm() {
    if (canConfirm) settle(item.id, true, typed);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      // A notice can only be acknowledged; dismissing it still counts as OK.
      if (options.hideCancel) confirm();
      else cancel();
      return;
    }
    if (e.key === "Enter" && e.target === inputRef.current && !options.input?.multiline) {
      e.preventDefault();
      confirm();
      return;
    }
    if (e.key === "Tab") {
      // Keep keyboard focus inside the dialog.
      const focusable = cardRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div
      className="confirm-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !options.hideCancel) cancel();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={cardRef}
        role={options.hideCancel ? "dialog" : "alertdialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={options.message ? messageId : undefined}
        className="confirm-card w-full max-w-md rounded-card bg-white p-6 shadow-card"
      >
        <div className="flex gap-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.iconWrap}`}>
            <Icon width={20} height={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {options.title}
            </h2>
            {options.message && (
              <div id={messageId} className="mt-1.5 whitespace-pre-line text-sm text-muted">
                {options.message}
              </div>
            )}
            {wantsInput && (
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-muted">
                  {options.requireText ? (
                    <>
                      Type <span className="font-mono font-bold text-ink">{options.requireText}</span> to confirm
                    </>
                  ) : (
                    options.input?.label
                  )}
                </label>
                {options.input?.multiline ? (
                  <textarea
                    ref={inputRef}
                    rows={3}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={options.input.placeholder}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-ring"
                  />
                ) : (
                  <input
                    ref={inputRef}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={options.input?.placeholder}
                    autoComplete="off"
                    spellCheck={!options.requireText}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-ring"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {!options.hideCancel && (
            <button
              ref={cancelRef}
              onClick={cancel}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-bg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {options.cancelLabel ?? "Cancel"}
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={confirm}
            disabled={!canConfirm}
            className={`rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${tone.button}`}
          >
            {options.confirmLabel ?? (options.hideCancel ? "OK" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
