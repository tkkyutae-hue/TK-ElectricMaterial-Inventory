/**
 * Isolated browser test: bundles ONLY the cart provider/review with mocked
 * auth, queries, API calls, person picker, routing and toast. No app/server
 * entry point is imported. Browser network is blocked, including images.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { chromium, type Page } from "playwright";

const mockImports = /^(?:@\/hooks\/(?:use-language|use-toast|use-field-theme|use-auth)|@\/lib\/queryClient|@\/components\/shared\/PersonPicker|@tanstack\/react-query|wouter)$/;

async function bundleMockReview() {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `
        import React, {useState} from "react";
        import {createRoot} from "react-dom/client";
        import {FieldCartProvider, useFieldCart} from "./client/src/lib/fieldCart";
        import FieldCartReview from "./client/src/pages/field/FieldCartReview";
        import {TRANSLATIONS} from "./client/src/lib/i18n";
        const item = {itemId:901,itemName:"Mock material",sku:"MOCK",sizeLabel:null,
          requestedQty:3,unit:"ea",locationName:null,imageUrl:null};
        function Harness() {
          const cart = useFieldCart();
          const [open,setOpen] = useState(true);
          window.__cart = cart;
          const seed = () => cart.replaceDraft({
            items:[item], editingRequestId:901,editingRequestNumber:"REQ-MOCK",
            meta:{requestType:"issue",projectId:null,notes:"",requesterName:"",requesterRole:""}
          }, () => window.confirm(TRANSLATIONS[window.__config.lang].cartReplaceDraftConfirm));
          return <main style={{maxWidth:520, margin:"auto"}}>
            <button data-testid="toggle-panel" onClick={()=>setOpen(!open)}>Toggle panel</button>
            <button data-testid="seed-edit" onClick={seed}>Mock continue existing request</button>
            <button data-testid="add-item" onClick={()=>cart.addToCart(item,3)}>Mock add item</button>
            {open && <FieldCartReview onClose={()=>setOpen(false)}/>}
          </main>;
        }
        createRoot(document.getElementById("root")).render(
          <FieldCartProvider><Harness/></FieldCartProvider>
        );
      `,
    },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    plugins: [{
      name: "no-live-services",
      setup(plugin) {
        plugin.onResolve({ filter: mockImports }, () => ({ path: "mocks", namespace: "isolated" }));
        plugin.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({
          loader: "tsx", resolveDir: process.cwd(), contents: `
            import React from "react";
            import {TRANSLATIONS} from "./client/src/lib/i18n";
            import {F_DARK,F_LIGHT} from "./client/src/lib/fieldTokens";
            window.__calls = []; window.__toasts = [];
            export const useLanguage = () => ({t:TRANSLATIONS[window.__config.lang]});
            export const useFieldTheme = () => ({F:window.__config.theme==="light"?F_LIGHT:F_DARK});
            export const useAuth = () => ({user:null});
            export const useLocation = () => ["/mock",()=>{}];
            export const useToast = () => ({toast:(value)=>{
              window.__toasts.push(value); return {dismiss:()=>{}};
            }});
            export const useQueryClient = () => ({invalidateQueries:()=>{}});
            export const useQuery = ({queryKey}) => ({
              data:queryKey[0]==="/api/projects"?[{id:902,name:"Mock project"}]:[]
            });
            export const apiRequest = async (method,url,body) => {
              window.__calls.push({method,url,body});
              if(window.__defer) await new Promise(resolve=>window.__resolve=resolve);
              if(window.__fail) throw new Error("Mock failure");
              return {json:async()=>({id:901})};
            };
            export const PersonPicker = ({value,onChange,testId}) =>
              <input data-testid={testId} value={value?.name??""}
                onChange={e=>onChange(e.target.value?{name:e.target.value,role:"Mock role"}:null)}/>;
          `,
        }));
        // Fail closed if the bundle ever gains a server dependency.
        plugin.onResolve({ filter: /(?:^|\/)server(?:\/|$)|^node:|^pg$|^@neondatabase\// }, args => {
          throw new Error("Forbidden dependency in isolated browser test: " + args.path);
        });
      },
    }],
  });
  return result.outputFiles[0].text;
}

async function readDraft(page: Page) {
  return page.evaluate(() => (window as any).__cart.getDraft());
}

test("mock-only cart review: three languages, two themes, mobile/desktop, lifecycle and replacement", async () => {
  const script = await bundleMockReview();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const lang of ["en", "ko", "es"]) {
      for (const theme of ["dark", "light"]) {
        for (const width of [320, 1280]) {
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          const network: string[] = [];
          const errors: string[] = [];
          page.on("request", req => network.push(req.resourceType()));
          page.on("pageerror", err => errors.push(err.message));
          await page.route("**/*", route => route.abort());
          await page.setContent(`<html><head><style>
            *{box-sizing:border-box}body{margin:0}p{margin:0}
          </style></head><body><div id="root"></div></body></html>`);
          await page.evaluate(config => { (window as any).__config = config; }, { lang, theme });
          await page.addScriptTag({ content: script });
          await page.getByTestId("new-request-banner").waitFor();

          // New request: latest full form and items survive actual panel unmount.
          await page.getByTestId("add-item").click();
          await page.getByTestId("qty-input-cart").fill("7");
          await page.getByTestId("select-project").selectOption("902");
          await page.getByTestId("input-requester").fill("Mock requester");
          await page.getByTestId("cart-notes-input").fill("Latest mock notes");
          await page.getByTestId("btn-reqtype-transfer").click();
          const newDraft = await readDraft(page);
          assert.equal(newDraft.items[0].requestedQty, 7);
          assert.deepEqual(newDraft.meta, {
            projectId: 902, requesterName: "Mock requester", requesterRole: "Mock role",
            notes: "Latest mock notes", requestType: "transfer",
          });
          await page.getByTestId("btn-cart-cancel").click();
          await page.getByTestId("toggle-panel").click();
          assert.deepEqual(await readDraft(page), newDraft);
          assert.equal(await page.getByTestId("cart-notes-input").inputValue(), "Latest mock notes");
          assert.equal(await page.getByTestId("input-requester").inputValue(), "Mock requester");
          assert.equal(await page.getByTestId("select-project").inputValue(), "902");

          // Switching an existing draft can be cancelled with no local or API change.
          page.once("dialog", dialog => dialog.dismiss());
          await page.getByTestId("seed-edit").click();
          assert.deepEqual(await readDraft(page), newDraft);
          page.once("dialog", dialog => dialog.accept());
          await page.getByTestId("seed-edit").click();
          assert.match(await page.getByTestId("edit-mode-banner").innerText(), /REQ-MOCK/);

          // Identical continuation does not prompt; full editing form persists.
          let redundantPrompt = false;
          page.once("dialog", async dialog => { redundantPrompt = true; await dialog.dismiss(); });
          await page.getByTestId("seed-edit").click();
          assert.equal(redundantPrompt, false);
          page.removeAllListeners("dialog");
          await page.getByTestId("select-project").selectOption("902");
          await page.getByTestId("input-requester").fill("Mock edited requester");
          await page.getByTestId("cart-notes-input").fill("Edited mock notes");
          await page.getByTestId("btn-reqtype-transfer").click();
          const editedDraft = await readDraft(page);
          await page.getByTestId("btn-cart-cancel").click();
          await page.getByTestId("toggle-panel").click();
          assert.deepEqual(await readDraft(page), editedDraft);
          assert.equal(await page.getByTestId("cart-notes-input").inputValue(), "Edited mock notes");

          await page.getByTestId("btn-cart-remove-901").click();
          assert.equal((await readDraft(page)).items.length, 0);
          assert.deepEqual((await readDraft(page)).meta, editedDraft.meta);
          await page.getByTestId("btn-end-request-edit").waitFor();
          await page.getByTestId("add-item").click();

          // Clear all items leaves editing mode AND all metadata in place.
          page.once("dialog", dialog => dialog.accept());
          await page.getByTestId("btn-cart-clear-all").click();
          const emptyEdit = await readDraft(page);
          assert.equal(emptyEdit.items.length, 0);
          assert.deepEqual(emptyEdit.meta, editedDraft.meta);
          assert.match(await page.getByTestId("edit-mode-banner").innerText(), /REQ-MOCK/);
          assert.equal(await page.getByTestId("btn-submit-request").isDisabled(), true);
          await page.getByTestId("btn-cart-cancel").click();
          await page.getByTestId("toggle-panel").click();
          await page.getByTestId("btn-end-request-edit").waitFor();
          const bounds = await page.getByTestId("btn-end-request-edit").boundingBox();
          assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

          // Ending editing is local only; cancel preserves it, accept resets all.
          page.once("dialog", dialog => dialog.dismiss());
          await page.getByTestId("btn-end-request-edit").click();
          assert.deepEqual(await readDraft(page), emptyEdit);
          page.once("dialog", dialog => dialog.accept());
          await page.getByTestId("btn-end-request-edit").click();
          await page.getByTestId("new-request-banner").waitFor();
          assert.equal((await readDraft(page)).editingRequestId, null);
          assert.equal((await readDraft(page)).meta.requesterName, "");
          assert.equal(await page.evaluate(() => (window as any).__calls.length), 0);
          assert.deepEqual(network, [], "The mock page must never use the network");
          assert.deepEqual(errors, []);
          await page.close();
        }
      }
    }

    // Failed and delayed submissions use mock API only, never a real endpoint.
    const page = await browser.newPage();
    await page.route("**/*", route => route.abort());
    await page.setContent('<div id="root"></div>');
    await page.evaluate(() => { (window as any).__config = { lang: "ko", theme: "dark" }; });
    await page.addScriptTag({ content: script });
    await page.getByTestId("add-item").click();
    await page.getByTestId("cart-notes-input").fill("Keep after mock failure");
    const before = await readDraft(page);
    await page.evaluate(() => { (window as any).__fail = true; });
    await page.getByTestId("btn-submit-request").click();
    await page.waitForFunction(() => (window as any).__toasts.length === 1);
    assert.deepEqual(await readDraft(page), before);
    await page.evaluate(() => { (window as any).__fail = false; (window as any).__defer = true; });
    await page.getByTestId("btn-submit-request").click();
    await page.waitForFunction(() => !!(window as any).__resolve);
    await page.getByTestId("cart-notes-input").fill("New work during mock request");
    await page.evaluate(() => { (window as any).__defer = false; (window as any).__resolve(); });
    await page.waitForFunction(() => (window as any).__toasts.length === 2);
    assert.equal((await readDraft(page)).meta.notes, "New work during mock request");
    const calls = await page.evaluate(() => (window as any).__calls);
    assert.equal(calls.length, 2);
    assert.ok(calls.every((call: any) => call.method === "POST"));

    // Clearing the last item never turns an existing edit into a POST.
    page.once("dialog", dialog => dialog.accept());
    await page.getByTestId("seed-edit").click();
    await page.getByTestId("btn-cart-remove-901").click();
    await page.getByTestId("add-item").click();
    await page.getByTestId("btn-submit-request").click();
    await page.waitForFunction(() => (window as any).__toasts.length === 3);
    const editCall = await page.evaluate(() => (window as any).__calls.at(-1));
    assert.equal(editCall.method, "PATCH");
    assert.equal(editCall.url, "/api/field/requests/901");
    assert.equal((await readDraft(page)).editingRequestId, null);
    await page.close();
  } finally {
    await browser.close();
  }
});
