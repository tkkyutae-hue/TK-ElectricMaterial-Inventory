import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:5000";
const VIEWPORTS = [320, 360, 390] as const;

type HeaderCase = {
  name: string;
  path: string;
  controls: string[];
  sectionLabel: string;
};

const HEADER_CASES: HeaderCase[] = [
  {
    name: "mode select",
    path: "/home",
    controls: ["btn-field-theme-switcher", "btn-language-switcher", "btn-home-logout"],
    sectionLabel: "OPERATIONS",
  },
  {
    name: "field home",
    path: "/field",
    controls: ["btn-field-theme-switcher", "btn-language-switcher", "btn-field-home"],
    sectionLabel: "INVENTORY MODE",
  },
  {
    name: "field sub-page",
    path: "/field/inventory",
    controls: [
      "btn-field-theme-switcher",
      "btn-language-switcher",
      "btn-field-back",
      "btn-field-home",
    ],
    sectionLabel: "INVENTORY MODE",
  },
  {
    name: "inventory sub-page",
    path: "/inventory",
    controls: [
      "btn-header-back",
      "btn-field-theme-switcher",
      "btn-language-switcher",
      "btn-header-back-home",
    ],
    sectionLabel: "ADMIN MODE",
  },
  {
    name: "project operations",
    path: "/crew-dispatch",
    controls: ["btn-field-theme-switcher", "btn-language-switcher", "btn-daily-report-back"],
    sectionLabel: "PROJECT OPERATIONS",
  },
];

async function login(page: import("playwright").Page) {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  assert.ok(email, "ADMIN_SEED_EMAIL is required for the authenticated mobile header check");
  assert.ok(password, "ADMIN_SEED_PASSWORD is required for the authenticated mobile header check");

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(password);
  await page.getByTestId("btn-login").click();
  await page.waitForURL("**/home");
}

test("mobile headers stay readable and reachable at 320, 360, and 390px", async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(async () => browser.close());

  const context = await browser.newContext({
    viewport: { width: VIEWPORTS[0], height: 844 },
  });
  const page = await context.newPage();
  await login(page);

  for (const width of VIEWPORTS) {
    await page.setViewportSize({ width, height: 844 });

    for (const headerCase of HEADER_CASES) {
      await page.goto(`${BASE_URL}${headerCase.path}`, { waitUntil: "networkidle" });
      const header = page.locator("header").first();
      await header.waitFor({ state: "visible" });

      const metrics = await header.evaluate((element) => {
        const headerBox = element.getBoundingClientRect();
        const brand = element.querySelector(".mode-header-brand");
        const brandBox = brand?.getBoundingClientRect();
        const brandName = brand?.querySelector("p");
        const brandNameBox = brandName?.getBoundingClientRect();
        const sectionLabel = element.querySelector(
          ".home-mode-header-operations, .field-header-mobile-detail, .app-header-mobile-detail, .project-header-mobile-detail",
        );
        const sectionBox = sectionLabel?.getBoundingClientRect();

        return {
          header: {
            right: headerBox.right,
            bottom: headerBox.bottom,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          },
          brand: brandBox && { right: brandBox.right, bottom: brandBox.bottom },
          brandName: brandNameBox && { height: brandNameBox.height },
          section: sectionBox && {
            width: sectionBox.width,
            height: sectionBox.height,
            bottom: sectionBox.bottom,
          },
          text: element.textContent ?? "",
        };
      });

      assert.equal(
        metrics.header.scrollWidth,
        metrics.header.clientWidth,
        `${headerCase.name} at ${width}px should not overflow horizontally`,
      );
      assert.ok(
        metrics.header.right <= width + 0.5,
        `${headerCase.name} at ${width}px should fit inside the viewport`,
      );
      assert.ok(metrics.brand, `${headerCase.name} should render its brand lockup`);
      assert.ok(
        metrics.brand!.right <= width + 0.5 && metrics.brand!.bottom <= metrics.header.bottom + 0.5,
        `${headerCase.name} brand should stay inside the header at ${width}px`,
      );
      assert.ok(
        metrics.brandName && metrics.brandName.height < 24,
        `${headerCase.name} brand name should remain on one line at ${width}px`,
      );
      assert.ok(
        metrics.section &&
          metrics.section.width > 0 &&
          metrics.section.height < 20 &&
          metrics.section.bottom <= metrics.header.bottom + 0.5 &&
          metrics.text.toUpperCase().includes(headerCase.sectionLabel),
        `${headerCase.name} section label should remain visible on one line at ${width}px`,
      );

      for (const controlId of headerCase.controls) {
        const control = page.getByTestId(controlId);
        await control.waitFor({ state: "visible" });
        const controlBox = await control.boundingBox();
        assert.ok(controlBox, `${controlId} should be measurable at ${width}px`);
        assert.ok(controlBox.width >= 27 && controlBox.height >= 30, `${controlId} should remain reachable at ${width}px`);
        assert.ok(
          controlBox.x >= -0.5 &&
            controlBox.y >= -0.5 &&
            controlBox.x + controlBox.width <= width + 0.5 &&
            controlBox.y + controlBox.height <= metrics.header.bottom + 0.5,
          `${controlId} should stay inside the header at ${width}px`,
        );
      }
    }
  }
});