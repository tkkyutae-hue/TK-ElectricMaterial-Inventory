import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

export async function pdfFirstPageToPng(pdfBuffer: Buffer): Promise<Buffer> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "voltstock-pdf-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const outPrefix = path.join(tmpDir, "page");

  try {
    await fs.promises.writeFile(pdfPath, pdfBuffer);

    await execFileAsync("pdftoppm", [
      "-png",
      "-r", "150",
      "-f", "1",
      "-l", "1",
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
