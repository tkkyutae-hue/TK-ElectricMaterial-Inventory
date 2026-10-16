import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type Browser, type Page } from "playwright";
import { bundleMock, mockPage } from "./browserHarness";

let browser: Browser;
let bundle: Awaited<ReturnType<typeof bundleMock>>;
const observations: object[] = [];
before(async () => {
  bundle = await bundleMock();
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
  mkdirSync("tests/mockups/field-filters/review", { recursive: true });
  if (observations.length) writeFileSync("tests/mockups/field-filters/review/checks.json", JSON.stringify({
    syntheticDataOnly: true, appServerUsed: false, databaseUsed: false, observations,
  }, null, 2));
});

async function noOverflow(page: Page, label: string) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert.ok(sizes.document <= sizes.viewport + 1 && sizes.body <= sizes.viewport + 1,
    `${label}: horizontal overflow ${JSON.stringify(sizes)}`);
}

for (const width of [320, 390, 768, 1024, 1440]) {
  for (const language of ["ko", "en", "es"]) for (const theme of ["light", "dark"]) {
    test(`offline state matrix ${width}/${language}/${theme}`, { timeout: 45000 }, async () => {
      const f = await mockPage(browser, bundle, width, language, theme);
      try {
        for (const scenario of ["normal", "loading", "error", "empty", "missing-images", "broken-images", "long-names", "many-filters"]) {
          await f.page.getByTestId("scenario-select").selectOption(scenario);
          await f.page.waitForFunction(s => document.querySelector('[data-testid="mock-root"]')?.getAttribute("data-scenario") === s, scenario);
          await noOverflow(f.page, `${width}/${language}/${theme}/${scenario}`);
          if (["loading", "error", "empty"].includes(scenario)) {
            await f.page.getByTestId(`state-${scenario}`).waitFor({ state: "visible" });
          }
          if (scenario === "many-filters") {
            assert.equal(await f.page.locator('[data-testid^="remove-"]').count(), 8);
            assert.equal(await f.page.locator('[data-testid^="result-row-"]').count(), 1);
            await f.page.getByTestId("result-row-101").waitFor();
            assert.match(await f.page.getByTestId("results-count").innerText(), /^1\b/);
          }
          if (scenario === "missing-images" || scenario === "broken-images") {
            await f.page.locator(`[data-image-state="${scenario === "missing-images" ? "missing" : "broken"}"]`).first().waitFor();
          }
          observations.push({ width, language, theme, scenario, horizontalOverflow: false });
        }
        await f.page.getByTestId("scenario-select").selectOption("error");
        await f.page.getByTestId("retry").click();
        await f.page.getByTestId("state-error").waitFor({ state: "hidden" });
      } finally { await f.close(); }
    });
  }
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`filter interactions, focus and cart clearance at ${width}`, { timeout: 45000 }, async () => {
    const f = await mockPage(browser, bundle, width, "ko", "dark");
    try {
      const page = f.page;
      const categories = page.locator('button[data-testid^="category-"]:not([data-testid="category-toggle"])');
      const firstCategory = await categories.first().getAttribute("data-testid");
      await categories.first().click();
      await page.getByTestId("category-toggle").waitFor({ state: "visible" });
      await page.getByTestId("family-controls").waitFor({ state: "visible" });
      const familyBox = await page.getByTestId("family-controls").boundingBox();
      assert.ok(familyBox && familyBox.y >= 0 && familyBox.y < 960, "Classification step is not scrolled past");
      await page.getByTestId("detail-filters-trigger").focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByTestId("detail-filters-dialog");
      await dialog.waitFor();
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press("Tab");
        assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)), "Focus stays inside details");
      }
      await page.getByTestId("family-filter").selectOption("EMT");
      const brand = page.getByTestId("brand-filter");
      const options = await brand.locator("option").evaluateAll(nodes =>
        nodes.map(n => (n as HTMLOptionElement).value).filter(v => v && v !== "all"));
      assert.ok(options.length > 0, "Synthetic category supplies a selectable brand");
      await brand.selectOption(options[0]);
      await page.keyboard.press("Escape");
      assert.equal(await page.getByTestId("detail-filters-trigger").evaluate(el => el === document.activeElement), true);
      await page.getByTestId("remove-brand").waitFor();
      await page.getByTestId("remove-brand").click();
      await page.getByTestId("remove-brand").waitFor({ state: "hidden" });

      await page.getByTestId("detail-filters-trigger").click();
      await brand.selectOption(options[0]);
      await page.getByTestId("detail-filters-close").click();
      assert.ok(await page.getByTestId("detail-filters-trigger").evaluate(el => el === document.activeElement));
      await page.getByTestId("category-toggle").click();
      const other = page.locator(`button[data-testid^="category-"]:not([data-testid="category-toggle"]):not([data-testid="${firstCategory}"])`).first();
      await other.click();
      await page.getByTestId("remove-brand").waitFor({ state: "hidden" });
      await page.getByTestId("reset-filters").click();
      await page.getByTestId("search-input").fill("zz-no-synthetic-match-zz");
      await page.getByTestId("state-empty").waitFor();
      await page.getByTestId("remove-search").click();
      await page.getByTestId("state-empty").waitFor({ state: "hidden" });

      await page.locator('button[data-testid^="add-cart-"]').first().click();
      const bar = page.getByTestId("cart-bar");
      await bar.waitFor({ state: "visible" });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const lastRow = page.locator('[data-testid^="result-row-"]:visible').last();
      const rowRect = await lastRow.boundingBox(), barRect = await bar.boundingBox();
      assert.ok(rowRect && barRect && rowRect.y + rowRect.height <= barRect.y + 1, "Last result is not hidden behind cart");
      await page.getByTestId("cart-review-trigger").click();
      await page.getByTestId("cart-plus-101").click();
      assert.equal(await page.getByTestId("cart-quantity-101").textContent(), "2");
      await page.getByTestId("cart-review-close").click();
      await page.getByTestId("photo-101").click();
      await page.getByTestId("image-lightbox").waitFor();
      await page.keyboard.press("Escape");
      assert.ok(await page.getByTestId("photo-101").evaluate(el => el === document.activeElement));
      assert.ok(await page.getByTestId("add-cart-104").isDisabled(), "Zero stock is not a fetch error");
      assert.equal(await page.getByTestId("state-error").count(), 0);
      await noOverflow(page, `interaction ${width}`);
      observations.push({ width, filters: "passed", keyboardFocus: "passed", cartClearance: "passed" });
    } finally { await f.close(); }
  });
}

