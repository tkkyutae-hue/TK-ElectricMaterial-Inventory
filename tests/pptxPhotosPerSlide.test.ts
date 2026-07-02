import assert from "assert";
import JSZip from "jszip";
import { generateCompletionReportPptx } from "../server/services/completionReportPptx";
import type { CompletionReportWithSections, CompletionReportPhoto, CompletionReportSectionWithPhotos } from "@shared/schema";

const FIXED_SLIDES = 5; // Cover, TOC, Work Final Report, Quotation, Drawing

async function countSlidesInPptx(buf: Buffer): Promise<number> {
  const zip = await JSZip.loadAsync(buf);
  return Object.keys(zip.files).filter(
    (name) => /^ppt\/slides\/slide\d+\.xml$/.test(name),
  ).length;
}

function makePhoto(id: number): CompletionReportPhoto {
  return {
    id,
    reportId: 1,
    sectionId: 1,
    photoUrl: "/uploads/nonexistent.jpg",
    photoDate: null,
    description: `Photo ${id}`,
    sortOrder: id,
    createdAt: new Date(),
  };
}

function makeSection(
  id: number,
  photosPerSlide: 2 | 4 | 6 | 8,
  photoCount: number,
): CompletionReportSectionWithPhotos {
  const photos = Array.from({ length: photoCount }, (_, i) => makePhoto(i + 1));
  return {
    id,
    reportId: 1,
    title: `Section ${id}`,
    photosPerSlide,
    sortOrder: id,
    createdAt: new Date(),
    photos,
  };
}

function makeReport(
  sections: CompletionReportSectionWithPhotos[],
): CompletionReportWithSections {
  return {
    id: 1,
    projectId: 1,
    contractItem: "Electric Works",
    workDescription: "Test work",
    completionDate: "2026-07-02",
    quotationImageUrl: null,
    drawingImageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sections,
    photos: [],
  };
}

const mockProject = {
  id: 1,
  name: "Test Project",
  poNumber: "PO-001",
  startDate: "2026-01-01",
  endDate: "2026-07-01",
  jobLocation: "Seoul, KR",
};

interface TestCase {
  label: string;
  sections: CompletionReportSectionWithPhotos[];
  expectedPhotoSlides: number;
}

const cases: TestCase[] = [
  {
    label: "2-per-slide, 5 photos → ceil(5/2)=3 photo slides",
    sections: [makeSection(1, 2, 5)],
    expectedPhotoSlides: 3,
  },
  {
    label: "4-per-slide, 7 photos → ceil(7/4)=2 photo slides",
    sections: [makeSection(1, 4, 7)],
    expectedPhotoSlides: 2,
  },
  {
    label: "2-per-slide + 4-per-slide combined (5+7 photos) → 3+2=5 photo slides",
    sections: [makeSection(1, 2, 5), makeSection(2, 4, 7)],
    expectedPhotoSlides: 5,
  },
  {
    label: "2-per-slide, 0 photos → 1 placeholder slide (Math.max(0,1))",
    sections: [makeSection(1, 2, 0)],
    expectedPhotoSlides: 1,
  },
  {
    label: "4-per-slide, 0 photos → 1 placeholder slide (Math.max(0,1))",
    sections: [makeSection(1, 4, 0)],
    expectedPhotoSlides: 1,
  },
  {
    label: "4-per-slide, 4 photos → ceil(4/4)=1 photo slide",
    sections: [makeSection(1, 4, 4)],
    expectedPhotoSlides: 1,
  },
  {
    label: "2-per-slide, 4 photos → ceil(4/2)=2 photo slides",
    sections: [makeSection(1, 2, 4)],
    expectedPhotoSlides: 2,
  },
  {
    label: "4-per-slide, 5 photos → ceil(5/4)=2 photo slides",
    sections: [makeSection(1, 4, 5)],
    expectedPhotoSlides: 2,
  },
  {
    label: "4-per-slide, 8 photos → ceil(8/4)=2 photo slides",
    sections: [makeSection(1, 4, 8)],
    expectedPhotoSlides: 2,
  },
  {
    label: "6-per-slide, 7 photos → ceil(7/6)=2 photo slides",
    sections: [makeSection(1, 6, 7)],
    expectedPhotoSlides: 2,
  },
  {
    label: "8-per-slide, 9 photos → ceil(9/8)=2 photo slides",
    sections: [makeSection(1, 8, 9)],
    expectedPhotoSlides: 2,
  },
  {
    label: "6-per-slide, 5 photos → ceil(5/6)=1 photo slide",
    sections: [makeSection(1, 6, 5)],
    expectedPhotoSlides: 1,
  },
  {
    label: "no sections → 0 photo slides",
    sections: [],
    expectedPhotoSlides: 0,
  },
];

async function run(): Promise<void> {
  let passed = 0;
  let failed = 0;

  for (const tc of cases) {
    const report = makeReport(tc.sections);
    const expectedTotal = FIXED_SLIDES + tc.expectedPhotoSlides;

    try {
      const buf = await generateCompletionReportPptx(mockProject, report);
      const slideCount = await countSlidesInPptx(buf);

      assert.strictEqual(
        slideCount,
        expectedTotal,
        `Slide count mismatch: got ${slideCount}, expected ${expectedTotal} (${FIXED_SLIDES} fixed + ${tc.expectedPhotoSlides} photo)`,
      );

      console.log(`  PASS  ${tc.label}`);
      passed++;
    } catch (err: any) {
      console.error(`  FAIL  ${tc.label}`);
      console.error(`        ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
