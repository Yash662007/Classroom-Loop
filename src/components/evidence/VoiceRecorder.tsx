"use client";

/**
 * Voice-first evidence recorder (Master Task GOAL 16).
 *
 * Tap → record → timer → stop → playback → retry → save.
 * - Uses MediaRecorder (webm/opus on Android+Chrome, mp4 on iOS Safari).
 * - On microphone denial the UI explains and points back to typed reflection —
 *   the evidence flow never blocks on one input method (GOAL 25).
 * - Audio is handed to the parent as a base64 data URL; nothing is uploaded
 *   until the teacher submits evidence, and offline queueing works unchanged.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, RefreshCw } from "lucide-react";
import { t } from "@/lib/i18n";

export function VoiceRecorder({ onSaved }: { onSaved: (audioFile: File | null) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "recorded" | "denied" | "error">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<File | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl]
  );

  function start() {
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        const rec = new MediaRecorder(stream);
        chunksRef.current = [];
        rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
        rec.onstop = () => {
          stream.getTracks().forEach((tr) => tr.stop());
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          const url = URL.createObjectURL(blob);
          setAudioUrl((old) => {
            if (old) URL.revokeObjectURL(old);
            return url;
          });
          const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
          setDataUrl(new File([blob], `voice-reflection.${ext}`, { type: blob.type }));
          setState("recorded");
        };
        recorderRef.current = rec;
        rec.start();
        setSeconds(0);
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        setState("recording");
      })
      .catch(() => setState("denied"));
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }

  function retake() {
    setAudioUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setDataUrl(null);
    onSaved(null);
    setSeconds(0);
    setState("idle");
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="space-y-2" data-testid="voice-recorder">
      {state === "idle" && (
        <button type="button" className="btn-secondary" onClick={start}>
          <Mic className="w-4 h-4" aria-hidden /> {t("voice.record")}
        </button>
      )}
      {state === "recording" && (
        <div className="flex items-center gap-3">
          <button type="button" className="btn-danger" onClick={stop} aria-label={t("voice.stop")}>
            <Square className="w-4 h-4" aria-hidden /> {t("voice.stop")}
          </button>
          <span className="font-mono text-sm text-navy-900/70" aria-live="polite">
            {mm}:{ss}
          </span>
        </div>
      )}
      {state === "recorded" && (
        <div className="space-y-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- teacher's own voice memo */}
          <audio controls src={audioUrl ?? undefined} className="w-full max-w-sm" />
          <div className="flex items-center gap-2 text-xs text-navy-900/60">
            <Play className="w-3.5 h-3.5" aria-hidden /> {t("voice.saved")} ({mm}:{ss})
            <button type="button" className="underline" onClick={retake}>
              <RefreshCw className="w-3 h-3 inline" aria-hidden /> {t("voice.retake")}
            </button>
          </div>
        </div>
      )}
      {state === "denied" && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {t("voice.denied")}
        </p>
      )}
      {state === "error" && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{t("voice.error")}</p>
      )}
      {/* Parent reads the recording only when submitted; clearing is explicit. */}
      <SaveBridge dataUrl={dataUrl} onSaved={onSaved} />
    </div>
  );
}

/** Applies the recorded audio to the parent form once it is fully encoded. */
function SaveBridge({ dataUrl, onSaved }: { dataUrl: File | null; onSaved: (d: File | null) => void }) {
  const applied = useRef<File | null>(null);
  useEffect(() => {
    if (dataUrl && applied.current !== dataUrl) {
      applied.current = dataUrl;
      onSaved(dataUrl);
    }
  }, [dataUrl, onSaved]);
  return null;
}
