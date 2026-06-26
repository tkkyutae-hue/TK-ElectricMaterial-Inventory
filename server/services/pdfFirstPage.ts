import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

export async function pdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "voltstock-pdf-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  try {
    await fs.promises.writeFile(pdfPath, pdfBuffer);
    const { stdout } = await execFileAsync("pdfinfo", [pdfPath]);
    const match = stdout.match(/^Pages:\s*(\d+)/m);
    if (!match) return 1;
    return parseInt(match[1], 10) || 1;
  } catch {
    return 1;
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function pdfFirstPageToPng(pdfBuffer: Buffer, pageNumber = 1): Promise<Buffer> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "voltstock-pdf-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const outPrefix = path.join(tmpDir, "page");

  const page = Math.max(1, Math.floor(pageNumber));

  try {
    await fs.promises.writeFile(pdfPath, pdfBuffer);

    await execFileAsync("pdftoppm", [
      "-png",
      "-r", "150",
      "-f", String(page),
      "-l", String(page),
      pdfPath,
      outPrefix,
    ]);

    const files = await fs.promises.readdir(tmpDir);
    const pngFile = files.find(f => f.startsWith("page") && f.endsWith(".png"));
    if (!pngFile) throw new Error("PDF conversion produced no output");

    return await fs.promises.readFile(path.join(tmpDir, pngFile));
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
