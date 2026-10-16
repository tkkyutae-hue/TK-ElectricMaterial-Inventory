/** Real shared Select and source CSS, synthetic options, no app/server/DB. */
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { buildFieldSelectScreens } from "./helpers/fieldSelectScreensHarness";

test("field-sized real Select opens, selects and scrolls without native browser errors", { timeout: 90000 }, async () => {
  const require = createRequire(import.meta.url);
  const css = execFileSync(process.execPath, [
    require.resolve("tailwindcss/lib/cli.js"), "-i", "client/src/index.css",
    "-c", "tailwind.config.ts", "--minify",
  ], { env: { PATH: process.env.PATH, HOME: "/tmp" }, maxBuffer: 2_000_000 }).toString()
    .replace(/@import[^;]*;/g, "");
  const output = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem}
        from "./client/src/components/ui/select";
      function Fixture(){
        const [value,setValue]=React.useState("all");
        return <div style={{padding:20,paddingTop:180}}>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger data-testid="select" className="w-[100px] h-10"><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>
              {Array.from({length:60},(_,i)=><SelectItem key={i} value={"option-"+i}>
                {"Option "+i+" — 합성 옵션 / Synthetic / Opción"}
              </SelectItem>)}
            </SelectContent>
          </Select>
          <output data-testid="value">{value}</output>
        </div>;
      }
      createRoot(document.getElementById("root")).render(<Fixture/>);
    ` },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 874 }, serviceWorkers: "block" });
      const requests: string[] = [], errors: string[] = [];
      await context.route("**/*", r => r.abort());
      const page = await context.newPage();
      page.on("request", r => requests.push(r.resourceType()));
      page.on("pageerror", e => errors.push(e.message));
      try {
        // No runtime notice suppression: native layout loops must fail this test.
        await page.setContent(`<style>${css}</style><div id="root"></div>`);
        await page.addScriptTag({ content: output.outputFiles[0].text });
        for (const theme of ["light", "dark"]) {
          await page.evaluate(t => document.documentElement.className = t, theme);
          for (let repeat = 0; repeat < 3; repeat++) {
            await page.getByTestId("select").click();
            await page.getByRole("option", { name: /^Option 25 —/ }).click();
            assert.equal(await page.getByTestId("value").textContent(), "option-25");
            await page.getByTestId("select").click();
            await page.getByRole("option", { name: "All", exact: true }).click();
            assert.equal(await page.getByTestId("value").textContent(), "all");
          }
        }
        assert.deepEqual(errors, [], `No native page errors at width ${width}`);
        assert.deepEqual(requests, [], "No app or external requests");
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test("real inventory and receive/issue forms select options with mocked services only", { timeout: 90000 }, async () => {
  const require = createRequire(import.meta.url);
  const css = execFileSync(process.execPath, [
    require.resolve("tailwindcss/lib/cli.js"), "-i", "client/src/index.css",
    "-c", "tailwind.config.ts", "--minify",
  ], { env: { PATH: process.env.PATH, HOME: "/tmp" }, maxBuffer: 2_000_000 }).toString()
    .replace(/@import[^;]*;/g, "");
  const script = await buildFieldSelectScreens();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1024, 1280]) for (const screen of ["inventory", "receive", "issue"]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1024 ? 680 : 874 }, serviceWorkers: "block" });
      const requests: string[] = [], errors: string[] = [];
      await context.route("**/*", r => r.abort());
      const page = await context.newPage();
      page.on("request", r => requests.push(r.resourceType()));
      page.on("pageerror", e => errors.push(e.message));
      try {
        await page.setContent(`<style>${css}</style><div id="root"></div>`);
        await page.evaluate(screen =>
          Object.assign(window, { __screen: screen, __lang: "ko", __theme: "dark", __io: 0 }), screen);
        await page.addScriptTag({ content: `{
          let rowId=0;
          crypto.randomUUID??=()=>"00000000-0000-4000-8000-"+String(++rowId).padStart(12,"0");
          const blocked=()=>{window.__io++;throw Error("Network forbidden")};
          window.fetch=blocked;window.XMLHttpRequest=blocked;window.WebSocket=blocked;navigator.sendBeacon=blocked;
        }` });
        await page.addScriptTag({ content: script });
        await page.evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
        assert.deepEqual(errors, [], `${screen}: initial render`);
        const ids = screen === "inventory"
          ? ["field-inv-size-filter", "field-inv-status-filter"]
          : ["select-movement-type"];
        for (const id of ids) {
          await page.getByTestId(id).click();
          // The reported failure happens on opening, not just after selection.
          // Let popper measurement and opening animations settle before choosing.
          await page.waitForTimeout(500);
          await page.getByRole("option").nth(1).click();
          await page.getByTestId(id).click();
          await page.waitForTimeout(750);
          await page.keyboard.press("Escape");
        }
        assert.deepEqual(errors, [], `${screen} / ${width}: no native runtime errors`);
        assert.deepEqual(requests, [], "No HTTP requests");
        assert.equal(await page.evaluate(() => (window as any).__io), 0);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});
