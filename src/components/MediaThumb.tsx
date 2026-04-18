"use client";

import { useEffect, useState } from "react";
import { X, Download, Play } from "lucide-react";

type Kind = "image" | "video";

function guessKind(url: string, hint?: Kind): Kind {
  if (hint) return hint;
  const lower = url.toLowerCase().split("?")[0];
  if (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".m4v")
  ) {
    return "video";
  }
  return "image";
}

export function MediaThumb({
  url,
  label,
  kind,
  className,
  variant = "card",
}: {
  url: string;
  label?: string;
  kind?: Kind;
  className?: string;
  variant?: "card" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const actualKind = guessKind(url, kind);

  const content =
    actualKind === "video" ? (
      <div className="relative w-full h-full">
        <video
          src={url}
          preload="metadata"
          className={
            className ||
            "w-full h-24 object-cover rounded-lg border border-gray-200"
          }
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
          <div className="bg-white/90 rounded-full p-2">
            <Play className="w-5 h-5 text-gray-800" />
          </div>
        </div>
      </div>
    ) : (
      <img
        src={url}
        alt={label || "Evidencia"}
        className={
          className ||
          "w-full h-24 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition"
        }
      />
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "card"
            ? "block text-left w-full focus:outline-none focus:ring-2 focus:ring-dtm-blue rounded-lg"
            : "inline-block focus:outline-none"
        }
      >
        {content}
        {label && variant === "card" && (
          <p className="text-[10px] text-gray-500 mt-1 truncate">{label}</p>
        )}
      </button>
      {open && (
        <MediaModal
          url={url}
          kind={actualKind}
          label={label}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function MediaModal({
  url,
  kind,
  label,
  onClose,
}: {
  url: string;
  kind: Kind;
  label?: string;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const download = async () => {
    try {
      setDownloading(true);
      const resp = await fetch(url);
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      const cleanName =
        url.split("/").pop()?.split("?")[0] ||
        (label ? label.replace(/\s+/g, "_") : "descarga") +
          (kind === "video" ? ".mp4" : ".jpg");
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl max-h-[90vh] w-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-3 text-white">
          <p className="font-medium truncate">{label || "Evidencia"}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white text-gray-800 rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {downloading ? "Descargando..." : "Descargar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          {kind === "video" ? (
            <video
              src={url}
              controls
              autoPlay
              className="max-h-[80vh] max-w-full rounded-lg bg-black"
            />
          ) : (
            <img
              src={url}
              alt={label || "Evidencia"}
              className="max-h-[80vh] max-w-full object-contain rounded-lg"
            />
          )}
        </div>
      </div>
    </div>
  );
}
