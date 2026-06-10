/**
 * Multi-tab safety via BroadcastChannel.
 *
 * Whenever data is modified in one tab, that tab calls broadcastDataChanged().
 * Other open tabs subscribe via subscribeDataChanges() and refresh their views
 * (Dexie liveQueries already auto-refresh in the same tab; cross-tab needs a
 * nudge because IndexedDB events don't propagate liveQueries cross-tab).
 */

const CHANNEL_NAME = "wbt:data";

type DataEvent = {
  kind: "data-changed";
  /** Which tab fired the event (random per page load) */
  origin: string;
  at: number;
};

const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as Crypto).randomUUID()
    : Math.random().toString(36).slice(2);

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
  }
  return channel;
}

/** Notify other tabs that local data has changed. Safe to call frequently. */
export function broadcastDataChanged(): void {
  const ch = getChannel();
  if (!ch) return;
  const msg: DataEvent = { kind: "data-changed", origin: TAB_ID, at: Date.now() };
  try {
    ch.postMessage(msg);
  } catch {
    // ignore; the page may be closing
  }
}

/**
 * Subscribe to cross-tab data changes. The handler is only invoked for events
 * from OTHER tabs (not echoes of our own broadcast). Returns an unsubscribe fn.
 */
export function subscribeDataChanges(handler: (e: DataEvent) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const onMsg = (ev: MessageEvent<DataEvent>) => {
    const data = ev.data;
    if (!data || data.kind !== "data-changed") return;
    if (data.origin === TAB_ID) return;
    handler(data);
  };
  ch.addEventListener("message", onMsg);
  return () => ch.removeEventListener("message", onMsg);
}
