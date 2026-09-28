"use client";

/**
 * Teacher support request (Master Task GOAL 31): "Need help?" opens a compact
 * picker with the five plain-language reasons; the request is stored and the
 * mentor's priority views surface it. Never blocks the evidence flow.
 */
import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { t } from "@/lib/i18n";
import { SUPPORT_REASONS, SUPPORT_REASON_LABELS, type SupportReason } from "@/lib/support-constants";

export function NeedHelpButton({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<SupportReason | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, reason, message: message.trim() || undefined }),
      });
      setSent(true);
      setOpen(false);
    } catch {
      setError(t("support.error"));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return <p className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">{t("support.sent")}</p>;
  }

  return (
    <div className="space-y-2" data-testid="need-help">
      {!open && (
        <button type="button" className="text-sm text-blue-600 underline inline-flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" onClick={() => setOpen(true)} aria-expanded={open}>
          <LifeBuoy className="w-4 h-4" aria-hidden /> {t("support.title")}
        </button>
      )}
      {open && (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 space-y-2.5" role="group" aria-label={t("support.aria")}>
          <p className="text-xs text-navy-900/60">{t("support.why")}</p>
          <fieldset className="space-y-1.5">
            <legend className="label">{t("support.reason")}</legend>
            {SUPPORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="support-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-blue-600"
                />
                {SUPPORT_REASON_LABELS[r]}
              </label>
            ))}
          </fieldset>
          <textarea
            className="input min-h-[56px] text-sm"
            placeholder={t("support.message")}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm" disabled={!reason || busy} onClick={send}>
              {busy ? "Sending…" : t("support.send")}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
