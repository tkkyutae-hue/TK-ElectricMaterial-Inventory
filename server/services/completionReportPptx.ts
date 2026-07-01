import path from "path";
import fs from "fs";
import type { CompletionReportWithPhotos } from "@shared/schema";
import { downloadBuffer } from "./objectStorageUpload";

// TK Electric logo
const LOGO_PATH = path.join(process.cwd(), "server", "assets", "tk_logo.png");

const TK_GREEN       = "5D9B3B";
const TK_GREEN_LIGHT = "D6ECC5";
const TK_GREEN_MID   = "A8D08A";
const WHITE          = "FFFFFF";
const DARK           = "1A1A1A";
const GRAY           = "666666";

const SLIDE_W = 10;
const SLIDE_H = 7.5;

async function imgBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    // Extract bare filename to prevent path traversal
    const raw = url.startsWith("/uploads/") ? url.slice("/uploads/".length) : url;
    const filename = path.basename(raw);
    if (!filename) return null;

    // Try Object Storage first (production)
    const buf = await downloadBuffer(filename);
    if (buf) {
      const ext = path.extname(filename).toLowerCase().replace(".", "");
      const mimeMap: Record<string, string> = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" };
      const mime = mimeMap[ext] ?? "jpeg";
      return `data:image/${mime};base64,${buf.toString("base64")}`;
    }

    // Fallback: local disk (dev)
    const localPath = path.join(process.cwd(), "uploads", filename);
    if (fs.existsSync(localPath)) {
      const localBuf = fs.readFileSync(localPath);
      const ext = path.extname(filename).toLowerCase().replace(".", "");
      const mimeMap: Record<string, string> = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" };
      const mime = mimeMap[ext] ?? "jpeg";
      return `data:image/${mime};base64,${localBuf.toString("base64")}`;
    }

    return null;
  } catch {
    return null;
  }
}

