"use client";

/**
 * Teacher settings (the "More" surface): today only the Data Saver toggle —
 * one honest setting, persisted on this device.
 */
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { detectSlowConnection, getDataSaverPref, setDataSaverPref } from "@/lib/data-saver";

export default function SettingsPage() {
  const [on, setOn] = useState(false);
  const [explicit, setExplicit] = useState(false);
  const [detected, setDetected] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const slow = detectSlowConnection();
    const pref = getDataSaverPref();
    setDetected(slow);
    setExplicit(pref !== null);
    setOn(pref === "on" ? true : pref === "off" ? false : slow);
    setHydrated(true);
  }, []);

  function toggle(next: boolean) {
    setOn(next);
    setExplicit(true);
    setDataSaverPref(next ? "on" : "off");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Preferences stored on this device." />

      <div className="card">
        <h2 className="label">Data Saver</h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => toggle(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#0F766E]"
          />
          <span>
            <span className="block text-sm font-medium text-navy-900">
              Use less data — hold photos on this device until I choose “Upload now”
            </span>
            <span className="block text-xs text-navy-900/60 mt-1">
              When on, photos you take are kept locally and only attach to evidence when you tap “Upload now”. Voice
              notes, video and text are unaffected. Nothing uploads in the background.
            </span>
          </span>
        </label>
        {hydrated && !explicit && (
          <p className="text-xs text-navy-900/50 mt-3" role="status">
            Currently following your network: this connection{" "}
            {detected ? "looks slow, so Data Saver is on" : "looks fine, so Data Saver is off"}. Toggle above to choose
            explicitly.
          </p>
        )}
      </div>
    </div>
  );
}
