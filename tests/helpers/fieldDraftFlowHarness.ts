/**
 * Browser-only fixture. Imports real field UI, including the request list,
 * person picker, cart panel, toast hook and toaster, but NEVER App or server.
 * All data/service boundaries are replaced before bundling.
 */
import { build } from "esbuild";

export async function buildIsolatedFieldFlow() {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(), loader: "tsx",
      contents: `
        import React,{useState,useEffect} from "react";
        import {createRoot} from "react-dom/client";
        import {FieldCartProvider,useFieldCart} from "./client/src/lib/fieldCart";
        import FieldCartPanel from "./client/src/pages/field/FieldCartPanel";
        import FieldRequestsList from "./client/src/pages/field/FieldRequestsList";
        import {Toaster} from "./client/src/components/ui/toaster";
        import {useToast} from "./client/src/hooks/use-toast";
        import {useLocation} from "wouter";
        const itemA={itemId:901,itemName:"Mock A",sku:"MOCK-A",sizeLabel:null,
          requestedQty:3,unit:"ea",locationName:null,imageUrl:null};
        const itemB={...itemA,itemId:903,itemName:"Mock B",sku:"MOCK-B"};
        window.__fixtures={
          requests:[{id:501,requestNumber:"REQ-MOCK-A",status:"requested",
            submittedBy:"mock-user",submittedByName:"Mock user",submittedAt:"2026-01-01T00:00:00Z",
            itemsJson:JSON.stringify([itemA]),requestType:"issue",projectId:null,
            requesterName:"",requesterRole:"",notes:"A saved",fulfilledMovementId:null}],
          projects:[{id:902,name:"Mock project"},{id:904,name:"Mock second project"}],
          workers:[{id:905,fullName:"Mock requester",trade:"Mock role",isActive:true}]
        };
        function Harness(){
          const cart=useFieldCart();
          const {toasts}=useToast();
          const [path,navigate]=useLocation();
          const [open,setOpen]=useState(false);
          useEffect(()=>{if(path.includes("cart=open"))setOpen(true)},[path]);
          window.__readDraft=()=>cart.getDraft();
          window.__readToasts=()=>toasts.map(({id,title,description,open})=>({
            id,title,description:typeof description==="string"?description:null,open
          }));
          return <>
            <nav>
              <button data-testid="fixture-open-inventory" onClick={()=>{
                navigate("/field/inventory?cart=open");setOpen(true);
              }}>Mock inventory navigation</button>
              <button data-testid="fixture-open-requests" onClick={()=>{
                setOpen(false);navigate("/field/transactions?tab=requests");
              }}>Mock requests navigation</button>
              <button data-testid="fixture-add-a" onClick={()=>cart.addToCart(itemA,3)}>Mock inventory item A</button>
              <button data-testid="fixture-add-b" onClick={()=>cart.addToCart(itemB,8)}>Mock inventory item B</button>
            </nav>
            <output data-testid="fixture-path">{path}</output>
            {path.includes("transactions")?<FieldRequestsList/>:open&&<FieldCartPanel onClose={()=>setOpen(false)}/>}
            <Toaster/>
          </>;
        }
        createRoot(document.getElementById("root")).render(<FieldCartProvider><Harness/></FieldCartProvider>);
      `,
    },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    metafile: true,
    plugins: [{
      name: "mock-all-service-boundaries",
      setup(plugin) {
        plugin.onResolve({
          filter: /^(?:@\/hooks\/(?:use-language|use-field-theme|use-auth)|@\/lib\/queryClient|@tanstack\/react-query|wouter)$/,
        }, () => ({ path: "boundaries", namespace: "isolated" }));
        plugin.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({
          loader: "tsx", resolveDir: process.cwd(), contents: `
            import React,{useSyncExternalStore} from "react";
            import {TRANSLATIONS} from "./client/src/lib/i18n";
            import {F_DARK,F_LIGHT} from "./client/src/lib/fieldTokens";
            let path="/field/inventory";
            const listeners=new Set();
            window.__calls=[]; window.__pending=[]; window.__defer=false;
            export function useLocation(){
              return [useSyncExternalStore(cb=>{listeners.add(cb);return()=>listeners.delete(cb)},()=>path),
                next=>{path=next;listeners.forEach(cb=>cb())}];
            }
            export const useLanguage=()=>({t:TRANSLATIONS[window.__config.lang]});
            export const useFieldTheme=()=>({F:window.__config.theme==="light"?F_LIGHT:F_DARK});
            export const useAuth=()=>({user:{id:"mock-user",role:"staff",name:"Mock user"}});
            export const queryClient={invalidateQueries:()=>{}};
            export const useQueryClient=()=>queryClient;
            export const useQuery=({queryKey})=>{
              const fixtures=window.__fixtures;
              const data={"/api/field/requests":fixtures.requests,"/api/projects":fixtures.projects,
                "/api/workers":fixtures.workers}[queryKey[0]];
              if(!data)throw Error("Unexpected mock query");
              return {data,isLoading:false};
            };
            export const apiRequest=async(method,url,body)=>{
              if(!["POST","PATCH"].includes(method)||!/^\\/api\\/field\\/requests(?:\\/\\d+(?:\\/status)?)?$/.test(url))
                throw Error("Unexpected mock mutation");
              const call={method,url,body};window.__calls.push(call);
              if(window.__defer)await new Promise((resolve,reject)=>window.__pending.push({resolve,reject}));
              return {json:async()=>({id:501})};
            };
          `,
        }));
        plugin.onResolve({ filter: /(?:^|\/)server(?:\/|$)|^node:|^pg$|^@neondatabase\// }, args => {
          throw Error("Forbidden service/server dependency: " + args.path);
        });
      },
    }],
  });
  const inputs = Object.keys(result.metafile!.inputs);
  const forbidden = inputs.filter(path => /^(?:server\/|shared\/schema\.|client\/src\/(?:App|main|lib\/queryClient)\.)/.test(path));
  if (forbidden.length) {
    throw Error("App bootstrap or real data boundary included in isolated bundle: " + forbidden.join(", "));
  }
  return result.outputFiles[0].text;
}
