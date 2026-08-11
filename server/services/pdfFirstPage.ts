import { resolve as resolvePath } from "path";
import {
  createCanvas,
  type Canvas,
  Path2D,
  ImageData,
  DOMMatrix,
  DOMPoint,
  DOMRect,
} from "@napi-rs/canvas";

// pdfjs-dist relies on several DOM globals that don't exist in Node.js.
// Register @napi-rs/canvas's implementations so pdfjs-dist can use them
// when constructing paths, transforms, and image data during rendering.
// These must be set before pdfjs-dist is imported.
(globalThis as Record<string, unknown>).Path2D = Path2D;
(globalThis as Record<string, unknown>).ImageData = ImageData;
(globalThis as Record<string, unknown>).DOMMatrix = DOMMatrix;
(globalThis as Record<string, unknown>).DOMPoint = DOMPoint;
(globalThis as Record<string, unknown>).DOMRect = DOMRect;

// Resolve worker path relative to project root (cwd in prod = project root).
// Avoids import.meta.url / createRequire incompatibilities across CJS bundle builds.
function workerSrc(): string {
  return "file://" + resolvePath("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
}

// Lazy-initialized promise — avoids top-level await (not supported in CJS bundle output)
let _pdfjsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

async function getPdfjs() {
  if (!_pdfjsPromise) {
    _pdfjsPromise = (async () => {
      // Dynamic import of ESM-only pdfjs-dist works from CJS in Node.js 20+
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc();
      return pdfjs;
    })();
  }
  return _pdfjsPromise;
}

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(canvasAndContext: { canvas: Canvas; context: unknown }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: { canvas: Canvas; context: unknown }) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

export async function pdfPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    const pdfjs = await getPdfjs();
    const canvasFactory = new NodeCanvasFactory();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await (pdfjs.getDocument as any)({
      data: new Uint8Array(pdfBuffer),
      verbosity: 0,
      canvasFactory,
    }).promise;
    return (doc.numPages as number) || 1;
  } catch {
    return 1;
  }
}

export async function pdfFirstPageToPng(pdfBuffer: Buffer, pageNumber = 1): Promise<Buffer> {
  const pdfjs = await getPdfjs();
  const canvasFactory = new NodeCanvasFactory();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await (pdfjs.getDocument as any)({
    data: new Uint8Array(pdfBuffer),
    verbosity: 0,
    canvasFactory,
  }).promise;

  const totalPages = doc.numPages as number;
  const page = Math.max(1, Math.min(Math.floor(pageNumber), totalPages));
  const pdfPage = await doc.getPage(page);
  const viewport = pdfPage.getViewport({ scale: 1.5 });

  const width = Math.round(viewport.width as number);
  const height = Math.round(viewport.height as number);
  const { canvas, context } = canvasFactory.create(width, height);

  try {
    await pdfPage.render({ canvasContext: context, viewport }).promise;
    return canvas.encode("png") as unknown as Buffer;
  } finally {
    canvasFactory.destroy({ canvas, context });
    pdfPage.cleanup();
    await doc.destroy();
  }
}

/**
 * Open the PDF once and render a range of pages, properly releasing resources.
 * Returns an array of PNG buffers in page order.
 * @param fromPage 1-based start page (inclusive)
 * @param toPage   1-based end page (inclusive); clamped to total pages
 */
export async function pdfPageRangeToPngs(
  pdfBuffer: Buffer,
  fromPage = 1,
  toPage = Infinity,
): Promise<{ pngs: Buffer[]; totalPages: number }> {
  const pdfjs = await getPdfjs();
  const canvasFactory = new NodeCanvasFactory();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await (pdfjs.getDocument as any)({
    data: new Uint8Array(pdfBuffer),
    verbosity: 0,
    canvasFactory,
  }).promise;

  const totalPages = doc.numPages as number;
  const start = Math.max(1, Math.floor(fromPage));
  const end   = Math.min(totalPages, Math.floor(toPage === Infinity ? totalPages : toPage));

  const pngs: Buffer[] = [];
  try {
    for (let p = start; p <= end; p++) {
      const pdfPage = await doc.getPage(p);
      const viewport = pdfPage.getViewport({ scale: 1.5 });
      const width  = Math.round(viewport.width as number);
      const height = Math.round(viewport.height as number);
      const { canvas, context } = canvasFactory.create(width, height);
      try {
        await pdfPage.render({ canvasContext: context, viewport }).promise;
        pngs.push(await (canvas.encode("png") as unknown as Promise<Buffer>));
      } finally {
        canvasFactory.destroy({ canvas, context });
        pdfPage.cleanup();
      }
    }
  } finally {
    await doc.destroy();
  }

  return { pngs, totalPages };
}
