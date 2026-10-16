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
        import FieldTransactions from "./client/src/pages/field/FieldTransactions";
        import Transactions from "./client/src/pages/Transactions";
        import {Toaster} from "./client/src/components/ui/toaster";
        import {useToast} from "./client/src/hooks/use-toast";
        import {useLocation} from "wouter";
        const itemA={itemId:901,itemName:"Mock A",sku:"MOCK-A",sizeLabel:null,
          requestedQty:3,unit:"ea",locationName:null,imageUrl:null};
        const itemB={...itemA,itemId:903,itemName:"Mock B",sku:"MOCK-B"};
        window.__fixtures={
          requests:[{id:501,revision:0,requestNumber:"REQ-MOCK-A",status:"requested",
            submittedBy:"mock-user",submittedByName:"Mock user",submittedAt:"2026-01-01T00:00:00Z",
            itemsJson:JSON.stringify([itemA]),requestType:"issue",projectId:null,
            requesterName:"",requesterRole:"",notes:"A saved",fulfilledMovementId:null}],
          projects:[{id:902,name:"Mock project"},{id:904,name:"Mock second project"}],
          workers:[{id:905,fullName:"Mock requester",trade:"Mock role",isActive:true}]
        };
        window.__fixtures.movements=[1001,1002].map((id,index)=>({
          id,itemId:901,movementType:"issue",quantity:3,previousQuantity:10,newQuantity:7,
          createdAt:new Date().toISOString(),note:"Synthetic transaction",
          referenceType:index===0?"material_request":null,referenceId:index===0?"501":null,
          item:{id:901,name:"Mock A",sku:"MOCK-A",unit:"ea",sizeLabel:null,imageUrl:null}
        }));
        function Harness(){
          const cart=useFieldCart();
          const {toasts}=useToast();
          const [path,navigate]=useLocation();
          const [open,setOpen]=useState(false);
          const [history,setHistory]=useState(null);
          useEffect(()=>{if(path.includes("cart=open"))setOpen(true)},[path]);
          window.__readDraft=()=>cart.getDraft();
          window.__readToasts=()=>toasts.map(({id,title,description,open})=>({
            id,title,description:typeof description==="string"?description:null,open
          }));
          return <>
            <nav>
              <button data-testid="fixture-open-inventory" onClick={()=>{
                setHistory(null);
                navigate("/field/inventory?cart=open");setOpen(true);
              }}>Mock inventory navigation</button>
              <button data-testid="fixture-open-requests" onClick={()=>{
                setHistory(null);
                setOpen(false);navigate("/field/transactions?tab=requests");
              }}>Mock requests navigation</button>
              <button data-testid="fixture-open-field-history" onClick={()=>setHistory("field")}>Mock field history</button>
              <button data-testid="fixture-open-admin-history" onClick={()=>setHistory("admin")}>Mock admin history</button>
              <button data-testid="fixture-add-a" onClick={()=>cart.addToCart(itemA,3)}>Mock inventory item A</button>
              <button data-testid="fixture-add-b" onClick={()=>cart.addToCart(itemB,8)}>Mock inventory item B</button>
            </nav>
            <output data-testid="fixture-path">{path}</output>
            {history==="field"?<FieldTransactions/>:history==="admin"?<Transactions/>:
              path.includes("transactions")?<FieldRequestsList/>:open&&<FieldCartPanel onClose={()=>setOpen(false)}/>}
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
        plugin.onResolve({filter:/^(?:@\/components\/(?:MovementForm|EditTransactionDrawer)|\.\/DraftMovementsList)$/},
          ()=>({path:"unrelated-editors",namespace:"unrelated"}));
        plugin.onLoad({filter:/.*/,namespace:"unrelated"},()=>({loader:"tsx",resolveDir:process.cwd(),contents:`
          import React from "react";
          export default function UnrelatedDrafts(){return null}
          export const MovementForm=()=>null;
          export const EditSuccessToast=()=>null;
          export const EditTransactionDrawer=()=> <div data-testid="fixture-editor-open"/>;
        `}));
        plugin.onResolve({
          filter: /^(?:@\/hooks\/(?:use-language|use-field-theme|use-auth|use-transactions|use-reference-data)|@\/lib\/queryClient|@tanstack\/react-query|wouter)$/,
        }, () => ({ path: "boundaries", namespace: "isolated" }));
        plugin.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({
          loader: "tsx", resolveDir: process.cwd(), contents: `
            import React,{useSyncExternalStore} from "react";
            import {TRANSLATIONS} from "./client/src/lib/i18n";
            import {F_DARK,F_LIGHT} from "./client/src/lib/fieldTokens";
            let path="/field/inventory";
            const listeners=new Set();
            window.__calls=[]; window.__pending=[]; window.__defer=false; window.__operations={};
            if(!crypto.randomUUID){
              let sequence=0;
              Object.defineProperty(crypto,"randomUUID",{value:()=>
                "00000000-0000-4000-8000-"+String(++sequence).padStart(12,"0")});
            }
            export function useLocation(){
              return [useSyncExternalStore(cb=>{listeners.add(cb);return()=>listeners.delete(cb)},()=>path),
                next=>{path=next;listeners.forEach(cb=>cb())}];
            }
            export const useSearch=()=>"";
            export const Link=({children,...props})=><a {...props}>{children}</a>;
            export const useLanguage=()=>({t:TRANSLATIONS[window.__config.lang],lang:window.__config.lang});
            export const useFieldTheme=()=>({F:window.__config.theme==="light"?F_LIGHT:F_DARK,theme:window.__config.theme});
            export const useAuth=()=>({user:{id:"mock-user",role:"staff",name:"Mock user"}});
            window.__movementCalls=[];
            export const useMovements=()=>({data:window.__fixtures.movements,isLoading:false,isError:false,refetch:()=>{}});
            export const useProjects=()=>({data:window.__fixtures.projects});
            export const useLocations=()=>({data:[]});
            const mutation={isPending:false,mutateAsync:async(...args)=>{
              window.__movementCalls.push(args);return {deleted:args[0],restored:[]};
            }};
            export const useBulkDeleteMovements=()=>mutation;
            export const useBulkRestoreMovements=()=>mutation;
            export const useUpdateMovement=()=>mutation;
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
              if(!["POST","PATCH","DELETE"].includes(method)||!/^\\/api\\/field\\/requests(?:\\/\\d+(?:\\/(?:status|undo-edit|undo-complete))?)?$/.test(url))
                throw Error("Unexpected mock mutation");
              const payload=body.payload??body;
              const call={method,url,body:payload,envelope:body};window.__calls.push(call);
              if(window.__defer)await new Promise((resolve,reject)=>window.__pending.push({resolve,reject}));
              if(window.__conflict)throw Error('409: {"code":"REQUEST_CHANGED"}');
              if(window.__operations[body.operationId]){
                const saved=window.__operations[body.operationId];
                return {json:async()=>({operationId:body.operationId,request:saved.request,replayed:true})};
              }
              const before={...window.__fixtures.requests[0]};
              const source=window.__operations[body.sourceOperationId];
              const request=url.endsWith("/undo-edit")?{...source.before}:
                {...before,...payload};
              request.id=501;request.revision=(body.expectedRevision??-1)+1;
              window.__operations[body.operationId]={before,request};
              if(window.__loseResponseOnce){
                window.__loseResponseOnce=false;throw Error("Mock lost response after commit");
              }
              return {json:async()=>({operationId:body.operationId,request})};
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