test("representative review screenshots, synthetic data only", async () => {
  mkdirSync("tests/mockups/field-filters/review", { recursive: true });
  for (const [width, lang, theme, name] of [
    [390, "ko", "dark", "mobile-dark-ko"],
    [1440, "en", "light", "desktop-light-en"],
    [768, "es", "dark", "tablet-dark-es"],
  ] as const) {
    const f = await mockPage(browser, bundle, width, lang, theme);
    try {
      await f.page.locator('button[data-testid^="add-cart-"]').first().click();
      await f.page.evaluate(() => window.scrollTo(0, 0));
      await f.page.screenshot({ path: `tests/mockups/field-filters/review/${name}.jpg`, type: "jpeg", quality: 78 });
      if (width !== 768) {
        await f.page.getByTestId("category-conduit").click();
        await f.page.getByTestId("family-quick-filter").selectOption("EMT");
        await f.page.evaluate(() => window.scrollTo(0, 0));
        await f.page.screenshot({ path: `tests/mockups/field-filters/review/${name}-selected.jpg`, type: "jpeg", quality: 78 });
        await f.page.getByTestId("results-count").evaluate(el => el.scrollIntoView({ block: "start" }));
        await f.page.screenshot({ path: `tests/mockups/field-filters/review/${name}-results.jpg`, type: "jpeg", quality: 78 });
      }
    } finally { await f.close(); }
  }
});
