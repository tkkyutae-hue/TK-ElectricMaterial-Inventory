import assert from "node:assert/strict";
import { build } from "esbuild";

/** Real screens; service hooks and cart panel are the only replaced boundaries. */
export async function buildFieldSelectScreens() {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import FieldInventory from "./client/src/pages/field/FieldInventory";
      import FieldMovement from "./client/src/pages/field/FieldMovement";
      import {FieldLayout} from "./client/src/components/layout/FieldLayout";
      import {TooltipProvider} from "./client/src/components/ui/tooltip";
      const screen=window.__screen;
      createRoot(document.getElementById("root")).render(
        <TooltipProvider><FieldLayout>{screen==="inventory"?<FieldInventory/>:
          <FieldMovement/>}</FieldLayout>
        </TooltipProvider>);
    ` },
    bundle: true, write: false, metafile: true, platform: "browser", format: "iife", jsx: "automatic",
    plugins: [{
      name: "no-real-services",
      setup(plugin) {
        plugin.onResolve({filter: /^\.\/FieldHeader$/}, () => ({path:"header",namespace:"header-stub"}));
        plugin.onLoad({filter:/.*/,namespace:"header-stub"},()=>({loader:"tsx",resolveDir:process.cwd(),contents:`
          import React from "react";
          export const FieldHeader=()=> <header style={{height:68,flexShrink:0}}>Synthetic field header</header>;
        `}));
        plugin.onResolve({filter: /^\.\/FieldCartPanel$/}, () => ({path:"cart-panel",namespace:"cart-stub"}));
        plugin.onLoad({filter:/.*/,namespace:"cart-stub"},()=>({loader:"tsx",contents:"export default function CartPanel(){return null}"}));
        plugin.onResolve({filter:/^(?:@\/hooks\/(?:use-language|use-field-theme|use-auth|use-items|use-reference-data)|@\/lib\/(?:fieldCart|queryClient)|@tanstack\/react-query|wouter)$/},
          () => ({path:"synthetic-services",namespace:"synthetic"}));
        plugin.onLoad({filter:/.*/,namespace:"synthetic"},()=>({
          loader:"tsx",resolveDir:process.cwd(),contents:`
            import {TRANSLATIONS} from "./client/src/lib/i18n";
            import {F_DARK,F_LIGHT} from "./client/src/lib/fieldTokens";
            const locations=[{id:1,name:"Synthetic warehouse",isActive:true}];
            const projects=[{id:1,name:"Synthetic project",status:"active"}];
            const items=[{id:1,sku:"TEST-1",name:"Synthetic conduit",quantityOnHand:10,
              unitOfMeasure:"EA",categoryId:1,reorderPoint:1,status:"in_stock",imageUrl:null}];
            const data={
              "/api/inventory/categories/summary":[{id:1,name:"Conduit",code:"CONDUIT",
                skuCount:1,totalQuantity:10,lowStockCount:0,outOfStockCount:0,imageUrl:null}],
              "/api/field/items":{items,total:1,page:1,pageSize:10,totalPages:1},
              "/api/field/sizes":["1/2","3/4","1"],
              "/api/field/families":[], "/api/field/brands":[], "/api/field/types":[],
              "/api/field/subcategories":[], "/api/workers":[],
              "/api/suppliers":[{id:1,name:"Synthetic supplier"}],
            };
            const blocked=()=>{window.__io++;throw Error("Real IO forbidden")};
            const mutation={isPending:false,mutate:blocked,mutateAsync:blocked};
            export const useLanguage=()=>({t:TRANSLATIONS[window.__lang],lang:window.__lang});
            export const useFieldTheme=()=>({F:window.__theme==="dark"?F_DARK:F_LIGHT,theme:window.__theme});
            export const useAuth=()=>({user:{id:"synthetic",role:"manager",name:"Synthetic user"},isAdminRole:true,canDoMovements:true});
            export const useSearch=()=>window.__screen==="inventory"?"?category=1":"?type="+window.__screen;
            export const useLocation=()=>["/field/inventory",()=>{}];
            export const useItems=()=>({data:items,isLoading:false,isError:false});
            export const useLocations=()=>({data:locations,isLoading:false});
            export const useProjects=()=>({data:projects,isLoading:false});
            export const useCreateLocation=()=>mutation;
            export const useDeleteLocation=()=>mutation;
            export const queryClient={invalidateQueries:()=>{}};
            export const useQueryClient=()=>queryClient;
            export const apiRequest=blocked;
            export const FieldCartProvider=({children})=>children;
            export const useQuery=({queryKey,enabled})=>({
              data:enabled===false?undefined:(data[queryKey[0]]??[]),
              isLoading:false,isFetching:false,isError:false,refetch:()=>{}});
            export const useFieldCart=()=>({totalItems:0,totalQty:0,hasDraft:false,editingRequestId:null,
              editingRequestNumber:null,items:[],getCartItem:()=>undefined,addToCart:blocked,removeFromCart:blocked});
          `,
        }));
      },
    }],
  });
  assert.equal(Object.keys(result.metafile!.inputs).some(p => /(^|\/)server\//.test(p)), false);
  return result.outputFiles[0].text;
}
