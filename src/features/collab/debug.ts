// Development logging for Teams rooms: one line per signaling / ICE /
// connection event, "[teams]"-prefixed like the two always-on diagnostics in
// roomClient.ts. Off unless switched on - in a dev build, or in any build by
// running  localStorage.setItem("dc_collab_debug", "1")  in the console and
// reloading - and at console.debug level (the browser console's "Verbose"
// filter), so a production console stays quiet.
function readFlag(): boolean {
  try {
    return localStorage.getItem("dc_collab_debug") === "1";
  } catch {
    return false;
  }
}

const enabled = import.meta.env.DEV || readFlag();

export function collabLog(event: string, detail?: Record<string, unknown>): void {
  if (!enabled) return;
  if (detail) console.debug(`[teams] ${event}`, detail);
  else console.debug(`[teams] ${event}`);
}
