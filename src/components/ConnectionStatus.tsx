"use client";

import { useSync } from "@/components/SyncProvider";

/**
 * Connection status chip (spec §26): answers "is my work safe?" in plain
 * language — never technical jargon. Rendered in the app shell top bar.
 */
export function ConnectionStatus() {
  const { state, pendingCount } = useSync();

  const config =
    state === "offline"
      ? { label: pendingCount > 0 ? `Saved offline (${pendingCount})` : "Saved offline", dot: "bg-slate-400", title: "You're offline. Anything you save is stored on this device." }
      : state === "syncing"
        ? { label: "Syncing…", dot: "bg-warning animate-pulse", title: "Sending your saved submissions to the server." }
        : state === "error"
          ? { label: pendingCount > 0 ? `Saved on device (${pendingCount})` : "Saved on device", dot: "bg-danger", title: "A sync problem occurred — your work stays saved and will retry." }
          : state === "pending"
            ? { label: `Will sync (${pendingCount})`, dot: "bg-warning", title: "Saved on this device; will sync automatically." }
            : null;

  if (!config) return null; // online + nothing pending: stay quiet (visible, not annoying)

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-navy-800"
      role="status"
      title={config.title}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
