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

async function imgBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const raw = url.startsWith("/uploads/") ? url.slice("/uploads/".length) : url;
    const filename = path.basename(raw);
    if (!filename) return null;

    const buf = await downloadBuffer(filename);
    if (buf) {
      const ext = path.extname(filename).toLowerCase().replace(".", "");
      const mimeMap: Record<string, string> = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" };
      const mime = mimeMap[ext] ?? "jpeg";
      return `data:image/${mime};base64,${buf.toString("base64")}`;
    }

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

  const logoData = await localFileBase64(LOGO_PATH);
  if (logoData) {
    slide.addImage({ data: logoData, x: 8.55, y: 0.02, w: 1.2, h: 0.59 });
  } else {
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
    x: 0.3, y: 0.75, w: 9.4,
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

  // ── Slide 1: Cover ────────────────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };

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

    const coverLogoData = await localFileBase64(LOGO_PATH);
    if (coverLogoData) {
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

    slide.addShape(prs.ShapeType.rect, {
      x: 0, y: 0, w: SLIDE_W, h: 1.1,
      fill: { color: TK_GREEN }, line: { color: TK_GREEN },
    });
    slide.addText("TABLE OF CONTENTS", {
      x: 0.4, y: 0.1, w: 9.2, h: 0.9,
      fontSize: 28, bold: true, color: WHITE,
      fontFace: "Calibri", align: "left", valign: "middle",
    });

    const tocLogoData = await localFileBase64(LOGO_PATH);
    if (tocLogoData) {
      slide.addImage({ data: tocLogoData, x: 7.8, y: 1.25, w: 1.9, h: 0.94 });
    }

    // TOC items: first 4 fixed, then one entry per section
    const sections = report.sections ?? [];
    const tocItems = [
      { num: "01", title: "Work Final Report" },
      { num: "02", title: "Quotation" },
      { num: "03", title: "Drawing" },
      ...sections.map((s, i) => ({
        num: String(i + 4).padStart(2, "0"),
        title: s.title || "Work Picture",
      })),
    ];

    const startY = sections.length <= 1 ? 2.45 : 2.0;
    const rowH   = sections.length <= 4 ? 1.05 : Math.min(1.05, (7.5 - startY - 0.3) / tocItems.length);

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
  }

  // ── Slide 3: Work Final Report ────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: WHITE };
    await addPageHeader(slide, prs, "WORK FINAL REPORT");

    slide.addShape(prs.ShapeType.rect, {
      x: 0.4, y: 0.75, w: 9.2, h: 6.5,
      fill: { color: WHITE },
      line: { color: DARK, pt: 1 },
    });

    slide.addText("Work Final Report", {
      x: 0.6, y: 0.85, w: 8.8, h: 0.65,
      fontSize: 22, bold: false, color: DARK,
      fontFace: "Calibri", align: "center",
    });
    slide.addShape(prs.ShapeType.line, {
      x: 0.6, y: 1.48, w: 8.8, h: 0,
      line: { color: "C0C0C0", pt: 0.5 },
    });

    const poNumber   = project.poNumber   ?? project.code ?? "—";
    const compDate   = report.completionDate ?? "—";
    const contractIt = report.contractItem  ?? "Electric Works";
    const workDesc   = report.workDescription ?? "";

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

  // ── Slide 6+: Photo sections ───────────────────────────────────────────────
  const sections = report.sections ?? [];

  for (const section of sections) {
    const photos = section.photos ?? [];
    const photosPerSlide = [2, 4, 6, 8].includes(section.photosPerSlide) ? section.photosPerSlide : 2;
    const sectionTitle = (section.title || "WORK PICTURE").toUpperCase();
    const totalPhotoSlides = Math.ceil(Math.max(photos.length, 1) / photosPerSlide);

    for (let i = 0; i < Math.max(photos.length, 1); i += photosPerSlide) {
      const slideNum = Math.floor(i / photosPerSlide) + 1;
      const slide = prs.addSlide();
      slide.background = { color: WHITE };
      await addPageHeader(slide, prs, `${sectionTitle}  ${slideNum} / ${totalPhotoSlides}`);
      addInfoTable(slide, project, report);

      if (photos.length === 0) {
        slide.addText("[ No photos uploaded ]", {
          x: 0.3, y: 4.0, w: 9.4, h: 0.6,
          fontSize: 13, color: GRAY, fontFace: "Calibri", align: "center",
        });
        continue;
      }

      if (photosPerSlide === 2) {
        // 2열 × 1행
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
            slide.addShape(prs.ShapeType.rect, { x, y: photoY, w: photoW, h: photoH, fill: { color: "F0F0F0" }, line: { color: "CCCCCC", pt: 0.5 } });
          }
          slide.addShape(prs.ShapeType.rect, { x, y: photoY + photoH, w: photoW, h: metaH, fill: { color: "F8F8F8" }, line: { color: "CCCCCC", pt: 0.5 } });
          slide.addText(photo.description ?? "—", { x: x + 0.08, y: photoY + photoH + 0.04, w: photoW - 0.16, h: metaH - 0.08, fontSize: 8.5, color: DARK, fontFace: "Calibri", valign: "middle" });
        }

      } else if (photosPerSlide === 4) {
        // 2열 × 2행
        const photoW = 4.55;
        const photoH = 2.38;
        const metaH  = 0.3;
        const colX   = [0.3, 5.15];
        const rowY   = [1.62, 4.3];

        for (let cell = 0; cell < 4; cell++) {
          const photo = photos[i + cell];
          if (!photo) continue;
          const x = colX[cell % 2];
          const y = rowY[Math.floor(cell / 2)];
          const pData = await imgBase64(photo.photoUrl);
          if (pData) {
            slide.addImage({ data: pData, x, y, w: photoW, h: photoH });
          } else {
            slide.addShape(prs.ShapeType.rect, { x, y, w: photoW, h: photoH, fill: { color: "F0F0F0" }, line: { color: "CCCCCC", pt: 0.5 } });
          }
          slide.addShape(prs.ShapeType.rect, { x, y: y + photoH, w: photoW, h: metaH, fill: { color: "F8F8F8" }, line: { color: "CCCCCC", pt: 0.5 } });
          slide.addText(photo.description ?? "—", { x: x + 0.08, y: y + photoH + 0.03, w: photoW - 0.16, h: metaH - 0.06, fontSize: 7.5, color: DARK, fontFace: "Calibri", valign: "middle" });
        }

      } else if (photosPerSlide === 6) {
        // 2열 × 3행
        const photoW = 4.55;
        const photoH = 1.58;
        const metaH  = 0.22;
        const rowGap  = photoH + metaH;
        const colX   = [0.3, 5.15];
        const rowY   = [1.62, 1.62 + rowGap, 1.62 + rowGap * 2];

        for (let cell = 0; cell < 6; cell++) {
          const photo = photos[i + cell];
          if (!photo) continue;
          const x = colX[cell % 2];
          const y = rowY[Math.floor(cell / 2)];
          const pData = await imgBase64(photo.photoUrl);
          if (pData) {
            slide.addImage({ data: pData, x, y, w: photoW, h: photoH });
          } else {
            slide.addShape(prs.ShapeType.rect, { x, y, w: photoW, h: photoH, fill: { color: "F0F0F0" }, line: { color: "CCCCCC", pt: 0.5 } });
          }
          slide.addShape(prs.ShapeType.rect, { x, y: y + photoH, w: photoW, h: metaH, fill: { color: "F8F8F8" }, line: { color: "CCCCCC", pt: 0.5 } });
          slide.addText(photo.description ?? "—", { x: x + 0.06, y: y + photoH + 0.03, w: photoW - 0.12, h: metaH - 0.06, fontSize: 7, color: DARK, fontFace: "Calibri", valign: "middle" });
        }

      } else {
        // 8장: 4열 × 2행
        const photoW = 2.25;
        const photoH = 2.38;
        const metaH  = 0.22;
        const colX   = [0.2, 2.65, 5.1, 7.55];
        const rowY   = [1.62, 1.62 + photoH + metaH];

        for (let cell = 0; cell < 8; cell++) {
          const photo = photos[i + cell];
          if (!photo) continue;
          const x = colX[cell % 4];
          const y = rowY[Math.floor(cell / 4)];
          const pData = await imgBase64(photo.photoUrl);
          if (pData) {
            slide.addImage({ data: pData, x, y, w: photoW, h: photoH });
          } else {
            slide.addShape(prs.ShapeType.rect, { x, y, w: photoW, h: photoH, fill: { color: "F0F0F0" }, line: { color: "CCCCCC", pt: 0.5 } });
          }
          slide.addShape(prs.ShapeType.rect, { x, y: y + photoH, w: photoW, h: metaH, fill: { color: "F8F8F8" }, line: { color: "CCCCCC", pt: 0.5 } });
          slide.addText(photo.description ?? "—", { x: x + 0.05, y: y + photoH + 0.03, w: photoW - 0.1, h: metaH - 0.06, fontSize: 6.5, color: DARK, fontFace: "Calibri", valign: "middle" });
        }
      }
    }
  }

  const buffer = await prs.write({ outputType: "nodebuffer" }) as Buffer;
  return buffer;
}
