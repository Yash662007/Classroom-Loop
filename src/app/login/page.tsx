"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { roleHome } from "@/lib/roles";

const DEMO_ACCOUNTS = [
  { label: "Teacher A — Multi-grade (Sample)", email: "teacher.a@classroomloop.demo" },
  { label: "Teacher B — Early-career (Sample)", email: "teacher.b@classroomloop.demo" },
  { label: "Teacher C — Experienced (Sample)", email: "teacher.c@classroomloop.demo" },
  { label: "Mentor — CRC (Sample)", email: "mentor@classroomloop.demo" },
  { label: "Admin (Sample)", email: "admin@classroomloop.demo" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed. Please try again.");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") ? next : roleHome(data.user.role));
      router.refresh();
    } catch {
      setError("Network problem — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-2rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={44} height={44} />
            <div className="text-left">
              <h1 className="text-2xl font-bold text-navy-900 leading-tight">Classroom Loop</h1>
              <p className="text-xs text-navy-900/60">From teacher training to classroom practice</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Sign in</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.example"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <div className="card mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-900/50 mb-3">
            Demo accounts (sample data · password: demo1234)
          </p>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword("demo1234");
                  setError(null);
                }}
                className="w-full text-left text-sm rounded-lg border border-navy-900/10 px-3 py-2 hover:bg-softblue-100 transition-colors"
              >
                {a.label}
                <span className="block text-[11px] text-navy-900/50">{a.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
