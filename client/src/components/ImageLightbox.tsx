import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function ImageLightbox({
  images,
  initialIndex = 0,
  open,
  onClose,
}: {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);

  useEffect(() => {
    if (open) setIdx(initialIndex);
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft")  setIdx(i => (i - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setIdx(i => (i + 1) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length, onClose]);

  if (!open || images.length === 0) return null;

  const multi = images.length > 1;

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
      data-testid="lightbox-backdrop"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        data-testid="lightbox-close"
        style={{
          position: "absolute", top: 16, right: 16,
          background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 8, width: 36, height: 36, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", zIndex: 1,
        }}
      >
        <X style={{ width: 18, height: 18 }} />
      </button>

      {/* Prev arrow */}
      {multi && (
        <button
          onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
          data-testid="lightbox-prev"
          style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8, width: 44, height: 44, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", zIndex: 1,
          }}
        >
          <ChevronLeft style={{ width: 24, height: 24 }} />
        </button>
      )}

      {/* Main image */}
      <img
        src={images[idx]}
        alt=""
        onClick={e => e.stopPropagation()}
        data-testid="lightbox-image"
        style={{
          maxWidth: "90vw", maxHeight: "90vh",
          objectFit: "contain",
          borderRadius: 10,
          boxShadow: "0 8px 48px rgba(0,0,0,0.7)",
          userSelect: "none",
          display: "block",
        }}
      />

      {/* Next arrow */}
      {multi && (
        <button
          onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
          data-testid="lightbox-next"
          style={{
            position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8, width: 44, height: 44, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", zIndex: 1,
          }}
        >
          <ChevronRight style={{ width: 24, height: 24 }} />
        </button>
      )}

      {/* Counter */}
      {multi && (
        <div
          style={{
            position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 20, padding: "4px 14px",
            color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: 0.5,
            userSelect: "none",
          }}
          data-testid="lightbox-counter"
        >
          {idx + 1} / {images.length}
        </div>
      )}
    </div>,
    document.body
  );
}
