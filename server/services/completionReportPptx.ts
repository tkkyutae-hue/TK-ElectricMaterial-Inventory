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

const VALID_CROP_POSITIONS: Record<string, string> = {
  centre: "centre",
  top: "top",
  bottom: "bottom",
  left: "left",
  right: "right",
};

/** Load, EXIF-rotate, optionally extract a manual crop region, then resize to fill the cell */
async function imgCropped(
  url: string | null | undefined,
  cellW: number,
  cellH: number,
  opts?: {
    cropFocus?: string | null;
    cropX?: number | null;
    cropY?: number | null;
    cropWidth?: number | null;
    cropHeight?: number | null;
  },
): Promise<string | null> {
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

    const sharp = (await import("sharp")).default;

    // Step 1: EXIF auto-rotate into a clean buffer
    const rotated = await sharp(buf).rotate().toBuffer();

    // Step 2: Apply manual crop if coords are present (percentages 0-100)
    const cx = opts?.cropX != null ? Number(opts.cropX) : null;
    const cy = opts?.cropY != null ? Number(opts.cropY) : null;
    const cw = opts?.cropWidth != null ? Number(opts.cropWidth) : null;
    const ch = opts?.cropHeight != null ? Number(opts.cropHeight) : null;
    const hasCrop = cx != null && cy != null && cw != null && ch != null && cw > 0 && ch > 0;

    let toResize: Buffer;
    if (hasCrop) {
      const meta = await sharp(rotated).metadata();
      const imgW = meta.width ?? 1;
      const imgH = meta.height ?? 1;
      const left   = Math.max(0, Math.round(cx! / 100 * imgW));
      const top    = Math.max(0, Math.round(cy! / 100 * imgH));
      const width  = Math.min(imgW - left, Math.max(1, Math.round(cw! / 100 * imgW)));
      const height = Math.min(imgH - top,  Math.max(1, Math.round(ch! / 100 * imgH)));
      toResize = await sharp(rotated).extract({ left, top, width, height }).toBuffer();
    } else {
      toResize = rotated;
    }

    // Step 3: Resize to PPT cell dimensions
    // - Manual crop present: fit "contain" + white background so the full cropped area is visible
    // - No crop: fit "cover" with focus position (fills cell, smart-crops edges)
    const targetW = 1440;
    const targetH = Math.max(1, Math.round(targetW * cellH / cellW));

    let final: Buffer;
    if (hasCrop) {
      // contain: full cropped area always visible, no clipping ever.
      // Cell is dynamically sized to match crop ratio so white space is minimal.
      final = await sharp(toResize)
        .resize(targetW, targetH, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 90 })
        .toBuffer();
    } else {
      // cover: no crop → fill cell edge-to-edge using focus position
      const position = (opts?.cropFocus && VALID_CROP_POSITIONS[opts.cropFocus])
        ? VALID_CROP_POSITIONS[opts.cropFocus]
        : "centre";
      final = await sharp(toResize)
        .resize(targetW, targetH, { fit: "cover", position })
        .jpeg({ quality: 90 })
        .toBuffer();
    }
    return `data:image/jpeg;base64,${final.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Get effective W/H aspect ratio of a photo, accounting for crop percentages */
async function getEffectiveRatio(photo: any): Promise<number> {
  const defaultRatio = 4 / 3;
  try {
    const url = photo?.photoUrl;
    if (!url) return defaultRatio;
    const raw = url.startsWith("/uploads/") ? url.slice("/uploads/".length) : url;
    const filename = path.basename(raw);
    if (!filename) return defaultRatio;

    let buf = await downloadBuffer(filename);
    if (!buf) {
      const localPath = path.join(process.cwd(), "uploads", filename);
      if (fs.existsSync(localPath)) buf = fs.readFileSync(localPath);
    }
    if (!buf) return defaultRatio;

    const sharp = (await import("sharp")).default;
    const rotated = await sharp(buf).rotate().toBuffer();
    const meta = await sharp(rotated).metadata();
    const imgW = meta.width ?? 1;
    const imgH = meta.height ?? 1;

    const cw = photo.cropWidth  != null ? Number(photo.cropWidth)  : null;
    const ch = photo.cropHeight != null ? Number(photo.cropHeight) : null;
    if (cw != null && ch != null && cw > 0 && ch > 0) {
      return Math.max(0.05, (cw / 100 * imgW) / (ch / 100 * imgH));
    }
    return imgW / imgH;
  } catch {
    return defaultRatio;
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

    const maxRowH  = 1.05;
    const available = SLIDE_H - HEADER_H - 0.3;          // usable height below header
    const rowH   = Math.min(maxRowH, available / tocItems.length);
    const totalH = rowH * tocItems.length;
    const startY = HEADER_H + (available - totalH) / 2;  // vertically centred

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
  const CAP_HDR_H   = 0.14;   // green "WORK DESCRIPTION" label strip
  const CAP_TXT_H   = 0.24;   // description text area below header
  const CAP_H       = CAP_HDR_H + CAP_TXT_H;   // total caption height = 0.38
  const ROW_GAP     = 0.10;
  const AVAIL_TOP   = 1.58;                  // y where photo rows start
  const AVAIL_BOT   = SLIDE_H - 0.22;        // y bottom limit (page-number clearance)

  // Column widths and x-positions only; row heights are computed dynamically per slide
  const PHOTO_LAYOUTS: Record<number, { photoW: number; cols: number; colX: number[] }> = {
    2: { photoW: 4.50, cols: 2, colX: [0.45, 5.05] },
    4: { photoW: 4.50, cols: 2, colX: [0.45, 5.05] },
    6: { photoW: 2.97, cols: 3, colX: [0.45, 3.52, 6.59] },
    8: { photoW: 2.20, cols: 4, colX: [0.45, 2.75, 5.05, 7.35] },
  };

  for (let sectionIdx = 0; sectionIdx < sections.length; sectionIdx++) {
    const section = sections[sectionIdx];
    const photos = section.photos ?? [];
    const pps = autoPps(photos.length);
    const layout = PHOTO_LAYOUTS[pps];
    const { photoW, cols, colX } = layout;
    const sectionTitle = (section.title || "WORK PICTURE").toUpperCase();
    const sectionNum = String(sectionIdx + 2 + drawingSlides.length + 1).padStart(2, "0");
    const totalPhotoSlides = Math.ceil(Math.max(photos.length, 1) / pps);

    for (let i = 0; i < Math.max(photos.length, 1); i += pps) {
      const slidePhotos = photos.slice(i, i + pps);
      const slideNum = Math.floor(i / pps) + 1;
      const slide = prs.addSlide();
      slide.background = { color: WHITE };
      pageNum++;
      const slideLabel = totalPhotoSlides > 1
        ? `${sectionNum}  ${sectionTitle}  ${slideNum} / ${totalPhotoSlides}`
        : `${sectionNum}  ${sectionTitle}`;
      await addPageHeader(slide, prs, slideLabel);
      addInfoTable(slide, project, report);

      if (photos.length === 0) {
        slide.addText("[ No photos uploaded ]", {
          x: 0.45, y: 4.0, w: 9.1, h: 0.6,
          fontSize: 13, color: GRAY, fontFace: "Calibri", align: "center",
        });
        addPageNumber(slide, pageNum, totalPages);
        continue;
      }

      // ── Uniform photo height: all rows on this slide get the same height ──
      const numRows = Math.ceil(slidePhotos.length / cols);
      const availH  = AVAIL_BOT - AVAIL_TOP - numRows * CAP_H - (numRows - 1) * ROW_GAP;
      const uniformH = Math.max(0.3, availH / numRows);

      const rowPhotoH = Array<number>(numRows).fill(uniformH);

      // Build rowY start positions
      const rowY: number[] = [];
      let curY = AVAIL_TOP;
      for (let r = 0; r < numRows; r++) {
        rowY.push(curY);
        curY += uniformH + CAP_H + (r < numRows - 1 ? ROW_GAP : 0);
      }
      // ─────────────────────────────────────────────────────────────────────

      for (let cell = 0; cell < slidePhotos.length; cell++) {
        const photo = slidePhotos[cell];
        if (!photo) continue;
        const row = Math.floor(cell / cols);
        const x   = colX[cell % cols];
        const y   = rowY[row];
        const photoH = rowPhotoH[row];

        const pData = await imgCropped(photo.photoUrl, photoW, photoH, {
          cropFocus: photo.cropFocus,
          cropX: photo.cropX != null ? Number(photo.cropX) : null,
          cropY: photo.cropY != null ? Number(photo.cropY) : null,
          cropWidth: photo.cropWidth != null ? Number(photo.cropWidth) : null,
          cropHeight: photo.cropHeight != null ? Number(photo.cropHeight) : null,
        });
        if (pData) {
          slide.addImage({ data: pData, x, y, w: photoW, h: photoH });
        } else {
          slide.addShape(prs.ShapeType.rect, {
            x, y, w: photoW, h: photoH,
            fill: { color: "E8E8E8" }, line: { color: "D0D0D0", pt: 0.5 },
          });
        }
        // Border overlay on top of image
        slide.addShape(prs.ShapeType.rect, {
          x, y, w: photoW, h: photoH,
          fill: { type: "none" },
          line: { color: "BBBBBB", pt: 0.75 },
        });

        // Caption: full background
        slide.addShape(prs.ShapeType.rect, {
          x, y: y + photoH, w: photoW, h: CAP_H,
          fill: { color: "F7F7F7" }, line: { color: "D8D8D8", pt: 0.5 },
        });
        // Caption: "WORK DESCRIPTION" green header strip
        slide.addShape(prs.ShapeType.rect, {
          x, y: y + photoH, w: photoW, h: CAP_HDR_H,
          fill: { color: TK_GREEN }, line: { color: TK_GREEN, pt: 0 },
        });
        slide.addText("WORK DESCRIPTION", {
          x: x + 0.10, y: y + photoH + 0.01, w: photoW - 0.20, h: CAP_HDR_H,
          fontSize: 6.5, color: WHITE, fontFace: "Calibri", bold: true, valign: "middle",
        });
        // Caption: description text
        slide.addText(photo.description ?? "—", {
          x: x + 0.10, y: y + photoH + CAP_HDR_H + 0.03, w: photoW - 0.20, h: CAP_TXT_H - 0.04,
          fontSize: 8.5, color: "333333", fontFace: "Calibri", valign: "top",
        });
      }

      addPageNumber(slide, pageNum, totalPages);
    }
  }

  const buffer = await prs.write({ outputType: "nodebuffer" }) as Buffer;
  return buffer;
}
