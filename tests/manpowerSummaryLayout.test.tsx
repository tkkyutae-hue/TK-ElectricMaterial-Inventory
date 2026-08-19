import assert from "node:assert/strict";
import { DOMMatrix } from "@napi-rs/canvas";
import { chromium, type Browser } from "playwright";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TRANSLATIONS, type Lang } from "../client/src/lib/i18n";
import { ManpowerSummaryBar } from "../client/src/pages/daily-report/ManpowerSummaryBar";

const MOBILE_VIEWPORT = { width: 320, height: 720 };
const MOBILE_WORKER_CARD_VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 375, height: 720 },
] as const;
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
let MobileManpowerCard: React.ComponentType<any>;

const elementIds = [
  "manpower-summary-label",
  "manpower-summary-present-label",
  "manpower-summary-present-value",
  "manpower-summary-exceptions-label",
  "manpower-summary-exceptions-value",
  "manpower-summary-total-hours-label",
  "manpower-summary-total-hours-value",
  "manpower-summary-exception-badge",
] as const;

function renderSummary(language: Lang, isMobile: boolean): string {
  return renderToStaticMarkup(
    <main style={{ width: "100%" }}>
      <ManpowerSummaryBar
        t={TRANSLATIONS[language]}
        isMobile={isMobile}
        presentCount={12}
        exceptionsCount={3}
        totalManhours={93.5}
      />
    </main>,
  );
}

function renderMobileWorkerCards(quickMode: boolean): string {
  const workers = [
    { id: 1, fullName: "Alexandria Montgomery", trade: "Assistant Manager", isActive: true },
    { id: 2, fullName: "Christopher Whitfield", trade: "Project Engineer", isActive: true },
  ] as any[];
  const rows = [
    {
      id: 1, workerId: 1, workerName: workers[0].fullName, trade: workers[0].trade,
      attendanceStatus: "ATTEND", startTime: "07:00", endTime: "17:00", hoursWorked: 9, notes: "",
    },
    {
      id: 2, workerId: 2, workerName: workers[1].fullName, trade: workers[1].trade,
      attendanceStatus: "OFF", startTime: "", endTime: "", hoursWorked: 0, notes: "",
    },
  ];

  return renderToStaticMarkup(
    <main style={{ width: "100%", padding: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((row, index) => (
          <MobileManpowerCard
            key={row.id}
            row={row}
            index={index}
            allWorkers={workers}
            takenIds={new Set(rows.filter((other) => other.id !== row.id).map((other) => other.workerId))}
            quickMode={quickMode}
            onChange={() => {}}
            onRemove={() => {}}
          />
        ))}
      </div>
    </main>,
  );
}

async function assertInsideCard(
  browser: Browser,
  language: Lang,
  viewport: { width: number; height: number },
  isMobile: boolean,
) {
  const page = await browser.newPage({ viewport });
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          html, body { margin: 0; width: 100%; }
          main { width: 100%; }
        </style>
      </head>
      <body>${renderSummary(language, isMobile)}</body>
    </html>
  `);

  const card = page.getByTestId("manpower-summary-bar");
  const cardBox = await card.boundingBox();
  assert.ok(cardBox, `${language}: summary card should be visible`);
  assert.ok(cardBox.width <= viewport.width, `${language}: summary card should not exceed the viewport`);

  for (const testId of elementIds) {
    const locator = page.getByTestId(testId);
    await assert.doesNotReject(() => locator.waitFor({ state: "visible" }), `${language}: ${testId} should be visible`);
    const box = await locator.boundingBox();
    assert.ok(box, `${language}: ${testId} should have a measurable layout box`);
    assert.ok(
      box.x >= cardBox.x - 0.5 &&
      box.y >= cardBox.y - 0.5 &&
      box.x + box.width <= cardBox.x + cardBox.width + 0.5 &&
      box.y + box.height <= cardBox.y + cardBox.height + 0.5,
      `${language}: ${testId} must remain inside the summary card`,
    );
  }

  return { page, cardBox };
}

function isInside(container: { x: number; y: number; width: number; height: number }, child: { x: number; y: number; width: number; height: number }): boolean {
  return (
    child.x >= container.x - 0.5 &&
    child.y >= container.y - 0.5 &&
    child.x + child.width <= container.x + container.width + 0.5 &&
    child.y + child.height <= container.y + container.height + 0.5
  );
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width - 0.5 &&
    a.x + a.width > b.x + 0.5 &&
    a.y < b.y + b.height - 0.5 &&
    a.y + a.height > b.y + 0.5;
}

async function assertMobileWorkerCards(
  browser: Browser,
  viewport: { width: number; height: number },
  quickMode: boolean,
) {
  const page = await browser.newPage({ viewport });
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          html, body { margin: 0; width: 100%; }
          button { font: inherit; }
          .w-8 { width: 2rem; }
          .h-8 { height: 2rem; }
        </style>
      </head>
      <body>${renderMobileWorkerCards(quickMode)}</body>
    </html>
  `);

  for (const [index, expected] of [
    { punch: "07:00 → 17:00", hours: "9.0h" },
    { punch: "—", hours: "—" },
  ].entries()) {
    const card = page.getByTestId(`mp-mobile-card-${index}`);
    const cardBox = await card.boundingBox();
    assert.ok(cardBox, `${viewport.width}px ${quickMode ? "Quick" : "regular"} mode: worker card ${index} should be visible`);
    assert.ok(cardBox.width <= viewport.width, `${viewport.width}px ${quickMode ? "Quick" : "regular"} mode: worker card ${index} should not exceed the viewport`);

    const rank = page.getByTestId(`mp-mobile-rank-${index}`);
    const punch = page.getByTestId(`mp-mobile-punch-time-${index}`);
    const hours = page.getByTestId(`mp-quick-hours-${index}`);
    const remove = page.getByTestId(`btn-remove-mp-${index}`);
    const worker = page.getByTestId(`input-mp-worker-${index}`);
    const status = page.getByTestId(`select-mp-status-${index}`);
    const controls = { rank, punch, hours, remove };

    assert.equal(await punch.textContent(), expected.punch, `worker card ${index} should show its punch range or placeholder`);
    assert.equal(await hours.textContent(), expected.hours, `worker card ${index} should show its total hours or placeholder`);

    const boxes: Record<keyof typeof controls | "worker" | "status", { x: number; y: number; width: number; height: number }> = {
      rank: (await rank.boundingBox())!,
      punch: (await punch.boundingBox())!,
      hours: (await hours.boundingBox())!,
      remove: (await remove.boundingBox())!,
      worker: (await worker.boundingBox())!,
      status: (await status.boundingBox())!,
    };
    for (const [name, box] of Object.entries(boxes)) {
      assert.ok(box, `${viewport.width}px ${quickMode ? "Quick" : "regular"} mode: ${name} should have a measurable layout box`);
      assert.ok(
        isInside(cardBox, box),
        `${viewport.width}px ${quickMode ? "Quick" : "regular"} mode: ${name} must remain inside worker card ${index}`,
      );
    }

    for (const [first, second] of [
      ["rank", "punch"],
      ["punch", "hours"],
      ["worker", "status"],
      ["status", "remove"],
    ] as const) {
      assert.ok(
        !overlaps(boxes[first], boxes[second]),
        `${viewport.width}px ${quickMode ? "Quick" : "regular"} mode: ${first} and ${second} must not overlap on worker card ${index}`,
      );
    }
  }

  await page.close();
}

