import assert from "node:assert/strict";
import { chromium, type Browser } from "playwright";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TRANSLATIONS, type Lang } from "../client/src/lib/i18n";
import { ManpowerSummaryBar } from "../client/src/pages/daily-report/ManpowerSummaryBar";

const MOBILE_VIEWPORT = { width: 320, height: 720 };
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

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

async function run(): Promise<void> {
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