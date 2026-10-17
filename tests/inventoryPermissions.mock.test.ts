/** Real UI + real useAuth/role policy, in-memory browser only, no app server. */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";
import { TRANSLATIONS } from "../client/src/lib/i18n";

let browser: Browser;
let script: string;
before(async () => {
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React,{useState} from "react"; import {createRoot} from "react-dom/client";
      import FieldHome from "./client/src/pages/field/FieldHome";
      import FieldMovement from "./client/src/pages/field/FieldMovement";
      import FieldInventory from "./client/src/pages/field/FieldInventory";
      import DraftMovementsList from "./client/src/pages/field/DraftMovementsList";
      import {FieldCartProvider,useFieldCart} from "./client/src/lib/fieldCart";
      import {TooltipProvider} from "./client/src/components/ui/tooltip";
      function Fixture(){
        const [,refresh]=useState(0); const cart=useFieldCart();
        window.setRole=(role,status="active")=>{window.account={id:"synthetic",role,status};refresh(n=>n+1)};
        return <TooltipProvider>
          <button data-testid="fixture-add-cart" onClick={()=>cart.addToCart({
            itemId:1,itemName:"Synthetic material",sku:"SYN",unit:"EA"},2)}>Synthetic add</button>
          <output data-testid="fixture-cart">{cart.cartItems.length}</output>
          {window.config.screen==="home"?<FieldHome/>:window.config.screen==="drafts"?<DraftMovementsList/>:
            window.config.screen==="inventory"?<FieldInventory/>:<FieldMovement/>}
        </TooltipProvider>
      }
      createRoot(document.getElementById("root")).render(<FieldCartProvider><Fixture/></FieldCartProvider>);
    `},
    bundle: true, write: false, metafile: true, platform: "browser", format: "iife", jsx: "automatic",
    plugins: [{ name: "no-service-boundaries", setup(p) {
      // use-auth itself is intentionally NOT mocked.
      p.onResolve({filter:/^(?:@\/hooks\/(?:use-language|use-field-theme|use-items|use-reference-data|use-toast)|@\/lib\/queryClient|@tanstack\/react-query|wouter)$/},
        () => ({path:"fixture",namespace:"synthetic"}));
      p.onLoad({filter:/.*/,namespace:"synthetic"}, () => ({
        loader:"tsx",resolveDir:process.cwd(),contents:`
          import {TRANSLATIONS} from "./client/src/lib/i18n";
          import {F_DARK,F_LIGHT} from "./client/src/lib/fieldTokens";
          const items=[{id:1,name:"Synthetic material",sku:"SYN",unitOfMeasure:"EA",quantityOnHand:100}];
          const drafts=[{id:1,movementType:"receive",status:"draft",savedBy:"synthetic",
            itemsJson:JSON.stringify([{itemId:1,qty:2,supplierId:1}])}];
          const empty=[];
          const data={"/api/drafts":drafts,"/api/suppliers":[{id:1,name:"Synthetic supplier"}],
            "/api/workers":empty,"/api/items":items,
            "/api/inventory/categories/summary":[{id:1,name:"Synthetic category",skuCount:1,totalQuantity:100}],
            "/api/field/items":{items,total:1},"/api/field/families":empty,"/api/projects":empty};
          const blocked=()=>{throw Error("Unplanned mutation")};
          export const useLanguage=()=>({t:TRANSLATIONS[window.config.lang],lang:window.config.lang});
          export const useFieldTheme=()=>({F:window.config.theme==="light"?F_LIGHT:F_DARK,theme:window.config.theme});
          export const useItems=()=>({data:items,isLoading:false,isError:false});
          export const useLocations=()=>({data:empty,isLoading:false});
          export const useProjects=()=>({data:empty,isLoading:false});
          export const useCreateLocation=()=>({mutate:blocked});
          export const useDeleteLocation=()=>({mutate:blocked});
          export const useToast=()=>({toast:()=>({dismiss:()=>{}})});
          export const useSearch=()=>window.config.screen==="movement"?"?type=receive&draftId=1":"";
          export const useLocation=()=>["/synthetic",path=>window.navigation.push(path)];
          const qc={invalidateQueries:async()=>{},setQueryData:()=>{}};
          export const queryClient=qc;
          export const useQueryClient=()=>qc;
          export const useMutation=()=>({mutate:blocked,isPending:false});
          export const apiRequest=blocked;
          export const useQuery=({queryKey,enabled})=>({
            data:enabled===false?undefined:queryKey[0]==="/api/auth/user"?window.account:
              queryKey[0]==="/api/drafts"&&queryKey[1]?drafts[0]:data[queryKey[0]]??empty,
            isLoading:false,isError:false,refetch:async()=>{}
          });
        `,
      }));
    }}],
  });
  assert.ok(!Object.keys(bundle.metafile!.inputs).some(p=>p.startsWith("server/")));
  assert.ok(Object.keys(bundle.metafile!.inputs).some(p=>p.endsWith("hooks/use-auth.ts")));
  script = bundle.outputFiles[0].text;
  browser = await chromium.launch({headless:true});
});
after(async () => { await browser?.close(); });

async function fixture(screen: string, role: string, width = 390, lang = "ko", theme = "dark") {
  const context = await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
  const requests: string[] = [], errors: string[] = [];
  await context.route("**/*", r=>r.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on("request", r=>requests.push(r.resourceType()));
  page.on("pageerror", e=>errors.push(e.message));
  await page.setContent('<div id="root"></div>');
  await page.evaluate(config=>{
    (window as any).config=config;
    (window as any).account={id:"synthetic",role:config.role,status:"active"};
  }, {screen,role,lang,theme});
  await page.addScriptTag({content:`
    window.calls=[];window.navigation=[];let id=0;crypto.randomUUID??=()=>String(++id);
    window.fetch=async(url,options={})=>{
      window.calls.push({url,method:options.method,body:options.body});
      return {ok:true,json:async()=>({id:900,movementIds:[900],deleted:[900]})};
    };
    window.XMLHttpRequest=window.WebSocket=function(){throw Error("Network forbidden")};
    navigator.sendBeacon=()=>{throw Error("Network forbidden")};
  `});
  await page.addScriptTag({content:script});
  await page.waitForTimeout(100);
  if (errors.length) {
    await context.close();
    assert.deepEqual(errors, [], "Synthetic UI render failed");
  }
  await page.getByTestId("fixture-add-cart").waitFor();
  return { page, async finish() {
    assert.deepEqual(errors, [], "No browser exceptions");
    assert.deepEqual(requests, [], "No actual network requests");
    await context.close();
  }};
}

test("real field home: movement tiles follow current roles; inventory/history remain", async () => {
  for (const role of ["viewer","manager_viewer","staff","manager","admin"]) {
    const f=await fixture("home",role);
    assert.equal(await f.page.getByTestId("tile-receive").count(),["manager","admin"].includes(role)?1:0);
    assert.equal(await f.page.getByTestId("tile-issue").count(),["manager","admin"].includes(role)?1:0);
    await f.finish();
  }
});
test("real form: denied roles cannot click/Enter/programmatic submit; staff retains request link", async () => {
  for (const role of ["viewer","manager_viewer","staff"]) {
    const f=await fixture("movement",role);
    await f.page.getByTestId("movement-permission-notice").waitFor();
    assert.equal(await f.page.getByTestId("button-submit-movement").isDisabled(),true);
    assert.equal(await f.page.getByTestId("button-save-draft").count(),0);
    await f.page.locator("textarea").fill("Synthetic unsaved note");
    await f.page.locator("textarea").press("Control+Enter");
    await f.page.locator("form").evaluate((form: HTMLFormElement)=>form.requestSubmit());
    await f.page.waitForTimeout(80);
    assert.deepEqual(await f.page.evaluate(()=>(window as any).calls),[]);
    assert.equal(await f.page.locator("textarea").inputValue(),"Synthetic unsaved note");
    if(role==="staff") {
      await f.page.getByTestId("movement-request-link").click();
      assert.deepEqual(await f.page.evaluate(()=>(window as any).navigation),["/field/inventory"]);
    } else assert.equal(await f.page.getByTestId("movement-request-link").count(),0);
    await f.finish();
  }
});
test("real form: manager/admin save normally; role revocation preserves typed contents", async () => {
  for (const role of ["manager","admin"]) {
    const f=await fixture("movement",role,1280);
    await f.page.getByTestId("button-save-draft").waitFor();
    await f.page.locator("textarea").fill("Synthetic retained note");
    await f.page.evaluate(()=>(window as any).setRole("staff"));
    await f.page.getByTestId("movement-permission-notice").waitFor();
    await f.page.locator("form").evaluate((form: HTMLFormElement)=>form.requestSubmit());
    await f.page.waitForTimeout(80);
    assert.equal(await f.page.locator("textarea").inputValue(),"Synthetic retained note");
    assert.deepEqual(await f.page.evaluate(()=>(window as any).calls),[]);
    await f.page.evaluate(()=>(window as any).setRole("manager","inactive"));
    assert.equal(await f.page.getByTestId("button-submit-movement").isDisabled(),true);
    assert.equal(await f.page.getByTestId("movement-request-link").count(),0);
    await f.page.evaluate(r=>(window as any).setRole(r),role);
    await f.page.getByTestId("button-submit-movement").click();
    await f.page.waitForFunction("window.calls.some(c=>c.url==='/api/movements')");
    await f.finish();
  }
});
test("real draft list: staff/viewers cannot confirm, managers/admins can; no draft is removed on denial", async () => {
  for (const role of ["staff","viewer","manager_viewer","manager","admin"]) {
    const f=await fixture("drafts",role);
    const confirm=f.page.getByTestId("button-confirm-draft-1");
    await confirm.waitFor();
    assert.equal(await confirm.isDisabled(),!["manager","admin"].includes(role));
    assert.equal(await f.page.getByTestId("draft-card-1").count(),1);
    assert.deepEqual(await f.page.evaluate(()=>(window as any).calls),[]);
    if(["manager","admin"].includes(role)){
      await confirm.click();
      await f.page.getByTestId("button-execute-confirm-draft").click();
      await f.page.waitForFunction("window.calls.some(c=>c.url==='/api/drafts/1/confirm')");
    } else assert.ok((await confirm.getAttribute("title"))?.length);
    await f.finish();
  }
});
test("real inventory request cart remains available to staff at mobile/desktop in all languages/themes", async () => {
  for (const width of [390,1280]) for (const lang of ["ko","en","es"]) for (const theme of ["dark","light"]) {
    const f=await fixture("inventory","staff",width,lang,theme);
    await f.page.getByTestId("fixture-add-cart").click();
    await f.page.getByTestId("field-cart-bar").waitFor();
    assert.equal(await f.page.getByTestId("fixture-cart").textContent(),"1");
    assert.deepEqual(await f.page.evaluate(()=>(window as any).calls),[]);
    await f.finish();
  }
});
test("three-language read-only notice renders in both themes and viewport sizes", async () => {
  for (const width of [390,1280]) for (const lang of ["ko","en","es"] as const) for (const theme of ["dark","light"]) {
    const f=await fixture("movement","staff",width,lang,theme);
    assert.ok((await f.page.getByTestId("movement-permission-notice").innerText()).includes(TRANSLATIONS[lang].stockMovementManagerOnly));
    await f.finish();
  }
});
