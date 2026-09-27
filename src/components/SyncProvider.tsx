"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { countPendingOutbox, listOutbox, recoverInterruptedSync, removeOutboxItem } from "@/lib/offline/db";
import type { OutboxItem } from "@/lib/offline/db";
import { flushOutbox } from "@/lib/offline/sync";

type SyncState = "idle" | "syncing" | "offline" | "pending" | "error";

interface SyncContextValue {
  state: SyncState;
  pendingCount: number;
  items: OutboxItem[];
  lastSyncedAt: string | null;
  lastError: string | null;
  syncNow: () => Promise<void>;
  discardItem: (key: string) => Promise<void>;
}

const SyncContext = createContext<SyncContextValue>({
  state: "idle",
  pendingCount: 0,
  items: [],
  lastSyncedAt: null,
  lastError: null,
  syncNow: async () => {},
  discardItem: async () => {},
});

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SyncState>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(async () => {
    await recoverInterruptedSync();
    const all = await listOutbox();
    setItems(all);
    setPendingCount(all.filter((i) => i.status === "queued" || i.status === "failed" || i.status === "flushing").length);
  }, []);

  const syncNow = useCallback(async () => {
    const pending = await countPendingOutbox();
    if (pending === 0) {
      await refresh();
      return;
    }
    setState("syncing");
    setLastError(null);
    const outcome = await flushOutbox();
    await refresh();
    if (outcome.offline) {
      setState("offline");
      setLastError("You're offline — submissions stay queued and will sync automatically.");
    } else if (outcome.failed > 0) {
      setState("error");
      setLastError(`${outcome.failed} submission(s) could not be synced. They stay queued.`);
    } else {
      setState("idle");
      setLastSyncedAt(new Date().toISOString());
      if (outcome.synced > 0 || outcome.duplicates > 0) {
        router.refresh();
      }
    }
  }, [refresh, router]);

  const discardItem = useCallback(
    async (key: string) => {
      await removeOutboxItem(key);
      await refresh();
    },
    [refresh]
  );

  // Initial load: recover interrupted syncs, refresh counts, attempt a flush.
  useEffect(() => {
    setOnline(navigator.onLine);
    void refresh().then(() => syncNow());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnect: flush immediately.
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const onOffline = () => {
      setOnline(false);
      setState("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [syncNow]);

  // Periodic retry while there is pending work (60s).
  useEffect(() => {
    const t = setInterval(() => {
      void (async () => {
        const pending = await countPendingOutbox();
        if (pending > 0 && navigator.onLine) void syncNow();
      })();
    }, 60_000);
    return () => clearInterval(t);
  }, [syncNow]);

  const value = useMemo(
    () => ({ state: online ? state : "offline", pendingCount, items, lastSyncedAt, lastError, syncNow, discardItem }),
    [state, online, pendingCount, items, lastSyncedAt, lastError, syncNow, discardItem]
  );

  return (
    <SyncContext.Provider value={value}>
      {children}
      <SyncBanner />
    </SyncContext.Provider>
  );
}

function SyncBanner() {
  const { state, pendingCount, lastError, lastSyncedAt, syncNow, items, discardItem } = useSync();
  const [expanded, setExpanded] = useState(false);

  if (state === "idle" && pendingCount === 0) return null;

  const label =
    state === "syncing"
      ? `Syncing ${pendingCount} submission(s)…`
      : state === "offline"
        ? pendingCount > 0
          ? `Offline — ${pendingCount} submission(s) saved on this device, will sync automatically`
          : "Offline — pages you opened stay available; nothing you save is lost"
        : state === "error"
          ? `Sync problem — ${pendingCount} submission(s) still queued`
          : `${pendingCount} submission(s) queued`;

  const tone =
    state === "error"
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : state === "offline"
        ? "bg-navy-800 text-white border-navy-950"
        : "bg-teal-50 text-teal-600 border-teal-200";

  const failedItems = items.filter((i) => i.status === "failed");

  return (
    <div className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[min(94vw,560px)] rounded-xl border shadow-card px-4 py-3 ${tone}`} role="status">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && state !== "syncing" && (
            <button type="button" onClick={() => void syncNow()} className="text-xs font-semibold underline">
              Sync now
            </button>
          )}
          {(failedItems.length > 0 || lastError) && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs underline" aria-expanded={expanded}>
              {expanded ? "Hide" : "Details"}
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="mt-2 border-t border-current/20 pt-2 space-y-2">
          {lastError && <p className="text-xs">{lastError}</p>}
          {failedItems.map((i) => (
            <div key={i.idempotencyKey} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">
                {i.taskTitle || i.taskId} — {i.lastError ?? "failed"}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <button type="button" className="underline" onClick={() => void syncNow()}>retry</button>
                <button type="button" className="underline text-red-600" onClick={() => void discardItem(i.idempotencyKey)}>
                  discard
                </button>
              </span>
            </div>
          ))}
          {lastSyncedAt && <p className="text-xs opacity-75">Last synced {new Date(lastSyncedAt).toLocaleTimeString()}</p>}
        </div>
      )}
    </div>
  );
}
