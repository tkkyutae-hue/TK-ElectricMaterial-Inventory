import { resolve as resolvePath } from "path";
import { createCanvas, type Canvas } from "@napi-rs/canvas";

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

  await pdfPage.render({ canvasContext: context, viewport }).promise;

  return canvas.encode("png") as unknown as Buffer;
}
