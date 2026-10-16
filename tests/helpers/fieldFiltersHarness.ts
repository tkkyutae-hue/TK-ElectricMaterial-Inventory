import assert from "node:assert/strict";
import { build } from "esbuild";

/** Real page, query library and request functions; no app entry or DB imports. */
export async function buildFieldFilters() {
  const output = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {QueryClientProvider} from "@tanstack/react-query";
      import {queryClient} from "./client/src/lib/queryClient";
      import {TooltipProvider} from "./client/src/components/ui/tooltip";
      import FieldInventory from "./client/src/pages/field/FieldInventory";
      window.testClient=queryClient;
      createRoot(document.getElementById("root")).render(
        <QueryClientProvider client={queryClient}><TooltipProvider><FieldInventory/></TooltipProvider></QueryClientProvider>);
    `},
    bundle: true, write: false, metafile: true, platform: "browser", format: "iife", jsx: "automatic",
    plugins: [{ name: "isolated-services", setup(p) {
      p.onResolve({ filter: /^\.\/FieldCartPanel$/ }, () => ({ path: "panel", namespace: "panel" }));
      p.onLoad({ filter: /.*/, namespace: "panel" }, () => ({ contents: "export default ()=>null" }));
      p.onResolve({filter: /^(?:@\/hooks\/(?:use-language|use-field-theme|use-auth|use-items|use-reference-data)|@\/lib\/fieldCart|wouter)$/},
        () => ({ path: "hooks", namespace: "hooks" }));
      p.onLoad({ filter: /.*/, namespace: "hooks" }, () => ({ loader: "tsx", resolveDir: process.cwd(), contents: `
        import {TRANSLATIONS} from "./client/src/lib/i18n";
        import {F_DARK,F_LIGHT} from "./client/src/lib/fieldTokens";
        const navigate=(path)=>{window.lastNavigation=path};
        const blocked=()=>{throw Error("Business operation forbidden")};
        const mutation={mutate:blocked,mutateAsync:blocked,isPending:false};
        export const useLanguage=()=>({t:TRANSLATIONS[window.testLang],lang:window.testLang});
        export const useFieldTheme=()=>({theme:window.testTheme,F:window.testTheme==="dark"?F_DARK:F_LIGHT});
        export const useAuth=()=>({user:{id:"synthetic",role:"manager"},canDoMovements:true,isAdminRole:true});
        export const useSearch=()=>window.testSearch;
        export const useLocation=()=>["/field/inventory",navigate];
        export const useItems=()=>({data:[],isLoading:false});
        export const useLocations=()=>({data:[],isLoading:false});
        export const useProjects=()=>({data:[],isLoading:false});
        export const useCreateLocation=()=>mutation;
        export const useDeleteLocation=()=>mutation;
        export const useFieldCart=()=>({totalItems:0,totalQty:0,items:[],hasDraft:false,editingRequestId:null,
          getCartItem:()=>undefined,addToCart:blocked,removeFromCart:blocked});
      `}));
    }}],
  });
  const imports = Object.keys(output.metafile!.inputs);
  assert.ok(!imports.some(p => /server\/|client\/src\/main|clerk|replitAuth/.test(p)));
  assert.ok(imports.some(p => p.endsWith("FieldInventory.tsx")));
  assert.ok(imports.some(p => p.includes("@tanstack/query-core")));
  return output.outputFiles[0].text;
}

export async function mountFieldFilters(browser: any, bundle: string, options: any = {}) {
  const context = await browser.newContext({ viewport: { width: options.width || 1280, height: 960 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const network: string[] = [], errors: string[] = [];
  await context.route("**/*", (r: any) => r.abort());
  page.on("request", (r: any) => network.push(r.url()));
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.setContent('<div id="root"></div>');
  await page.evaluate((config: any) => {
    Object.assign(window, {
      testSearch: config.search || "?category=1&family=EMT&brand=A&type=Steel&size=1%2F2",
      testLang: config.lang || "en", testTheme: config.theme || "dark",
      failures: config.failures || [], calls: [], slow: false,
    });
  }, options);
  await page.addScriptTag({ content: `
    window.fetch=async (url,options={})=>{
      const u=new URL(url,"https://synthetic.invalid");
      window.calls.push({path:u.pathname,query:u.search,method:options.method||"GET"});
      if(options.method && options.method!=="GET")throw Error("Write forbidden");
      const q=u.searchParams.get("q");
      // Deliberately ignore abort for stale response: the query key must still isolate it.
      if(window.slow && q==="older") await new Promise(r=>setTimeout(r,600));
      if(window.failures.includes(u.pathname))return new Response(JSON.stringify({error:"synthetic failure"}),{status:503});
      let value;
      if(u.pathname==="/api/inventory/categories/summary")value=[
        {id:1,name:"Synthetic One",code:"TEST1",skuCount:1,totalQuantity:1,lowStockCount:0,outOfStockCount:0,imageUrl:null},
        {id:2,name:"Synthetic Two",code:"TEST2",skuCount:1,totalQuantity:1,lowStockCount:0,outOfStockCount:0,imageUrl:null}];
      else if(u.pathname==="/api/field/items")value={items:[{
        id:q==="older"?901:q==="newer"?902:101,name:"Synthetic "+(q||"material"),sku:"TEST",
        quantityOnHand:12,minimumStock:2,unitOfMeasure:"FT",status:"in_stock",imageUrl:null,
        sizeLabel:"1/2",categoryId:1,manufacturer:u.searchParams.get("brand")||"none"}],total:1};
      else if(u.pathname==="/api/field/families")value=[{name:"EMT",count:1}];
      else if(u.pathname==="/api/field/brands")value=[{name:"A",count:1},{name:"B",count:1}];
      else if(u.pathname==="/api/field/types")value=[{name:"Steel",count:1}];
      else if(u.pathname==="/api/field/subcategories")value=[{name:"Coupling",count:1}];
      else if(u.pathname==="/api/field/sizes")value=q==="older"?["OLD"]:q==="newer"?["NEW"]:["1/2","3/4"];
      else throw Error("Unapproved mock endpoint "+u.pathname);
      return new Response(JSON.stringify(value),{status:200,headers:{"Content-Type":"application/json"}});
    };
    XMLHttpRequest.prototype.open=function(){throw Error("XHR forbidden")};
    window.WebSocket=function(){throw Error("WebSocket forbidden")};
    navigator.sendBeacon=()=>{throw Error("Beacon forbidden")};
  `});
  await page.addScriptTag({ content: bundle });
  return { page, async close() {
    assert.deepEqual(network, [], "No real network");
    assert.deepEqual(errors, [], "No browser runtime errors");
    const calls = await page.evaluate(() => (window as any).calls);
    assert.ok(calls.every((c: any) => c.method === "GET"));
    await context.close();
  }};
}