async function localFileBase64(filePath: string): Promise<string | null> {
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace(".", "");
    const mimeMap: Record<string, string> = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" };
    const mime = mimeMap[ext] ?? "jpeg";
    return `data:image/${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function addPageHeader(slide: any, prs: any, sectionLabel: string) {
  slide.addText(`■  ${sectionLabel}`, {
    x: 0.35, y: 0.18, w: 7.0, h: 0.35,
    fontSize: 13, bold: true, color: DARK,
    fontFace: "Calibri",
  });

  // TK logo top-right (logo image includes company name + URL)
  const logoData = await localFileBase64(LOGO_PATH);
  if (logoData) {
    // Logo aspect ratio ~2.028:1 (2135×1053); w=1.2 → h≈0.59
    slide.addImage({ data: logoData, x: 8.55, y: 0.02, w: 1.2, h: 0.59 });
  } else {
    // Fallback text if image missing
    slide.addText("TK ELECTRIC LLC.", {
      x: 7.5, y: 0.1, w: 2.1, h: 0.3,
      fontSize: 8, bold: true, color: TK_GREEN,
      fontFace: "Calibri", align: "right",
    });
    slide.addText("www.tkglobal.us", {
      x: 7.5, y: 0.38, w: 2.1, h: 0.2,
      fontSize: 7, color: TK_GREEN,
      fontFace: "Calibri", align: "right",
    });
  }

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
  photosPerSlide: 2 | 4 = 2,
): Promise<Buffer> {
  const pptxgen = (await import("pptxgenjs")).default;
  const prs = new pptxgen();
  prs.layout = "LAYOUT_4x3";

  // ── Slide 1: Cover ────────────────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };

    // Decorative circles — all coords within slide bounds (0–10 x, 0–7.5 y)
    const arcs = [
      { x: 0.0, y: 0.0, d: 4.5 },   // top-left outer
      { x: 0.5, y: 0.5, d: 4.5 },   // top-left inner
      { x: 5.5, y: 3.0, d: 4.5 },   // bottom-right outer (5.5+4.5=10, 3.0+4.5=7.5)
      { x: 6.0, y: 3.5, d: 4.0 },   // bottom-right inner (6.0+4.0=10, 3.5+4.0=7.5)
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

    // TK Logo image (bottom-right) — logo includes company name + URL text
    const coverLogoData = await localFileBase64(LOGO_PATH);
    if (coverLogoData) {
      // Logo aspect ratio ~2.028:1; w=2.8 → h≈1.38
      slide.addImage({ data: coverLogoData, x: 7.0, y: 6.1, w: 2.8, h: 1.38 });
    } else {
      slide.addText("TK ELECTRIC LLC.\nwww.tkglobal.us", {
        x: 7.2, y: 6.5, w: 2.6, h: 0.75,
        fontSize: 10, bold: true, color: TK_GREEN,
        fontFace: "Calibri", align: "right",
      });
    }
  }

  // ── Slide 2: Table of Contents ────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };

    // Header bar
    slide.addShape(prs.ShapeType.rect, {
      x: 0, y: 0, w: SLIDE_W, h: 1.1,
      fill: { color: TK_GREEN }, line: { color: TK_GREEN },
    });
    slide.addText("TABLE OF CONTENTS", {
      x: 0.4, y: 0.1, w: 9.2, h: 0.9,
      fontSize: 28, bold: true, color: WHITE,
      fontFace: "Calibri", align: "left", valign: "middle",
    });

    // TK logo top-right on white area
    const tocLogoData = await localFileBase64(LOGO_PATH);
    if (tocLogoData) {
      slide.addImage({ data: tocLogoData, x: 7.8, y: 1.25, w: 1.9, h: 0.94 });
    }

    // TOC items
    const tocItems = [
      { num: "01", title: "Work Final Report" },
      { num: "02", title: "Quotation" },
      { num: "03", title: "Drawing" },
      { num: "04", title: "Work Picture" },
    ];

    const startY = 2.45;
    const rowH   = 1.05;

    for (let i = 0; i < tocItems.length; i++) {
      const item = tocItems[i];
      const y = startY + i * rowH;
      const isEven = i % 2 === 0;

      // Row background
      slide.addShape(prs.ShapeType.rect, {
        x: 0.4, y, w: 9.2, h: rowH - 0.08,
        fill: { color: isEven ? TK_GREEN_LIGHT : WHITE },
        line: { color: TK_GREEN_MID, pt: 0.5 },
      });

      // Number badge
      slide.addShape(prs.ShapeType.rect, {
        x: 0.4, y, w: 0.7, h: rowH - 0.08,
        fill: { color: TK_GREEN }, line: { color: TK_GREEN },
      });
      slide.addText(item.num, {
        x: 0.4, y: y + 0.02, w: 0.7, h: rowH - 0.12,
        fontSize: 16, bold: true, color: WHITE,
        fontFace: "Calibri", align: "center", valign: "middle",
      });

      // Title
      slide.addText(item.title, {
        x: 1.3, y: y + 0.02, w: 7.9, h: rowH - 0.12,
        fontSize: 16, bold: false, color: DARK,
        fontFace: "Calibri", valign: "middle",
      });
    }
  }

  // ── Slide 3: Work Final Report ────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    await addPageHeader(slide, prs, "WORK FINAL REPORT");

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

    // Items 1-5: individual rows at fixed, evenly-spaced Y positions
    const itemRowH = 0.36;
    const itemStartY = 1.57;
    const infoItems = [
      { num: "1.", label: "Project Name:",    value: project.name ?? "—" },
      { num: "2.", label: "PO Number:",       value: poNumber },
      { num: "3.", label: "Company Name:",    value: "TK ELECTRIC LLC." },
      { num: "4.", label: "Contract Item:",   value: contractIt },
      { num: "5.", label: "Work Description:", value: "" },
    ];
    for (let i = 0; i < infoItems.length; i++) {
      const item = infoItems[i];
      const iy = itemStartY + i * itemRowH;
      slide.addText(
        [
          { text: `${item.num}  `, options: { bold: true, color: DARK } },
          { text: `${item.label}  `, options: { bold: false, color: DARK } },
          { text: item.value, options: { bold: false, color: DARK } },
        ],
        {
          x: 0.7, y: iy, w: 8.6, h: itemRowH,
          fontSize: 11, fontFace: "Calibri", valign: "middle",
        }
      );
    }

    // Work description lines (indented under item 5)
    const descStartY = itemStartY + 5 * itemRowH;
    if (workDesc) {
      const lines = workDesc.split("\n").map((l: string) => `    - ${l.trim()}`).join("\n");
      slide.addText(lines, {
        x: 0.9, y: descStartY, w: 8.2, h: 1.4,
        fontSize: 10.5, color: DARK, fontFace: "Calibri",
        valign: "top",
      });
    }

    const statementY = workDesc ? descStartY + 1.5 : descStartY + 0.2;
    slide.addText(
      [
        { text: "We hereby report that the above work (", options: { bold: false } },
        { text: project.name ?? "", options: { bold: true } },
        { text: ") has been completed as described.", options: { bold: false } },
      ],
      {
        x: 0.9, y: statementY, w: 8.2, h: 0.7,
        fontSize: 11, color: DARK, fontFace: "Calibri",
        align: "center",
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

  // ── Slide 4: Quotation ────────────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    await addPageHeader(slide, prs, "QUOTATION");

    const qData = await imgBase64(report.quotationImageUrl);
    if (qData) {
      // Centered: (10 - 6.85) / 2 = 1.575; tight below header line at y:0.61
      slide.addImage({ data: qData, x: 1.575, y: 0.61, w: 6.85, h: 6.89 });
    } else {
      slide.addText("[ Quotation image not uploaded ]", {
        x: 0.3, y: 3.5, w: 9.4, h: 0.6,
        fontSize: 14, color: GRAY, fontFace: "Calibri", align: "center",
      });
    }
  }

  // ── Slide 5: Drawing ──────────────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    await addPageHeader(slide, prs, "DRAWING");
    addInfoTable(slide, project, report);

    slide.addText("Drawing", {
      x: 0.3, y: 1.68, w: 9.4, h: 0.35,
      fontSize: 13, bold: false, color: DARK, fontFace: "Calibri", align: "center",
    });

    const dData = await imgBase64(report.drawingImageUrl);
    if (dData) {
      slide.addImage({ data: dData, x: 0.3, y: 2.05, w: 9.4, h: 5.2 });
    } else {
      slide.addText("[ Drawing image not uploaded ]", {
        x: 0.3, y: 4.5, w: 9.4, h: 0.6,
        fontSize: 13, color: GRAY, fontFace: "Calibri", align: "center",
      });
    }
  }

  // ── Slide 6+: Photo slides ─────────────────────────────────────────────────
  const photos = report.photos ?? [];
  const totalPhotoSlides = Math.ceil(Math.max(photos.length, 1) / photosPerSlide);

  for (let i = 0; i < Math.max(photos.length, 1); i += photosPerSlide) {
    const slideNum = Math.floor(i / photosPerSlide) + 1;
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    await addPageHeader(slide, prs, `WORK PICTURE  ${slideNum} / ${totalPhotoSlides}`);
    addInfoTable(slide, project, report);

    if (photos.length === 0) {
      slide.addText("[ No photos uploaded ]", {
        x: 0.3, y: 4.0, w: 9.4, h: 0.6,
        fontSize: 13, color: GRAY, fontFace: "Calibri", align: "center",
      });
      continue;
    }

    if (photosPerSlide === 2) {
      // ── 2-per-slide: side by side ──────────────────────────────────────────
      const photoY = 1.72;
      const photoH = 4.05;
      const metaH  = 0.42;
      const photoW = 4.55;
      const colX   = [0.3, 5.15];

      for (let col = 0; col < 2; col++) {
        const photo = photos[i + col];
        if (!photo) continue;
        const x = colX[col];

        const pData = await imgBase64(photo.photoUrl);
        if (pData) {
          slide.addImage({ data: pData, x, y: photoY, w: photoW, h: photoH });
        } else {
          slide.addShape(prs.ShapeType.rect, {
            x, y: photoY, w: photoW, h: photoH,
            fill: { color: "F0F0F0" }, line: { color: "CCCCCC", pt: 0.5 },
          });
        }
        slide.addShape(prs.ShapeType.rect, {
          x, y: photoY + photoH, w: photoW, h: metaH,
          fill: { color: "F8F8F8" }, line: { color: "CCCCCC", pt: 0.5 },
        });
        slide.addText(photo.description ?? "—", {
          x: x + 0.08, y: photoY + photoH + 0.04, w: photoW - 0.16, h: metaH - 0.08,
          fontSize: 8.5, color: DARK, fontFace: "Calibri", valign: "middle",
        });
      }
    } else {
      // ── 4-per-slide: 2×2 grid ──────────────────────────────────────────────
      const photoW = 4.55;
      const photoH = 2.38;
      const metaH  = 0.3;
      const colX   = [0.3, 5.15];
      const rowY   = [1.62, 4.3];

      for (let cell = 0; cell < 4; cell++) {
        const photo = photos[i + cell];
        if (!photo) continue;
        const col = cell % 2;
        const row = Math.floor(cell / 2);
        const x = colX[col];
        const y = rowY[row];

        const pData = await imgBase64(photo.photoUrl);
        if (pData) {
          slide.addImage({ data: pData, x, y, w: photoW, h: photoH });
        } else {
          slide.addShape(prs.ShapeType.rect, {
            x, y, w: photoW, h: photoH,
            fill: { color: "F0F0F0" }, line: { color: "CCCCCC", pt: 0.5 },
          });
        }
        slide.addShape(prs.ShapeType.rect, {
          x, y: y + photoH, w: photoW, h: metaH,
          fill: { color: "F8F8F8" }, line: { color: "CCCCCC", pt: 0.5 },
        });
        slide.addText(photo.description ?? "—", {
          x: x + 0.08, y: y + photoH + 0.03, w: photoW - 0.16, h: metaH - 0.06,
          fontSize: 7.5, color: DARK, fontFace: "Calibri", valign: "middle",
        });
      }
    }
  }

  const buffer = await prs.write({ outputType: "nodebuffer" }) as Buffer;
  return buffer;
}
