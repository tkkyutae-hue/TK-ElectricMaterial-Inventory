import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

interface PdfViewerProps {
  url: string;
  filename: string;
  height?: number;
  onReplaceClick?: () => void;
}

export function PdfViewer({ url, filename, height = 280, onReplaceClick }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function renderPage(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number) {
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext("2d")!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      if (!cancelled) setLoading(false);
    }

    async function loadPdf() {
      try {
        console.log("[PdfViewer] Loading PDF from blob URL:", url.slice(0, 60));
        const loadingTask = pdfjsLib.getDocument({ url, disableRange: false });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        console.log("[PdfViewer] PDF loaded OK —", pdf.numPages, "page(s)");
        setPageCount(pdf.numPages);
        await renderPage(pdf, currentPage);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[PdfViewer] Render failed:", msg, err);
        setError(msg);
        setLoading(false);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [url, currentPage, scale]);

  if (error) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 10, minHeight: height, background: "#fafafa",
        border: "1px dashed #e2e8e4", borderRadius: 6, padding: 24, textAlign: "center",
      }}>
        <span style={{ fontSize: 28 }}>📄</span>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: 0 }}>Preview unavailable</p>
        <p style={{ fontSize: 10.5, color: "#9ca3af", margin: 0, maxWidth: 260 }}>
          {error.includes("PDF") || error.includes("worker")
            ? "Unable to render this PDF in the browser."
            : error}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
          <a href={url} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, padding: "5px 12px", border: "1px solid #d0dbd2", borderRadius: 5, background: "white", color: "#1d6ecc", textDecoration: "none", fontWeight: 500 }}>
            ↗ Open in new tab
          </a>
          <a href={url} download={filename}
            style={{ fontSize: 11, padding: "5px 12px", border: "1px solid #d0dbd2", borderRadius: 5, background: "white", color: "#374151", textDecoration: "none", fontWeight: 500 }}>
            ⬇ Download PDF
          </a>
          {onReplaceClick && (
            <button type="button" onClick={onReplaceClick}
              style={{ fontSize: 11, padding: "5px 12px", border: "1px solid #fca5a5", borderRadius: 5, background: "#fff1f2", color: "#dc2626", cursor: "pointer", fontWeight: 500 }}>
              ↺ Replace file
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", overflow: "auto", maxHeight: height, background: "#f1f5f2" }}>
      {loading && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: "#f1f5f2", zIndex: 5, minHeight: 80,
        }}>
          <span style={{ fontSize: 11, color: "#6b8a70", animation: "pulse 1.2s infinite" }}>Loading PDF…</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", opacity: loading ? 0 : 1, transition: "opacity 0.2s" }}
      />
      {!loading && pageCount > 1 && (
        <div style={{
          position: "sticky", bottom: 0, background: "rgba(244,247,245,0.92)",
          borderTop: "1px solid #e2e8e4", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 10, padding: "5px 12px", fontSize: 10.5, color: "#3d5c45",
        }}>
          <button type="button" disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => p - 1)}
            style={{ background: "none", border: "none", cursor: currentPage <= 1 ? "default" : "pointer", color: currentPage <= 1 ? "#c8d9cb" : "#3d5c45", fontSize: 13 }}>
            ‹
          </button>
          <span>Page {currentPage} of {pageCount}</span>
          <button type="button" disabled={currentPage >= pageCount}
            onClick={() => setCurrentPage(p => p + 1)}
            style={{ background: "none", border: "none", cursor: currentPage >= pageCount ? "default" : "pointer", color: currentPage >= pageCount ? "#c8d9cb" : "#3d5c45", fontSize: 13 }}>
            ›
          </button>
          <span style={{ marginLeft: 8, color: "#9db8a2" }}>|</span>
          <button type="button" onClick={() => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#3d5c45", fontSize: 13, padding: "0 2px" }}>−</button>
          <span>{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => setScale(s => Math.min(4, +(s + 0.25).toFixed(2)))}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#3d5c45", fontSize: 13, padding: "0 2px" }}>+</button>
        </div>
      )}
    </div>
  );
}
