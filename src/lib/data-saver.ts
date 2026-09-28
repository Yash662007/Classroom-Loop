/**
 * Data Saver mode (production-debt item #10 — the explicit low-bandwidth
 * behavior). Detection follows the Network Information API: an explicit
 * saveData flag, or a slow effective connection type. The teacher's explicit
 * toggle (localStorage) always wins over detection; with no stored preference
 * the detected state applies.
 *
 * Pure client module — nothing here runs on the server.
 */
export const DATA_SAVER_STORAGE_KEY = "cl_data_saver";
export type DataSaverPref = "on" | "off" | null;

interface ConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
}

function connection(): ConnectionLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { connection?: ConnectionLike }).connection ?? null;
}

/** True when the browser reports saveData or a 2g-class connection. */
export function detectSlowConnection(): boolean {
  const c = connection();
  if (!c) return false;
  if (c.saveData === true) return true;
  return c.effectiveType === "2g" || c.effectiveType === "slow-2g";
}

export function getDataSaverPref(): DataSaverPref {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(DATA_SAVER_STORAGE_KEY);
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
}

export function setDataSaverPref(pref: "on" | "off"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DATA_SAVER_STORAGE_KEY, pref);
  } catch {
    // Private mode etc. — the toggle just won't persist; acceptable.
  }
}

/** The effective Data Saver state: explicit preference first, detection second. */
export function isDataSaverActive(): boolean {
  const pref = getDataSaverPref();
  if (pref === "on") return true;
  if (pref === "off") return false;
  return detectSlowConnection();
}
