"use client";

/**
 * Classroom video evidence recorder (Master Task GOAL 17).
 *
 * Record (rear camera + mic) → preview → retake → save, with a file-picker
 * fallback for devices or browsers where MediaRecorder is unavailable. The
 * same 5 MB cap as every other evidence type is enforced client-side so the
 * teacher learns about an oversized clip before submitting, not after.
 * Nothing is uploaded until the teacher submits evidence; offline queueing
 * works through the outbox unchanged.
 */
import { useEffect, useRef, useState } from "react";
import { Video, Square, RefreshCw, Upload } from "lucide-react";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SECONDS = 30;

export function VideoRecorder({ onFile }: { onFile: (file: File | null) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "recorded" | "denied" | "error">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  function start() {
    setError(null);
    // Explicit guard: `navigator.mediaDevices?.getUserMedia(...).then(...)`
    // short-circuits to undefined on browsers without mediaDevices — no promise,
    // no rejection, no fallback UI. Check first, then call unconditionally.
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("denied");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        // Prefer WebM (Chrome/Android); fall back to whatever the browser offers.
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : undefined;
        // Cap the encode bitrate so a full MAX_SECONDS clip fits the 5 MB
        // evidence envelope (default bitrates would produce ~30 MB clips that
        // the server must reject). The oversize guard below stays as a backstop.
        const rec = new MediaRecorder(stream, {
          ...(mimeType ? { mimeType } : {}),
          videoBitsPerSecond: 1_000_000,
          audioBitsPerSecond: 64_000,
        });
        chunksRef.current = [];
        rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
        rec.onstop = () => {
          stream.getTracks().forEach((tr) => tr.stop());
          streamRef.current = null;
          const type = rec.mimeType.split(";")[0] || "video/webm";
          const blob = new Blob(chunksRef.current, { type });
          applyBlob(blob);
        };
        recorderRef.current = rec;
        rec.start();
        setSeconds(0);
        timerRef.current = setInterval(() => {
          setSeconds((s) => {
            if (s + 1 >= MAX_SECONDS) stop(); // hard stop so clips stay under the size cap
            return s + 1;
          });
        }, 1000);
        setState("recording");
      })
      .catch(() => setState("denied"));
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
  }

  function applyBlob(blob: Blob) {
    if (blob.size > MAX_BYTES) {
      setState("error");
      setError(`Video must be ${MAX_BYTES / (1024 * 1024)} MB or smaller — try a shorter clip.`);
      onFile(null);
      return;
    }
    const ext = blob.type.includes("mp4") ? "vmp4" : "vwebm";
    const f = new File([blob], `classroom-video.${ext}`, { type: blob.type });
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
    setFile(f);
    onFile(f);
    setState("recorded");
  }

  function handlePicked(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setState("error");
      setError(`Video must be ${MAX_BYTES / (1024 * 1024)} MB or smaller — try a shorter clip.`);
      onFile(null);
      return;
    }
    applyBlob(f);
  }

  function retake() {
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setFile(null);
    onFile(null);
    setSeconds(0);
    setError(null);
    setState("idle");
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="space-y-2" data-testid="video-recorder">
      <input
        ref={pickerRef}
        type="file"
        accept="video/webm,video/mp4"
        className="hidden"
        onChange={(e) => handlePicked(e.target.files?.[0])}
      />

      {state === "idle" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={start}>
            <Video className="w-4 h-4" aria-hidden /> Record video (max {MAX_SECONDS}s)
          </button>
          <button type="button" className="btn-secondary" onClick={() => pickerRef.current?.click()}>
            <Upload className="w-4 h-4" aria-hidden /> Choose a clip
          </button>
        </div>
      )}

      {state === "recording" && (
        <div className="flex items-center gap-3">
          <button type="button" className="btn-danger" onClick={stop} aria-label="Stop recording">
            <Square className="w-4 h-4" aria-hidden /> Stop
          </button>
          <span className="font-mono text-sm text-navy-900/70" aria-live="polite">
            {mm}:{ss}
          </span>
        </div>
      )}

      {state === "recorded" && (
        <div className="space-y-2">
          <video
            controls
            playsInline
            preload="metadata"
            src={previewUrl ?? undefined}
            className="rounded-lg border border-slate-200 max-h-56 w-auto"
          />
          <button type="button" className="text-xs underline text-navy-900/60" onClick={retake}>
            <RefreshCw className="w-3 h-3 inline" aria-hidden /> Remove video
          </button>
        </div>
      )}

      {state === "denied" && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Camera unavailable or permission denied — you can still pick a saved clip, or use photo, audio or written
          evidence instead. Video is never required.
        </p>
      )}

      {state === "error" && (
        <div className="space-y-2">
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          <button type="button" className="text-xs underline text-navy-900/60" onClick={retake}>
            <RefreshCw className="w-3 h-3 inline" aria-hidden /> Try again
          </button>
        </div>
      )}
    </div>
  );
}
