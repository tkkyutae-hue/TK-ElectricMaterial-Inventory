import path from "path";
import fs from "fs";
import type { CompletionReportWithSections } from "@shared/schema";
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

// Header bar height (green bar at top of every slide)
const HEADER_H = 0.65;

interface ImgData { data: string; width: number; height: number; }

async function imgBase64(url: string | null | undefined): Promise<ImgData | null> {
  if (!url) return null;
  try {
    const raw = url.startsWith("/uploads/") ? url.slice("/uploads/".length) : url;
    const filename = path.basename(raw);
    if (!filename) return null;

    let buf = await downloadBuffer(filename);
    if (!buf) {
      const localPath = path.join(process.cwd(), "uploads", filename);
      if (fs.existsSync(localPath)) buf = fs.readFileSync(localPath);
    }
    if (!buf) return null;

    // Auto-rotate based on EXIF and strip orientation tag so PowerPoint never double-rotates
    const sharp = (await import("sharp")).default;
    const rotated = await sharp(buf).rotate().jpeg({ quality: 90 }).toBuffer();
    const meta = await sharp(rotated).metadata();
    return {
      data: `data:image/jpeg;base64,${rotated.toString("base64")}`,
      width: meta.width ?? 1,
      height: meta.height ?? 1,
    };
  } catch {
    return null;
  }
}

/** Compute "contain" render size and centering offsets within a cell */
function containIn(imgW: number, imgH: number, cellW: number, cellH: number) {
  const scale = Math.min(cellW / imgW, cellH / imgH);
  const renderW = imgW * scale;
  const renderH = imgH * scale;
  return { renderW, renderH, dx: (cellW - renderW) / 2, dy: (cellH - renderH) / 2 };
}

/** Load, EXIF-rotate, and center-crop an image to exactly match cellW:cellH ratio */
async function imgCropped(url: string | null | undefined, cellW: number, cellH: number): Promise<string | null> {
  if (!url) return null;
  try {
    const raw = url.startsWith("/uploads/") ? url.slice("/uploads/".length) : url;
    const filename = path.basename(raw);
    if (!filename) return null;

    let buf = await downloadBuffer(filename);
    if (!buf) {
      const localPath = path.join(process.cwd(), "uploads", filename);
      if (fs.existsSync(localPath)) buf = fs.readFileSync(localPath);
    }
    if (!buf) return null;

    const targetW = 1440;
    const targetH = Math.max(1, Math.round(targetW * cellH / cellW));

    const sharp = (await import("sharp")).default;
    const cropped = await sharp(buf)
      .rotate()
      .resize(targetW, targetH, { fit: "cover", position: "centre" })
      .jpeg({ quality: 90 })
      .toBuffer();
    return `data:image/jpeg;base64,${cropped.toString("base64")}`;
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

// ── Auto photos-per-slide: pick tightest layout that fits all photos on 1 slide ──
function autoPps(photoCount: number): 2 | 4 | 6 | 8 {
  if (photoCount <= 2) return 2;
  if (photoCount <= 4) return 4;
  if (photoCount <= 6) return 6;
  return 8;
}

// ── Effective pps: 0 = auto ────────────────────────────────────────────────────
function effectivePps(section: { photosPerSlide: number; photos?: any[] }): 2 | 4 | 6 | 8 {
  const pps = section.photosPerSlide;
  if (pps === 0) return autoPps((section.photos ?? []).length);
  return ([2, 4, 6, 8] as const).includes(pps as any) ? (pps as 2 | 4 | 6 | 8) : 2;
}

// ── Page number text at bottom centre ──────────────────────────────────────────
function addPageNumber(slide: any, num: number, total: number) {
  slide.addText(`${num} / ${total}`, {
    x: 0, y: SLIDE_H - 0.22, w: SLIDE_W, h: 0.2,
    fontSize: 8, color: "AAAAAA", fontFace: "Calibri", align: "center",
  });
}

// ── Green header bar + logo (used on all content slides) ──────────────────────
async function addPageHeader(slide: any, prs: any, sectionLabel: string) {
  // Green bar
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: HEADER_H,
    fill: { color: TK_GREEN }, line: { color: TK_GREEN },
  });

  // Section label inside bar
  slide.addText(`■  ${sectionLabel}`, {
    x: 0.35, y: 0, w: 7.5, h: HEADER_H,
    fontSize: 13, bold: true, color: WHITE,
    fontFace: "Calibri", valign: "middle",
  });

  // Logo inside bar (right side)
  const logoData = await localFileBase64(LOGO_PATH);
  if (logoData) {
    slide.addImage({ data: logoData, x: 8.1, y: 0.04, w: 1.7, h: 0.57 });
  } else {
    slide.addText("TK ELECTRIC LLC.", {
      x: 7.5, y: 0, w: 2.3, h: HEADER_H,
      fontSize: 8, bold: true, color: WHITE,
      fontFace: "Calibri", align: "right", valign: "middle",
    });
  }
}

