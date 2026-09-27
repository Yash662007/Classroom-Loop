"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="text-xs px-3 py-1.5 rounded-lg border border-white/25 text-white/85 hover:bg-white/10 transition-colors disabled:opacity-50"
    >
      {busy ? "…" : "Sign out"}
    </button>
  );
}
