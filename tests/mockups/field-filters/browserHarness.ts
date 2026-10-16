/** Offline only: no workflow, HTTP listener, application bootstrap or DB. */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import type { Browser } from "playwright";

export async function bundleMock() {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import Mock from "./tests/mockups/field-filters/FieldFilterMockup";
      const root=createRoot(document.getElementById("root"));
      let version=0;
      window.mountMock=(props)=>root.render(<Mock key={++version} {...props}/>);
      window.mountMock(window.mockConfig);
    ` },
    bundle: true, write: false, outdir: "/tmp/field-filter-memory-build",
    platform: "browser", format: "iife", jsx: "automatic",
    metafile: true, define: { "process.env.NODE_ENV": '"development"' },
  });
  const imported = Object.keys(result.metafile!.inputs);
  assert.equal(imported.some(p => /^(?:client|server|shared)\//.test(p)), false,
    "Mock must not import any running app modules");
  assert.equal(imported.some(p => /(?:use-auth|queryClient|server\/db)/.test(p)), false);
  // Already-present local font; no download, installation or font configuration.
  // Embed in memory only so Korean captures do not silently render as boxes.
  const koreanFont = readFileSync("/nix/store/8l86j6p83q9n0m7gpk5jib86pq54qlq4-nanum-20200506/share/fonts/NanumBarunGothic.ttf").toString("base64");
  return {
    script: result.outputFiles.find(f => f.path.endsWith(".js"))!.text,
    css: (result.outputFiles.find(f => f.path.endsWith(".css"))?.text ?? "") +
      `\nbody{margin:0}@font-face{font-family:TKOfflineKorean;src:url(data:font/ttf;base64,${koreanFont}) format('truetype');font-display:block}
      .tk-field:lang(ko),.tk-field:lang(ko) *{font-family:TKOfflineKorean,sans-serif!important}`,
    logo: `data:image/png;base64,${readFileSync("attached_assets/tk_logo_1772726610288.png").toString("base64")}`,
  };
}

export async function mockPage(browser: Browser, bundle: Awaited<ReturnType<typeof bundleMock>>,
  width: number, language: string, theme: string) {
  const context = await browser.newContext({
    viewport: { width, height: 960 }, serviceWorkers: "block", reducedMotion: "reduce",
  });
  const attemptedRequests: string[] = [], errors: string[] = [];
  await context.route("**/*", route => route.abort());
  const page = await context.newPage();
  page.on("request", r => attemptedRequests.push(r.resourceType()));
  page.on("pageerror", e => errors.push(e.message));
  await page.setContent(`<html><head><style>${bundle.css}</style></head><body><div id="root"></div></body></html>`);
  await page.evaluate(config => { (window as any).mockConfig = config; }, {
    initialLanguage: language, initialTheme: theme, initialScenario: "normal", assets: { logo: bundle.logo },
  });
  await page.addScriptTag({ content: `{
    window.forbiddenIO=0;
    const block=()=>{window.forbiddenIO++;throw Error("External IO forbidden in isolated mock")};
    window.fetch=block;window.XMLHttpRequest=block;window.WebSocket=block;
    navigator.sendBeacon=block;
  }` });
  await page.addScriptTag({ content: bundle.script });
  await page.getByTestId("mock-root").waitFor();
  await page.evaluate("document.fonts.ready.then(()=>true)");
  return { page, async close() {
    try {
      assert.deepEqual(attemptedRequests, [], "No requests to an app or external service");
      assert.equal(await page.evaluate(() => (window as any).forbiddenIO), 0);
      assert.deepEqual(errors, [], "No uncaught mock UI errors");
    } finally { await context.close(); }
  }};
}