function addInfoTable(slide: any, project: any, report: CompletionReportWithSections) {
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
    x: 0.3, y: HEADER_H + 0.1, w: 9.4,
    fontSize: 9, fontFace: "Calibri",
    border: { pt: 0.5, color: TK_GREEN_MID },
    colW: [1.4, 3.3, 1.3, 3.4],
  });
}

export async function generateCompletionReportPptx(
  project: any,
  report: CompletionReportWithSections,
): Promise<Buffer> {
  const pptxgen = (await import("pptxgenjs")).default;
  const prs = new pptxgen();
  prs.layout = "LAYOUT_4x3";

  const sections = report.sections ?? [];
  const drawingSections = report.drawingSections ?? [];

  // ── Pre-calculate total page count ──────────────────────────────────────────
  // cover + TOC + WFR + Quotation + N drawing sections + photo sections
  const fixedPageCount = 4 + Math.max(drawingSections.length, 1); // always at least 1 drawing slot
  const sectionPageCounts = sections.map(s => {
    const photos = s.photos ?? [];
    const pps = autoPps(photos.length);
    return Math.ceil(Math.max(photos.length, 1) / pps);
  });
  const totalPages = fixedPageCount + sectionPageCounts.reduce((a, b) => a + b, 0);
  let pageNum = 0;

  // ── Slide 1: Cover ────────────────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    pageNum++;

    // Decorative arcs (drawn first so green bar appears on top)
    const arcs = [
      { x: 0.0, y: 0.0, d: 4.5 },
      { x: 0.5, y: 0.5, d: 4.5 },
      { x: 5.5, y: 3.0, d: 4.5 },
      { x: 6.0, y: 3.5, d: 4.0 },
    ];
    for (const a of arcs) {
      slide.addShape(prs.ShapeType.ellipse, {
        x: a.x, y: a.y, w: a.d, h: a.d,
        fill: { color: "F0FAE8" },
        line: { color: TK_GREEN_LIGHT, pt: 2 },
      });
    }

    // Green header bar at top
    slide.addShape(prs.ShapeType.rect, {
      x: 0, y: 0, w: SLIDE_W, h: HEADER_H,
      fill: { color: TK_GREEN }, line: { color: TK_GREEN },
    });

    // Logo inside header bar
    const coverLogoData = await localFileBase64(LOGO_PATH);
    if (coverLogoData) {
      slide.addImage({ data: coverLogoData, x: 8.1, y: 0.04, w: 1.7, h: 0.57 });
    } else {
      slide.addText("TK ELECTRIC LLC.", {
        x: 7.5, y: 0, w: 2.3, h: HEADER_H,
        fontSize: 8, bold: true, color: WHITE,
        fontFace: "Calibri", align: "right", valign: "middle",
      });
    }

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

    addPageNumber(slide, pageNum, totalPages);
  }

  // ── Slide 2: Table of Contents ────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    pageNum++;

    // Green bar (same height as all other slides)
    slide.addShape(prs.ShapeType.rect, {
      x: 0, y: 0, w: SLIDE_W, h: HEADER_H,
      fill: { color: TK_GREEN }, line: { color: TK_GREEN },
    });
    slide.addText("TABLE OF CONTENTS", {
      x: 0.35, y: 0, w: 7.5, h: HEADER_H,
      fontSize: 13, bold: true, color: WHITE,
      fontFace: "Calibri", align: "left", valign: "middle",
    });

    // Logo INSIDE the green bar (right side — matches addPageHeader)
    const tocLogoData = await localFileBase64(LOGO_PATH);
    if (tocLogoData) {
      slide.addImage({ data: tocLogoData, x: 8.1, y: 0.04, w: 1.7, h: 0.57 });
    } else {
      slide.addText("TK ELECTRIC LLC.", {
        x: 7.5, y: 0, w: 2.3, h: HEADER_H,
        fontSize: 8, bold: true, color: WHITE,
        fontFace: "Calibri", align: "right", valign: "middle",
      });
    }

    // TOC items: 01 WFR, 02 Quotation, 03..0N drawing sections, then photo sections
    const drawingTocItems = drawingSections.length > 0
      ? drawingSections.map((ds, i) => ({
          num: String(i + 3).padStart(2, "0"),
          title: ds.title || "Drawing",
        }))
      : [{ num: "03", title: "Drawing" }];
    const photoOffset = 2 + drawingTocItems.length + 1;
    const tocItems = [
      { num: "01", title: "Work Final Report" },
      { num: "02", title: "Quotation" },
      ...drawingTocItems,
      ...sections.map((s, i) => ({
        num: String(photoOffset + i).padStart(2, "0"),
        title: s.title || "Work Picture",
      })),
    ];

    const startY = tocItems.length <= 3 ? 2.45 : 2.0;
    const rowH   = tocItems.length <= 4 ? 1.05 : Math.min(1.05, (7.5 - startY - 0.3) / tocItems.length);

    for (let i = 0; i < tocItems.length; i++) {
      const item = tocItems[i];
      const y = startY + i * rowH;
      const isEven = i % 2 === 0;

      slide.addShape(prs.ShapeType.rect, {
        x: 0.4, y, w: 9.2, h: rowH - 0.08,
        fill: { color: isEven ? TK_GREEN_LIGHT : WHITE },
        line: { color: TK_GREEN_MID, pt: 0.5 },
      });

      slide.addShape(prs.ShapeType.rect, {
        x: 0.4, y, w: 0.7, h: rowH - 0.08,
        fill: { color: TK_GREEN }, line: { color: TK_GREEN },
      });
      slide.addText(item.num, {
        x: 0.4, y: y + 0.02, w: 0.7, h: rowH - 0.12,
        fontSize: 16, bold: true, color: WHITE,
        fontFace: "Calibri", align: "center", valign: "middle",
      });

      slide.addText(item.title, {
        x: 1.3, y: y + 0.02, w: 7.9, h: rowH - 0.12,
        fontSize: 16, bold: false, color: DARK,
        fontFace: "Calibri", valign: "middle",
      });
    }

    addPageNumber(slide, pageNum, totalPages);
  }

  // ── Slide 3: Work Final Report ────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    pageNum++;
    await addPageHeader(slide, prs, "01  WORK FINAL REPORT");

    const contentTop = HEADER_H + 0.1;

    slide.addShape(prs.ShapeType.rect, {
      x: 0.4, y: contentTop, w: 9.2, h: 6.5,
      fill: { color: WHITE },
      line: { color: DARK, pt: 1 },
    });

    slide.addText("Work Final Report", {
      x: 0.6, y: contentTop + 0.1, w: 8.8, h: 0.65,
      fontSize: 22, bold: false, color: DARK,
      fontFace: "Calibri", align: "center",
    });
    slide.addShape(prs.ShapeType.line, {
      x: 0.6, y: contentTop + 0.73, w: 8.8, h: 0,
      line: { color: "C0C0C0", pt: 0.5 },
    });

    const poNumber   = project.poNumber   ?? project.code ?? "—";
    const compDate   = report.completionDate ?? "—";
    const contractIt = report.contractItem  ?? "Electric Works";
    const workDesc   = report.workDescription ?? "";

    const itemRowH = 0.36;
    const itemStartY = contentTop + 0.83;
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

    addPageNumber(slide, pageNum, totalPages);
  }

  // ── Slide 4: Quotation ────────────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    pageNum++;
    await addPageHeader(slide, prs, "02  QUOTATION");

    const qData = await imgBase64(report.quotationImageUrl);
    if (qData) {
      const qCellW = 6.85, qCellH = SLIDE_H - HEADER_H - 0.25;
      const { renderW: qW, renderH: qH, dx: qDx, dy: qDy } = containIn(qData.width, qData.height, qCellW, qCellH);
      slide.addImage({ data: qData.data, x: 1.575 + qDx, y: HEADER_H + 0.05 + qDy, w: qW, h: qH });
    } else {
      slide.addText("[ Quotation image not uploaded ]", {
        x: 0.3, y: 3.5, w: 9.4, h: 0.6,
        fontSize: 14, color: GRAY, fontFace: "Calibri", align: "center",
      });
    }

    addPageNumber(slide, pageNum, totalPages);
  }

  // ── Drawing slides (one per drawing section) ─────────────────────────────
  const drawingSlides = drawingSections.length > 0
    ? drawingSections
    : [{ id: 0, title: "Drawing", imageUrl: report.drawingImageUrl ?? null, sortOrder: 0, reportId: report.id, createdAt: null }];
  const infoTableBottom = HEADER_H + 0.1 + 0.7;

  for (let di = 0; di < drawingSlides.length; di++) {
    const ds = drawingSlides[di];
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    pageNum++;
    const tocNum = String(di + 3).padStart(2, "0");
    await addPageHeader(slide, prs, `${tocNum}  ${(ds.title || "Drawing").toUpperCase()}`);
    addInfoTable(slide, project, report);

    slide.addText(ds.title || "Drawing", {
      x: 0.3, y: infoTableBottom + 0.15, w: 9.4, h: 0.35,
      fontSize: 13, bold: false, color: DARK, fontFace: "Calibri", align: "center",
    });

    const dData = await imgBase64(ds.imageUrl);
    if (dData) {
      const { renderW: dW, renderH: dH, dx: dDx, dy: dDy } = containIn(dData.width, dData.height, 9.4, 5.0);
      slide.addImage({ data: dData.data, x: 0.3 + dDx, y: infoTableBottom + 0.55 + dDy, w: dW, h: dH });
    } else {
      slide.addText("[ Drawing image not uploaded ]", {
        x: 0.3, y: 4.5, w: 9.4, h: 0.6,
        fontSize: 13, color: GRAY, fontFace: "Calibri", align: "center",
      });
    }

    addPageNumber(slide, pageNum, totalPages);
  }

  // ── Slide 6+: Photo sections ───────────────────────────────────────────────
  const CAP_H = 0.52;

  const PHOTO_LAYOUTS: Record<number, { photoW: number; photoH: number; cols: number; colX: number[]; rowY: number[] }> = {
    // 2장: 2col × 1row
    2: { photoW: 4.50, photoH: 5.20, cols: 2, colX: [0.45, 5.05], rowY: [1.58] },
    // 4장: 2col × 2row
    4: { photoW: 4.50, photoH: 2.29, cols: 2, colX: [0.45, 5.05], rowY: [1.58, 4.49] },
    // 6장: 3col × 2row
    6: { photoW: 2.97, photoH: 2.29, cols: 3, colX: [0.45, 3.52, 6.59], rowY: [1.58, 4.49] },
    // 8장: 4col × 2row
    8: { photoW: 2.20, photoH: 2.29, cols: 4, colX: [0.45, 2.75, 5.05, 7.35], rowY: [1.58, 4.49] },
  };

  for (let sectionIdx = 0; sectionIdx < sections.length; sectionIdx++) {
    const section = sections[sectionIdx];
    const photos = section.photos ?? [];
    const pps = autoPps(photos.length);
    const layout = PHOTO_LAYOUTS[pps];
    const { photoW, photoH, cols, colX, rowY } = layout;
    const sectionTitle = (section.title || "WORK PICTURE").toUpperCase();
    const sectionNum = String(sectionIdx + 2 + drawingSlides.length + 1).padStart(2, "0");
    const totalPhotoSlides = Math.ceil(Math.max(photos.length, 1) / pps);

    for (let i = 0; i < Math.max(photos.length, 1); i += pps) {
      const slideNum = Math.floor(i / pps) + 1;
      const slide = prs.addSlide();
      slide.background = { color: WHITE };
      pageNum++;
      await addPageHeader(slide, prs, `${sectionNum}  ${sectionTitle}  ${slideNum} / ${totalPhotoSlides}`);
      addInfoTable(slide, project, report);

      if (photos.length === 0) {
        slide.addText("[ No photos uploaded ]", {
          x: 0.45, y: 4.0, w: 9.1, h: 0.6,
          fontSize: 13, color: GRAY, fontFace: "Calibri", align: "center",
        });
        addPageNumber(slide, pageNum, totalPages);
        continue;
      }

      for (let cell = 0; cell < pps; cell++) {
        const photo = photos[i + cell];
        if (!photo) continue;
        const x = colX[cell % cols];
        const y = rowY[Math.floor(cell / cols)];

        const pData = await imgCropped(photo.photoUrl, photoW, photoH);
        if (pData) {
          slide.addImage({ data: pData, x, y, w: photoW, h: photoH });
        } else {
          slide.addShape(prs.ShapeType.rect, {
            x, y, w: photoW, h: photoH,
            fill: { color: "E8E8E8" }, line: { color: "D0D0D0", pt: 0.5 },
          });
        }

        // Caption bar
        slide.addShape(prs.ShapeType.rect, {
          x, y: y + photoH, w: photoW, h: CAP_H,
          fill: { color: "F4F4F4" }, line: { color: "E0E0E0", pt: 0.5 },
        });
        slide.addText(photo.description ?? "—", {
          x: x + 0.12, y: y + photoH + 0.06, w: photoW - 0.24, h: CAP_H - 0.06,
          fontSize: 9, color: "333333", fontFace: "Calibri", valign: "top",
        });
      }

      addPageNumber(slide, pageNum, totalPages);
    }
  }

  const buffer = await prs.write({ outputType: "nodebuffer" }) as Buffer;
  return buffer;
}
