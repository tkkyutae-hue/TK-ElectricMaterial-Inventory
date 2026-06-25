import path from "path";
import fs from "fs";
import type { CompletionReportWithPhotos } from "@shared/schema";

// TK Electric logo (from client/public/favicon.png)
const LOGO_PATH = path.join(process.cwd(), "client", "public", "favicon.png");

const TK_GREEN       = "5D9B3B";
const TK_GREEN_LIGHT = "D6ECC5";
const TK_GREEN_MID   = "A8D08A";
const HEADER_GREEN   = "6BBF4E";
const WHITE          = "FFFFFF";
const DARK           = "1A1A1A";
const GRAY           = "666666";

const SLIDE_W = 10;
const SLIDE_H = 7.5;

const uploadsDir = path.join(process.cwd(), "uploads");

function imgPath(url: string | null | undefined): string | null {
  if (!url) return null;
  // Strip leading /uploads/ prefix, then use path.basename to prevent traversal
  const raw = url.startsWith("/uploads/") ? url.slice("/uploads/".length) : url;
  const filename = path.basename(raw); // prevents ../../ traversal
  const resolved = path.join(uploadsDir, filename);
  // Ensure resolved path is still under uploads dir
  if (!resolved.startsWith(uploadsDir + path.sep) && resolved !== uploadsDir) return null;
  return fs.existsSync(resolved) ? resolved : null;
}

