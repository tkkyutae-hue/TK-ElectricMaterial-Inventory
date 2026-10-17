/**
 * Real MovementForm/Select and application CSS; synthetic services only.
 * No app bootstrap, DB imports, listeners, credentials or external requests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { chromium } from "playwright";
import { buildFieldSelectScreens } from "./helpers/fieldSelectScreensHarness";

test("actual field movement dropdown with CSS and an early error collector", { timeout: 90000 }, async () => {
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from "react"; import {createRoot} from "react-dom/client";
      import {MovementForm} from "./client/src/components/MovementForm";
      import {TooltipProvider} from "./client/src/components/ui/tooltip";
      createRoot(document.getElementById("root")).render(<TooltipProvider>
        <MovementForm defaultType="return" fieldMode onSuccess={()=>{}} onCancel={()=>{}}/>
      </TooltipProvider>);` },
    bundle: true, write: false, metafile: true, platform: "browser", format: "iife", jsx: "automatic",
    plugins: [{ name: "synthetic-services", setup(p) {
      p.onResolve({ filter: /^(?:@\/hooks\/(?:use-language|use-field-theme|use-auth|use-items|use-reference-data|use-toast)|@\/lib\/queryClient|@tanstack\/react-query|wouter)$/ },
        () => ({ path: "mock", namespace: "mock" }));
      p.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
        loader: "tsx", resolveDir: process.cwd(), contents: `
        import {TRANSLATIONS} from "./client/src/lib/i18n";
        import {F_DARK,F_LIGHT} from "./client/src/lib/fieldTokens";
        const items=[{id:1,sku:"SYN",name:"Synthetic material",unitOfMeasure:"EA",quantityOnHand:100}];
        const locations=[{id:1,name:"Synthetic warehouse"}],projects=[{id:1,name:"Synthetic project"}];
        const blocked=()=>{throw Error("Unexpected mutation")};
        export const useLanguage=()=>({t:TRANSLATIONS[window.testLanguage],lang:window.testLanguage});
        export const useFieldTheme=()=>({F:window.testTheme==="light"?F_LIGHT:F_DARK,theme:window.testTheme});
        export const useAuth=()=>({isAdminRole:true,user:{id:"synthetic",role:"admin"}});
        export const useToast=()=>({toast:()=>({dismiss:()=>{}})});
        export const useLocation=()=>["/synthetic",()=>{}];
        export const useItems=()=>({data:items,isLoading:false});
        export const useLocations=()=>({data:locations,isLoading:false});
        export const useProjects=()=>({data:projects,isLoading:false});
        export const useCreateLocation=()=>({mutate:blocked});
        export const useDeleteLocation=()=>({mutate:blocked});
        export const queryClient={invalidateQueries:async()=>{}};
        export const useQueryClient=()=>queryClient;
        export const apiRequest=blocked;
        const suppliers=[{id:1,name:"Synthetic supplier"}],empty=[];
        export const useQuery=({queryKey})=>({data:queryKey[0]==="/api/suppliers"?suppliers:empty,isLoading:false});
      ` }));
    } }],
  });
  assert.ok(!Object.keys(bundle.metafile!.inputs).some(p => /server\//.test(p)));
  const css = (await postcss([tailwindcss({ config: "./tailwind.config.ts" })])
    .process(readFileSync("client/src/index.css", "utf8"), { from: "client/src/index.css" })).css;
  const html = readFileSync("client/index.html", "utf8");
  const guard = html.match(/<script id="dev-resize-observer-guard">([\s\S]*?)<\/script>/)![1]
    .replaceAll("%MODE%", "development");
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1024]) {
      for (const theme of ["dark", "light"]) {
        for (const language of ["ko", "en", "es"]) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
          try {
            const network: string[] = [], errors: string[] = [];
            await context.route("**/*", r => r.abort());
            const page = await context.newPage();
            page.on("request", r => network.push(r.resourceType()));
            page.on("pageerror", e => errors.push(e.message));
            // Capture before the HTML guard, as a pre-injected preview monitor can.
            await page.setContent(`<script>
              window.earlyNotices=[];
              window.addEventListener("error",e=>window.earlyNotices.push(e.message),true);
              window.testLanguage=${JSON.stringify(language)};window.testTheme=${JSON.stringify(theme)};
              crypto.randomUUID??=()=>"synthetic";
              window.fetch=()=>{throw Error("Network forbidden")};
              window.XMLHttpRequest=window.WebSocket=function(){throw Error("Network forbidden")};
            </script><script>${guard}</script><style>${css}</style><div id="root"></div>`);
            await page.addScriptTag({ content: bundle.outputFiles[0].text });
            const trigger = page.getByTestId("select-movement-type");
            await trigger.waitFor();
            for (let i = 0; i < 3; i++) {
              await trigger.click();
              await page.getByRole("option").first().waitFor();
              await page.waitForTimeout(250);
              await page.getByRole("option").nth(i % 2).click();
            }
            console.log(JSON.stringify({
              width, theme, language, notices: await page.evaluate("window.earlyNotices"),
            }));
            assert.deepEqual(errors, []);
            assert.deepEqual(network, []);
          } finally { await context.close(); }
        }
      }
    }
  } finally { await browser.close(); }
});

test("real field screens remain usable in an iframe with an earlier error collector", { timeout: 90000 }, async () => {
  const script = await buildFieldSelectScreens();
  const css = (await postcss([tailwindcss({ config: "./tailwind.config.ts" })])
    .process(readFileSync("client/src/index.css", "utf8"), { from: "client/src/index.css" })).css;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const screen of ["inventory", "receive", "issue"]) {
      const context = await browser.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: "block" });
      try {
        const requests: string[] = [], errors: string[] = [];
        await context.route("**/*", r => r.abort());
        const page = await context.newPage();
        page.on("request", r => requests.push(r.resourceType()));
        page.on("pageerror", e => errors.push(e.message));
        await page.setContent('<iframe title="synthetic preview" style="width:1024px;height:680px"></iframe>');
        const frame = page.frames().find(f => f !== page.mainFrame())!;
        // Deliberately no suppression: native delivery notices must be observable.
        await frame.setContent(`<script>
          window.__screen=${JSON.stringify(screen)};window.__lang="ko";window.__theme="dark";window.__io=0;
          window.earlyNotices=[];
          window.addEventListener("error",e=>window.earlyNotices.push(e.message),true);
          let rowId=0;crypto.randomUUID??=()=>"synthetic-"+(++rowId);
          const blocked=()=>{window.__io++;throw Error("Network forbidden")};
          window.fetch=blocked;window.XMLHttpRequest=blocked;window.WebSocket=blocked;navigator.sendBeacon=blocked;
        </script><style>${css}</style><div id="root"></div>`);
        await frame.addScriptTag({ content: script });
        const ids = screen === "inventory"
          ? ["field-inv-size-filter", "field-inv-status-filter"] : ["select-movement-type"];
        for (const id of ids) {
          await frame.getByTestId(id).click();
          await frame.getByRole("option").first().waitFor();
          await page.waitForTimeout(500);
          await frame.getByRole("option").nth(1).click();
          await frame.getByTestId(id).click();
          await page.waitForTimeout(500);
          await page.keyboard.press("Escape");
        }
        assert.deepEqual(await frame.evaluate("window.earlyNotices"), [], screen);
        assert.deepEqual(errors, [], screen);
        assert.deepEqual(requests, []);
        assert.equal(await frame.evaluate("window.__io"), 0);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});
