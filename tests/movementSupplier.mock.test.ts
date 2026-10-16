import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

test("actual MovementForm loads, changes and saves supplier in a draft without any network", {timeout:90000}, async () => {
  const result = await build({
    stdin:{resolveDir:process.cwd(),loader:"tsx",contents:`
      import React from "react"; import {createRoot} from "react-dom/client";
      import {MovementForm} from "./client/src/components/MovementForm";
      import {TooltipProvider} from "./client/src/components/ui/tooltip";
      createRoot(document.getElementById("root")).render(<TooltipProvider>
        <MovementForm defaultType="receive" draftId={1} fieldMode onSuccess={()=>{}} onCancel={()=>{}}/>
      </TooltipProvider>);`},
    bundle:true,write:false,metafile:true,platform:"browser",format:"iife",jsx:"automatic",
    plugins:[{name:"synthetic-services",setup(p){
      p.onResolve({filter:/^(?:@\/hooks\/(?:use-language|use-field-theme|use-auth|use-items|use-reference-data|use-toast)|@\/lib\/queryClient|@tanstack\/react-query|wouter)$/},
        ()=>({path:"mock",namespace:"mock"}));
      p.onLoad({filter:/.*/,namespace:"mock"},()=>({loader:"tsx",resolveDir:process.cwd(),contents:`
        import {TRANSLATIONS} from "./client/src/lib/i18n";
        import {F_DARK} from "./client/src/lib/fieldTokens";
        const items=[{id:1,sku:"SYN",name:"Synthetic material",unitOfMeasure:"EA",quantityOnHand:100}];
        const draft={id:1,movementType:"receive",itemsJson:JSON.stringify([{itemId:1,qty:10,supplierId:1}])};
        const data={"/api/drafts":draft,"/api/suppliers":[{id:1,name:"Synthetic supplier A"},{id:2,name:"Synthetic supplier B"}],"/api/workers":[]};
        const blocked=()=>{throw Error("Unexpected mutation")};
        export const useLanguage=()=>({t:TRANSLATIONS.en,lang:"en"});
        export const useFieldTheme=()=>({F:F_DARK,theme:"dark"});
        export const useAuth=()=>({isAdminRole:true,user:{id:"synthetic",role:"admin"}});
        export const useToast=()=>({toast:()=>({dismiss:()=>{}})});
        export const useLocation=()=>["/synthetic",()=>{}];
        export const useItems=()=>({data:items,isLoading:false});
        export const useLocations=()=>({data:[],isLoading:false});
        export const useProjects=()=>({data:[],isLoading:false});
        export const useCreateLocation=()=>({mutate:blocked});
        export const useDeleteLocation=()=>({mutate:blocked});
        export const queryClient={invalidateQueries:async()=>{}};
        export const useQueryClient=()=>queryClient;
        export const apiRequest=blocked;
        export const useQuery=({queryKey,enabled})=>({data:enabled===false?undefined:data[queryKey[0]]??[],isLoading:false});
      `}));
    }}],
  });
  assert.ok(!Object.keys(result.metafile!.inputs).some(p=>/server\//.test(p)));
  const browser=await chromium.launch({headless:true});
  try {
    for (const width of [390,1280]) {
      const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
      await context.route("**/*",r=>r.abort());
      const page=await context.newPage(), errors:string[]=[], network:string[]=[];
      page.on("pageerror",e=>errors.push(e.message)); page.on("request",r=>network.push(r.resourceType()));
      await page.setContent('<div id="root"></div>');
      await page.addScriptTag({content:`
        window.saved=[]; let id=0; crypto.randomUUID??=()=>String(++id);
        window.fetch=async(url,options)=>{
          if(url!=="/api/drafts" || options.method!=="POST")throw Error("Unexpected IO");
          window.saved.push(JSON.parse(options.body));
          return {ok:true,json:async()=>({id:99})};
        };
        window.XMLHttpRequest=window.WebSocket=function(){throw Error("Network forbidden")};
      `});
      await page.addScriptTag({content:result.outputFiles[0].text});
      await page.getByTestId("select-source-location").waitFor();
      assert.match(await page.getByTestId("select-source-location").innerText(),/Synthetic supplier A/);
      await page.getByTestId("button-save-draft").click();
      await page.waitForFunction("window.saved.length===1");
      assert.equal(await page.evaluate(()=>JSON.parse((window as any).saved[0].itemsJson)[0].supplierId),1);
      await page.getByTestId("select-source-location").click();
      await page.getByText("Synthetic supplier B",{exact:true}).click();
      await page.getByTestId("button-save-draft").click();
      await page.waitForFunction("window.saved.length===2");
      assert.equal(await page.evaluate(()=>JSON.parse((window as any).saved[1].itemsJson)[0].supplierId),2);
      assert.deepEqual(errors,[]); assert.deepEqual(network,[]);
      await context.close();
    }
  } finally {await browser.close();}
});