async function toBase64(filePath: string): Promise<string | null> {
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace(".", "");
    const mimeMap: Record<string, string> = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" };
    const mime = mimeMap[ext] || "jpeg";
    return `data:image/${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function addPageHeader(slide: any, prs: any) {
  slide.addText("■  PROJECT COMPLETION REPORT", {
    x: 0.35, y: 0.18, w: 7.2, h: 0.35,
    fontSize: 13, bold: true, color: DARK,
    fontFace: "Calibri",
  });

  // TK logo top-right
  const logoData = await toBase64(LOGO_PATH);
  if (logoData) {
    slide.addImage({ data: logoData, x: 9.05, y: 0.08, w: 0.55, h: 0.55 });
  }
  slide.addText("TK ELECTRIC LLC.", {
    x: 7.4, y: 0.1, w: 1.6, h: 0.3,
    fontSize: 8, bold: true, color: TK_GREEN,
    fontFace: "Calibri", align: "right",
  });
  slide.addText("www.tkglobal.us", {
    x: 7.4, y: 0.38, w: 1.6, h: 0.2,
    fontSize: 7, bold: false, color: TK_GREEN,
    fontFace: "Calibri", align: "right",
  });

  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0.62, w: SLIDE_W, h: 0.025,
    fill: { color: TK_GREEN }, line: { color: TK_GREEN },
  });
}

function addInfoTable(slide: any, project: any, report: CompletionReportWithPhotos) {
  const startDate = project.startDate ?? "";
  const endDate   = project.endDate   ?? report.completionDate ?? "";
  const duration  = (startDate && endDate) ? `${startDate} ~ ${endDate}` : (startDate || endDate || "—");
  const location  = project.jobLocation ?? project.city ?? "—";

  const tableData = [
    [
      { text: "Project Name", options: { bold: true, color: DARK, fill: TK_GREEN_LIGHT } },
      { text: project.name ?? "—", options: { color: DARK } },
      { text: "Duration",    options: { bold: true, color: DARK, fill: TK_GREEN_LIGHT } },
      { text: duration,      options: { color: DARK } },
    ],
    [
      { text: "Location",   options: { bold: true, color: DARK, fill: TK_GREEN_LIGHT } },
      { text: location,     options: { color: DARK } },
      { text: "Contractor", options: { bold: true, color: DARK, fill: TK_GREEN_LIGHT } },
      { text: "TK Electric LLC", options: { color: DARK } },
    ],
  ];

  slide.addTable(tableData, {
    x: 0.3, y: 0.75, w: 9.4,
    fontSize: 9, fontFace: "Calibri",
    border: { pt: 0.5, color: TK_GREEN_MID },
    colW: [1.4, 3.3, 1.3, 3.4],
  });
}

export async function generateCompletionReportPptx(
  project: any,
  report: CompletionReportWithPhotos,
): Promise<Buffer> {
  const pptxgen = (await import("pptxgenjs")).default;
  const prs = new pptxgen();
  prs.layout = "LAYOUT_4x3";

  // ── Slide 1: Cover ────────────────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };

    // Decorative arcs (approximated with transparent green circles)
    const arcs = [
      { x: -1.2, y: -1.2, d: 5.5 },
      { x: -0.6, y: -0.6, d: 5.5 },
      { x: 6.5,  y:  3.5, d: 5.5 },
      { x: 7.1,  y:  4.1, d: 5.5 },
    ];
    for (const a of arcs) {
      slide.addShape(prs.ShapeType.ellipse, {
        x: a.x, y: a.y, w: a.d, h: a.d,
        fill: { color: "F0FAE8" },
        line: { color: TK_GREEN_LIGHT, pt: 2 },
      });
    }

    // Center rounded box
    slide.addShape(prs.ShapeType.roundRect, {
      x: 1.0, y: 2.5, w: 8.0, h: 1.8,
      fill: { color: TK_GREEN_LIGHT },
      line: { color: TK_GREEN, pt: 1.5 },
      rectRadius: 0.15,
    });

    const titleLine1 = `${project.name ?? ""}${project.poNumber ? ` (${project.poNumber})` : ""}`;
    slide.addText([
      { text: titleLine1 + "\n", options: { fontSize: 14, bold: false, color: DARK } },
      { text: "Work Final Report",   options: { fontSize: 26, bold: true,  color: DARK } },
    ], {
      x: 1.2, y: 2.6, w: 7.6, h: 1.6,
      fontFace: "Calibri", align: "center", valign: "middle",
    });

    // TK Logo text (bottom-right)
    slide.addText("TK ELECTRIC LLC.\nwww.tkglobal.us", {
      x: 7.2, y: 6.5, w: 2.6, h: 0.75,
      fontSize: 10, bold: true, color: TK_GREEN,
      fontFace: "Calibri", align: "right",
    });
  }

  // ── Slide 2: Work Final Report ────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    await addPageHeader(slide, prs);

    // Large bordered frame
    slide.addShape(prs.ShapeType.rect, {
      x: 0.4, y: 0.75, w: 9.2, h: 6.5,
      fill: { color: WHITE },
      line: { color: DARK, pt: 1 },
    });

    // Title inside frame
    slide.addText("Work Final Report", {
      x: 0.6, y: 0.85, w: 8.8, h: 0.65,
      fontSize: 22, bold: false, color: DARK,
      fontFace: "Calibri", align: "center",
    });
    // Divider
    slide.addShape(prs.ShapeType.line, {
      x: 0.6, y: 1.48, w: 8.8, h: 0,
      line: { color: "C0C0C0", pt: 0.5 },
    });

    const poNumber   = project.poNumber   ?? project.code ?? "—";
    const compDate   = report.completionDate ?? "—";
    const contractIt = report.contractItem  ?? "Electric Works";
    const workDesc   = report.workDescription ?? "";

    const infoLines = [
      `1.  Project Name:   ${project.name ?? "—"}`,
      `2.  PO Number:      ${poNumber}`,
      `3.  Company Name:   TK ELECTRIC LLC.`,
      `4.  Contract Item:  ${contractIt}`,
      `5.  Work Description:`,
    ];

    slide.addText(infoLines.join("\n"), {
      x: 0.7, y: 1.55, w: 8.6, h: 1.9,
      fontSize: 11, color: DARK, fontFace: "Calibri",
      valign: "top",
    });

    if (workDesc) {
      const lines = workDesc.split("\n").map((l: string) => `      - ${l.trim()}`).join("\n");
      slide.addText(lines, {
        x: 0.9, y: 2.85, w: 8.2, h: 1.5,
        fontSize: 10.5, color: DARK, fontFace: "Calibri",
        valign: "top",
      });
    }

    const statementY = workDesc ? 4.5 : 3.7;
    slide.addText(
      `We hereby report that the above work (${project.name ?? ""}) has been completed as described.`,
      {
        x: 0.9, y: statementY, w: 8.2, h: 0.7,
        fontSize: 11, color: DARK, fontFace: "Calibri",
        align: "center", italic: false,
      }
    );

    slide.addText(`Completion Date:  ${compDate}`, {
      x: 0.7, y: 6.1, w: 8.6, h: 0.35,
      fontSize: 11, color: DARK, fontFace: "Calibri", align: "right",
    });
    slide.addText("Contractor:  TK ELECTRIC LLC.", {
      x: 0.7, y: 6.45, w: 8.6, h: 0.35,
      fontSize: 11, color: DARK, fontFace: "Calibri", align: "right",
    });
  }

  // ── Slide 3: Quotation ────────────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    await addPageHeader(slide, prs);

    const qPath  = imgPath(report.quotationImageUrl);
    const qData  = qPath ? await toBase64(qPath) : null;
    if (qData) {
      slide.addImage({ data: qData, x: 0.3, y: 0.72, w: 9.4, h: 6.6 });
    } else {
      slide.addText("[ Quotation image not uploaded ]", {
        x: 0.3, y: 3.5, w: 9.4, h: 0.6,
        fontSize: 14, color: GRAY, fontFace: "Calibri", align: "center",
      });
    }
  }

  // ── Slide 4: Drawing ──────────────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    await addPageHeader(slide, prs);
    addInfoTable(slide, project, report);

    slide.addText("Drawing", {
      x: 0.3, y: 1.68, w: 9.4, h: 0.35,
      fontSize: 13, bold: false, color: DARK, fontFace: "Calibri", align: "center",
    });

    const dPath = imgPath(report.drawingImageUrl);
    const dData = dPath ? await toBase64(dPath) : null;
    if (dData) {
      slide.addImage({ data: dData, x: 0.3, y: 2.05, w: 9.4, h: 5.2 });
    } else {
      slide.addText("[ Drawing image not uploaded ]", {
        x: 0.3, y: 4.5, w: 9.4, h: 0.6,
        fontSize: 13, color: GRAY, fontFace: "Calibri", align: "center",
      });
    }
  }

  // ── Slide 5+: Photo slides (2 per slide) ──────────────────────────────────
  const photos = report.photos ?? [];
  for (let i = 0; i < Math.max(photos.length, 1); i += 2) {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    await addPageHeader(slide, prs);
    addInfoTable(slide, project, report);

    const left  = photos[i];
    const right = photos[i + 1];

    const photoY = 1.72;
    const photoH = 4.0;
    const metaH  = 0.8;

    for (const [idx, photo] of [[0, left], [1, right]] as [number, typeof left | undefined][]) {
      if (!photo) continue;
      const x = idx === 0 ? 0.3 : 5.15;
      const w = 4.55;

      const pPath = imgPath(photo.photoUrl);
      const pData = pPath ? await toBase64(pPath) : null;
      if (pData) {
        slide.addImage({ data: pData, x, y: photoY, w, h: photoH });
      } else {
        slide.addShape(prs.ShapeType.rect, {
          x, y: photoY, w, h: photoH,
          fill: { color: "F0F0F0" }, line: { color: "CCCCCC", pt: 0.5 },
        });
      }

      // Meta info below photo
      slide.addShape(prs.ShapeType.rect, {
        x, y: photoY + photoH, w, h: metaH,
        fill: { color: "F8F8F8" }, line: { color: "CCCCCC", pt: 0.5 },
      });
      const metaText = [
        { text: "Date",        options: { bold: true, color: DARK } },
        { text: `   ${photo.photoDate ?? "—"}`,  options: { color: DARK } },
        { text: "\nDescription", options: { bold: true, color: DARK } },
        { text: `   ${photo.description ?? "—"}`, options: { color: DARK } },
      ];
      slide.addText(metaText, {
        x: x + 0.08, y: photoY + photoH + 0.05, w: w - 0.16, h: metaH - 0.1,
        fontSize: 8.5, fontFace: "Calibri", valign: "top",
      });
    }

    if (photos.length === 0) {
      slide.addText("[ No photos uploaded ]", {
        x: 0.3, y: 4.0, w: 9.4, h: 0.6,
        fontSize: 13, color: GRAY, fontFace: "Calibri", align: "center",
      });
    }
  }

  const buffer = await prs.write({ outputType: "nodebuffer" }) as Buffer;
  return buffer;
}
