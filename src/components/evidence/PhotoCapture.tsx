"use client";

/**
 * Camera-first photo evidence (Master Task GOAL 17 + 56).
 *
 * Capture (rear camera) or gallery → preview → retake → client-side
 * compression (longest edge ≤ 1600px, JPEG q0.8) → File for the existing
 * upload pipeline. Compression keeps payloads small on low-bandwidth mobile
 * connections (GOAL 23) without changing the server contract. Privacy note
 * (GOAL 55) is kept next to the control.
 */
import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, RefreshCw } from "lucide-react";
import { t } from "@/lib/i18n";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

/** Downscales and re-encodes an image client-side; returns null when unsupported. */
async function compress(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return null;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return null;
  }
}

export function PhotoCapture({ onFile }: { onFile: (file: File | null) => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const processed = await compress(file);
    setBusy(false);
    if (!processed) {
      setError(t("photo.unsupported"));
      return;
    }
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(processed);
    });
    onFile(processed);
  }

  function retake() {
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    onFile(null);
  }

  return (
    <div className="space-y-2" data-testid="photo-capture">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {!previewUrl && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => cameraRef.current?.click()} disabled={busy}>
            <Camera className="w-4 h-4" aria-hidden /> {t("photo.take")}
          </button>
          <button type="button" className="btn-secondary" onClick={() => galleryRef.current?.click()} disabled={busy}>
            <ImageIcon className="w-4 h-4" aria-hidden /> {t("photo.gallery")}
          </button>
          {busy && <span className="text-sm text-navy-900/60 self-center">{t("photo.compressing")}</span>}
        </div>
      )}

      {previewUrl && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img src={previewUrl} alt="Photo evidence preview" className="rounded-lg border border-slate-200 max-h-56 w-auto" />
          <button type="button" className="text-xs underline text-navy-900/60" onClick={retake}>
            <RefreshCw className="w-3 h-3 inline" aria-hidden /> {t("photo.retake")}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}