async function run(): Promise<void> {
  // NewReportTab imports PdfViewer, whose pdf.js dependency expects browser canvas
  // globals during module initialization. The app's server PDF service uses the
  // same Node canvas implementation for this API.
  (globalThis as Record<string, unknown>).DOMMatrix ??= DOMMatrix;
  ({ MobileManpowerCard } = await import("../client/src/pages/daily-report/NewReportTab"));

  const browser = await chromium.launch({ headless: true });

  try {
    for (const language of ["en", "ko", "es"] as const) {
      const { page } = await assertInsideCard(browser, language, MOBILE_VIEWPORT, true);
      const t = TRANSLATIONS[language];

      await expectText(page, "manpower-summary-label", t.newReportMpSummary);
      await expectText(page, "manpower-summary-present-label", t.newReportMpPresent);
      await expectText(page, "manpower-summary-exceptions-label", t.newReportMpExceptions);
      await expectText(page, "manpower-summary-total-hours-label", t.newReportMpTotalHrs);
      await expectText(page, "manpower-summary-present-value", "12");
      await expectText(page, "manpower-summary-exceptions-value", "3");
      await expectText(page, "manpower-summary-total-hours-value", "93.5");
      await expectText(page, "manpower-summary-exception-badge", `⚠3 ${t.newReportMpFlagged}`);
      await page.close();

      console.log(`PASS mobile ${language}: translated labels, values, and exception badge fit`);
    }

    const { page, cardBox } = await assertInsideCard(browser, "es", DESKTOP_VIEWPORT, false);
    assert.ok(cardBox.height <= 42, "desktop: SUMMARY should remain a single row");
    assert.equal(await page.getByTestId("manpower-summary-bar").evaluate((element) => element.scrollWidth), await page.getByTestId("manpower-summary-bar").evaluate((element) => element.clientWidth), "desktop: SUMMARY should not overflow horizontally");
    await page.close();
    console.log("PASS desktop: SUMMARY remains one line");

    for (const viewport of MOBILE_WORKER_CARD_VIEWPORTS) {
      for (const quickMode of [true, false]) {
        await assertMobileWorkerCards(browser, viewport, quickMode);
        console.log(`PASS ${viewport.width}px ${quickMode ? "Quick" : "regular"} mobile mode: active and no-hours worker cards fit`);
      }
    }
  } finally {
    await browser.close();
  }
}

async function expectText(page: import("playwright").Page, testId: string, expected: string) {
  assert.equal(
    await page.getByTestId(testId).textContent(),
    expected,
    `${testId} should render its translated value`,
  );
}

run().catch((error) => {
  console.error("Manpower SUMMARY layout regression check failed:", error);
  process.exit(1);
});