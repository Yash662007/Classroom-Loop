/**
 * Localization readiness (Master Task GOAL 51).
 *
 * All new UI strings for the mobile/evidence experience flow through this
 * single table so future locales can be added without touching components.
 * Existing pages keep their inline copy — migrating them is incremental.
 */
export const STRINGS = {
  en: {
    "voice.record": "Record voice reflection",
    "voice.stop": "Stop",
    "voice.saved": "Voice saved on this device",
    "voice.retake": "Retake",
    "voice.denied": "Microphone access was blocked. You can type your reflection instead — nothing else changes.",
    "voice.error": "Recording didn't work on this device. Please type your reflection instead.",

    "photo.take": "Take photo",
    "photo.gallery": "Choose from gallery",
    "photo.retake": "Retake photo",
    "photo.compressing": "Preparing photo…",
    "photo.tooLarge": "That photo is too large even after compression. Try a closer shot.",
    "photo.unsupported": "This device can't process that photo. Try a JPEG or PNG from your gallery.",

    "quality.title": "Evidence check",
    "quality.ok": "Looks good — your reflection covers what happened and what you noticed.",
    "quality.missing.after": "Add one line about what happened after you tried it — did students respond?",
    "quality.missing.short": "A sentence or two more helps your mentor and the AI insight see the full picture.",
    "quality.missing.checklist": "Ticking the quick checklist (what you tried) makes the insight much sharper.",
    "quality.hint": "More detail means a better AI insight and better mentor feedback — but you can submit as is.",

    "support.title": "Need help?",
    "support.aria": "Ask for help with this task",
    "support.why": "Your mentor sees this right away and can step in — asking early is a strength.",
    "support.reason": "What kind of help do you need?",
    "support.message": "Anything specific? (optional)",
    "support.send": "Send request",
    "support.sent": "Request sent. Your mentor has been notified.",
    "support.error": "Couldn't send right now. Your request wasn't saved — please try again.",

    "retry.plan": "Your retry plan",
    "retry.focus": "Focus",
    "retry.try": "Try",
    "retry.start": "Start retry with this focus",

    "changed.title": "What changed?",
    "changed.disclaimer": "Based on what you reported and your mentor's note — not an objective measurement.",
  },
} as const;

export type StringKey = keyof (typeof STRINGS)["en"];

const LOCALE = "en" as const;

/** Translate a key; unknown keys fail loudly in development. */
export function t(key: StringKey): string {
  const table = STRINGS[LOCALE] as Record<string, string>;
  const value = table[key];
  if (value === undefined && process.env.NODE_ENV !== "production") {
    console.warn(`[i18n] missing string: ${key}`);
  }
  return value ?? key;
}
