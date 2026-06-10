import { useEffect, useState } from "react";
import { subscribeDataChanges } from "../utils/broadcast";

/**
 * Banner that surfaces when another tab modified the local database.
 * Dexie's liveQuery already updates lists across the same tab; this helps
 * users notice updates that originated in a sibling tab. The banner
 * auto-clears after 8 seconds; clicking the close button hides it.
 */
export default function MultiTabBanner() {
  const [show, setShow] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = subscribeDataChanges(() => {
      setShow(true);
      setCount((c) => c + 1);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShow(false), 8000);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!show) return null;
  return (
    <div className="bg-sky-50 border-b border-sky-200 text-sky-900 text-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div>
          Updated from another tab{count > 1 ? ` (${count} updates)` : ""}. Lists on
          this page have already refreshed.
        </div>
        <button
          type="button"
          className="text-sky-800 hover:text-sky-950 underline"
          onClick={() => setShow(false)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
