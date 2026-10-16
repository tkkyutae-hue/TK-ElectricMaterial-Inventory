/**
 * Inline HTML guard only. No App, HTTP server, existing DB or external network.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, type Browser } from "playwright";

let browser: Browser;
const html = readFileSync("client/index.html", "utf8");
const script = html.match(/<script id="dev-resize-observer-guard">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, "Early guard must be present");
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
async function fixture(mode = "development") {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const requests: string[] = [], errors: string[] = [];
  const diagnostics: string[] = [];
  await context.route("**/*", r => r.abort());
  const page = await context.newPage();
  page.on("request", r => requests.push(r.resourceType()));
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => {
    if (m.text().startsWith("[dev-runtime-diagnostic]")) diagnostics.push(m.text());
  });
  await page.setContent(`<script>${script!.replaceAll("%MODE%", mode)}</script>
    <script>window.notices=[];window.addEventListener("error",e=>window.notices.push(e.message),true)</script>
    <div id="box" style="width:100px;height:10px"></div>`);
  return { page, errors, diagnostics, async finish() {
    assert.deepEqual(requests, [], "No network requests permitted");
    await context.close();
  }};
}

test("real Chromium ResizeObserver delivery loop does not become an uncaught app error", async () => {
  const f = await fixture();
  try {
    const callbacks = await f.page.evaluate(() => new Promise<number>(resolve => {
      const el = document.getElementById("box")!;
      let count = 0;
      const observer = new ResizeObserver(() => {
        el.style.width = `${100 + (++count % 2)}px`;
        if (count === 3) {
          observer.disconnect();
          requestAnimationFrame(() => resolve(count));
        }
      });
      observer.observe(el);
    }));
    assert.equal(callbacks, 3);
    assert.deepEqual(await f.page.evaluate(() => (window as any).notices), []);
    assert.deepEqual(f.errors, []);
    assert.ok(f.diagnostics.some(d => d.includes('"category":"resize-observer-delivery"')));
  } finally { await f.finish(); }
});

test("only the two native notices are filtered; genuine application errors remain visible", async () => {
  const f = await fixture();
  try {
    await f.page.evaluate(() => {
      const messages = [
        "ResizeObserver loop completed with undelivered notifications.",
        "ResizeObserver loop limit exceeded",
      ];
      for (const message of messages) window.dispatchEvent(new ErrorEvent("error", { message, cancelable: true }));
      window.dispatchEvent(new ErrorEvent("error", { message: "ResizeObserver initialization failed" }));
      window.dispatchEvent(new ErrorEvent("error", { message: messages[0], error: new Error(messages[0]) }));
      setTimeout(() => { throw new Error("Synthetic genuine application failure"); }, 0);
    });
    await f.page.waitForFunction(() => (window as any).notices.length === 3);
    const notices = await f.page.evaluate(() => (window as any).notices);
    assert.deepEqual(notices.slice(0, 2), [
      "ResizeObserver initialization failed",
      "ResizeObserver loop completed with undelivered notifications.",
    ]);
    assert.match(notices[2], /Synthetic genuine application failure/);
    assert.ok(f.errors.includes("Synthetic genuine application failure"));
  } finally { await f.finish(); }
});

test("production mode does not install the filter", async () => {
  const f = await fixture("production");
  try {
    await f.page.evaluate(() => window.dispatchEvent(new ErrorEvent("error", {
      message: "ResizeObserver loop completed with undelivered notifications.",
    })));
    assert.equal((await f.page.evaluate(() => (window as any).notices)).length, 1);
    assert.deepEqual(f.diagnostics, []);
  } finally { await f.finish(); }
});

test("diagnostics redact private payloads and URLs while retaining known code locations", async () => {
  const f = await fixture();
  try {
    await f.page.evaluate(() => {
      const privateText = "SYNTHETIC_PRIVATE_MARKER";
      window.dispatchEvent(new ErrorEvent("error", {
        message: privateText, error: new Error(privateText),
        filename: "https://private-host.invalid/src/components/MovementForm.tsx?token=" + privateText,
        lineno: 123, colno: 45,
      }));
      window.dispatchEvent(new ErrorEvent("error", {
        message: privateText, filename: "https://private-host.invalid/" + privateText + ".js",
      }));
      window.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.resolve(), reason: { password: privateText, employee: privateText },
      }));
    });
    const logs = f.diagnostics.join("\n");
    assert.doesNotMatch(logs, /SYNTHETIC_PRIVATE_MARKER|private-host|password|employee|token=/);
    assert.match(logs, /\/src\/components\/MovementForm.tsx/);
    assert.match(logs, /"line":123,"column":45/);
    assert.match(logs, /"source":"other-source"/);
    assert.match(logs, /"category":"non-error-rejection"/);
    assert.equal((await f.page.evaluate(() => (window as any).notices)).length, 2);
  } finally { await f.finish(); }
});

test("repeated diagnostics are bounded without stopping genuine error propagation", async () => {
  const f = await fixture();
  try {
    await f.page.evaluate(() => {
      for (let i = 0; i < 20; i++) {
        window.dispatchEvent(new ErrorEvent("error", { message: "Synthetic genuine error" }));
      }
    });
    assert.equal(f.diagnostics.filter(d => d.includes('"kind":"window-error"')).length, 3);
    assert.equal((await f.page.evaluate(() => (window as any).notices)).length, 20);
  } finally { await f.finish(); }
});
