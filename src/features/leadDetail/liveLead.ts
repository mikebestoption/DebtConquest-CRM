import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { fetchLeadRevisions, type LeadRevisions } from "../../api/leadSync";

// The CRM's side of the live two-way sync with the customer's app.
//
// An open lead used to be a snapshot: whatever the customer changed in their
// app (or a colleague changed in another window) stayed invisible until the
// page was reloaded, and saving a form wrote the whole snapshot back -
// including fields the customer had changed since. Now:
//
//   - the lead page asks the server every few seconds whether anything
//     about the lead changed (useLeadRevisions) and hands the answer to its
//     tabs (LiveLeadProvider);
//   - each tab reloads its own data when its part changed (useLiveReload);
//   - a form being edited keeps what the agent typed and takes everything
//     else (mergeDraft), and saves only what the agent changed (changedKeys).
//
// There's no socket to be told over, so - like the Teams rooms - this
// polls; see server/src/services/leadSync.service.ts for what makes the
// question cheap.

const POLL_INTERVAL_MS = 4000;
const MAX_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;

function deadline(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// The lead's current revisions, refreshed every few seconds while the page
// is being looked at (and at once on coming back to it, or back online).
// Null until the first answer. Backs off while the server can't be reached.
export function useLeadRevisions(leadId: string | undefined): LeadRevisions | null {
  const [rev, setRev] = useState<LeadRevisions | null>(null);

  useEffect(() => {
    setRev(null);
    if (!leadId) return;
    let stopped = false;
    let running = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(tick, Math.min(MAX_INTERVAL_MS, POLL_INTERVAL_MS * 2 ** failures));
    };

    const tick = async () => {
      if (stopped || running) return;
      if (document.visibilityState !== "visible") return schedule();
      running = true;
      try {
        const res = await fetchLeadRevisions(leadId, deadline(REQUEST_TIMEOUT_MS));
        failures = 0;
        // Same answer as before keeps the same object, so nothing re-renders.
        if (!stopped) setRev((prev) => (prev && sameRevisions(prev, res.rev) ? prev : res.rev));
      } catch (err) {
        // A server that predates the sync has no such route: stop asking
        // (schedule() checks this). A lead that's gone is different - that
        // answer carries the API's own message.
        if (err instanceof ApiError && err.status === 404 && err.message.startsWith("Route ")) stopped = true;
        failures = Math.min(failures + 1, 3);
      } finally {
        running = false;
        schedule();
      }
    };

    const wake = () => {
      if (document.visibilityState !== "visible") return;
      failures = 0;
      void tick();
    };

    void tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [leadId]);

  return rev;
}

function sameRevisions(a: LeadRevisions, b: LeadRevisions): boolean {
  return (Object.keys(b) as (keyof LeadRevisions)[]).every((key) => a[key] === b[key]);
}

const LiveLeadContext = createContext<LeadRevisions | null>(null);

// <LiveLeadProvider value={rev}> around the lead's tabs.
export const LiveLeadProvider = LiveLeadContext.Provider;

// The lead's revisions as last heard from the server - for a view that knows
// the revision of what it's showing and compares the two itself.
export function useLiveLead(): LeadRevisions | null {
  return useContext(LiveLeadContext);
}

// Calls `reload` whenever one of the given kinds of lead data has changed on
// the server since this component last loaded it. `paused` holds that back
// (say while a dialog is open) until it clears.
//
// "Since it last loaded" starts as whatever was known when the component
// mounted, which is when it loads its data. If nothing was known yet, the
// first answer triggers one reload - a spare request, never a missed change.
export function useLiveReload(sections: readonly (keyof LeadRevisions)[], reload: () => void, paused = false, revOverride?: LeadRevisions | null): void {
  const fromContext = useContext(LiveLeadContext);
  const rev = revOverride === undefined ? fromContext : revOverride;
  const key = rev ? sections.map((section) => rev[section]).join("|") : null;
  const loadedKey = useRef(key);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (key === null || paused || key === loadedKey.current) return;
    loadedKey.current = key;
    reloadRef.current();
  }, [key, paused]);
}

// Answers can arrive out of order: a reload that started before a save can
// come back after it, carrying the data as it was before. A component takes
// a ticket when it starts loading, and asks `isCurrent` before using the
// answer: no, if a load started later has already been used, or a save
// (`invalidate`, called as the save starts and again when it ends) has
// happened since this one started. An answer is only ever dropped in favour
// of a newer one that arrived - never for one that may yet fail.
export function useLatest() {
  const state = useRef({ issued: 0, floor: 0 });
  return useMemo(
    () => ({
      begin: () => ++state.current.issued,
      isCurrent: (ticket: number) => {
        if (ticket <= state.current.floor) return false;
        state.current.floor = ticket;
        return true;
      },
      invalidate: () => {
        state.current.floor = ++state.current.issued;
      },
    }),
    [],
  );
}

// ---------- forms that stay open while the data changes under them ----------

type Same = (a: unknown, b: unknown) => boolean;

// Empty is empty, however it's spelled.
export const sameText: Same = (a, b) => (a ?? "") === (b ?? "");
// For amounts: an empty field and 0 are the same.
export const sameAmount: Same = (a, b) => (Number(a) || 0) === (Number(b) || 0);

function keysOf<T extends object>(...objects: T[]): (keyof T)[] {
  return [...new Set(objects.flatMap((o) => Object.keys(o)))] as (keyof T)[];
}

// Brings a form's draft up to date with fresh data from the server: every
// field the agent hasn't touched (it still holds what was loaded before)
// takes the new value; a field they have changed keeps what they typed.
export function mergeDraft<T extends object>(draft: T, loaded: T, fresh: T, same: Same = sameText): T {
  let next = draft;
  for (const key of keysOf(draft, loaded, fresh)) {
    if (!same(draft[key], loaded[key]) || same(draft[key], fresh[key])) continue;
    if (next === draft) next = { ...draft };
    next[key] = fresh[key];
  }
  return next;
}

// The fields of a draft the agent changed - the only ones to save, so a
// save can't write back the old value of something the customer changed
// meanwhile.
export function changedKeys<T extends object>(draft: T, loaded: T, same: Same = sameText): (keyof T)[] {
  return keysOf(draft, loaded).filter((key) => !same(draft[key], loaded[key]));
}

export function pick<T extends object>(source: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const key of keys) out[key] = source[key];
  return out;
}
