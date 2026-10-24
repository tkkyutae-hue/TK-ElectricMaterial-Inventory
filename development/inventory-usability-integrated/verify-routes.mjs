/** Actual App + Wouter; isolated identity/HTTP and unrelated-page boundaries only. */
import { build } from "esbuild";
import { chromium } from "playwright";
import postcss from "postcss";
import tailwind from "tailwindcss";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
const delivery=dirname(fileURLToPath(import.meta.url)),root=resolve(delivery,"../..");
for(const k of Object.keys(process.env))assert.ok(["PATH","HOME","LANG","LC_ALL","NODE_ENV","PWD","SHLVL","_"].includes(k),"Unexpected inherited environment key");
const read=p=>readFileSync(p,"utf8"),hash=p=>createHash("sha256").update(readFileSync(p)).digest("hex");
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(p,e.name)):[join(p,e.name)]);
const assembly=JSON.parse(read(join(delivery,"assembly.json")));
function checkUpstream(){
 for(const source of assembly.sourceManifests)assert.equal(hash(join(root,"development",source.stage,"manifest.json")),source.sha256,"Upstream manifest changed");
 for(const file of assembly.files)for(const source of file.sources)assert.equal(hash(join(root,"development",source.stage,"prepared",file.path+".txt")),source.sha256,"Upstream source changed");
}
checkUpstream();
const evidence=join(root,"generated-artifacts/inventory-usability-integrated/routes"),work=mkdtempSync(join(tmpdir(),"tk-integrated-routes-"));
mkdirSync(evidence,{recursive:true});
for(const dir of ["client/src","shared","server","tests/helpers"])cpSync(join(root,dir),join(work,dir),{recursive:true,
  filter:p=>!/(?:^|\/)(?:node_modules|\.env(?:\..*)?|storage|uploads|sessions|backups)(?:\/|$)/.test(p)});
for(const file of ["package.json","tsconfig.json","vite.config.ts","tailwind.config.ts"])cpSync(join(root,file),join(work,file));
symlinkSync(join(root,"node_modules"),join(work,"node_modules"));
const inputs=walk(join(delivery,"prepared")).map(p=>{
  const path=relative(join(delivery,"prepared"),p).slice(0,-4),out=join(work,path);
  assert.ok(p.endsWith(".txt"));mkdirSync(dirname(out),{recursive:true});cpSync(p,out);
  const origin=assembly.files.find(f=>f.path===path);
  return {path,preparedSha256:hash(p),currentRootSha256:existsSync(join(root,path))?hash(join(root,path)):null,
    sources:origin?.sources??[{stage:"runtime-baseline",sha256:hash(join(root,path))}],
    integrationAdjusted:!origin||hash(p)!==origin.preparedSha256};
});
const typeInput=dir=>walk(dir).filter(p=>/\.(?:tsx?|json)$/.test(p)).sort().map(p=>relative(dir,p)+":"+hash(p)).join("\n");
const reuse=process.argv.find(arg=>arg.startsWith("--checked-work="))?.slice(15);
if(reuse){assert.equal(typeInput(work),typeInput(reuse),"Typecheck inputs changed");console.log("TypeScript reused: identical inputs")}
else{
 const r=spawnSync(process.execPath,["--require",join(root,"tests/helpers/guardStartupPlanOffline.cjs"),
   join(root,"node_modules/typescript/bin/tsc"),"--noEmit","--incremental","false"],{cwd:work,encoding:"utf8",env:{PATH:process.env.PATH,LANG:"C.UTF-8"}});
 writeFileSync(join(evidence,"typecheck.log"),r.stdout+r.stderr);assert.equal(r.status,0,r.stdout+r.stderr);console.log("Integrated TypeScript passed");
}
console.log("Checked workcopy: "+work);
const allowedPages=new Set(["Dashboard","Inventory","ItemDetails","CategoryDetail","ProjectDetail","Transactions",
 "Login","field/FieldInventory","field/FieldTransactions","field/FieldHome"]);
const bundled=await build({stdin:{resolveDir:work,loader:"tsx",contents:`
import React from "react";import {createRoot} from "react-dom/client";
import App from "./client/src/App";
import {setBranchAccount} from "@/lib/branchTransport";
import * as commands from "@/lib/requestCommands";
import {queryClient} from "@/lib/queryClient";
import {TRANSLATIONS} from "@/lib/i18n";
window.commands=commands;window.queryClient=queryClient;window.messages=TRANSLATIONS[window.config.lang];
if(window.config.role)setBranchAccount("actor");
createRoot(document.getElementById("root")).render(<App/>);
`},bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",metafile:true,outfile:join(work,"fixture.js"),loader:{".png":"dataurl"},
 plugins:[{name:"isolated-boundaries",setup(b){
  b.onResolve({filter:/^@assets\//},a=>{
   assert.equal(a.path,"@assets/tk_logo_1772726610288.png","Only the existing public brand asset is allowed");
   return {path:join(root,"attached_assets/tk_logo_1772726610288.png")};
  });
  b.onResolve({filter:/(?:^|\/)use-auth$/},()=>({path:"auth",namespace:"identity"}));
  b.onLoad({filter:/.*/,namespace:"identity"},()=>({resolveDir:work,loader:"tsx",contents:`
import {useSyncExternalStore} from "react";const listeners=new Set();
window.setIdentity=(id,role)=>{window.authId=id;window.config.role=role;listeners.forEach(fn=>fn())};
export function useAuth(){const state=useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>window.authId+":"+window.config.role);
 const role=window.config.role,user=window.authId&&role?{id:window.authId,role,name:"Synthetic user",status:"active"}:null;
 return {user,isAuthenticated:!!user,isLoading:false,isAdminRole:role==="admin",isManagerOrAbove:["manager","admin"].includes(role),
 canAccessAdminMode:["admin","manager"].includes(role),canDoMovements:["admin","manager"].includes(role),
 canRequestMaterials:["staff","manager","admin"].includes(role),canAccessDailyReport:["staff","manager","admin"].includes(role),
 canAccessProjectOperations:["staff","manager","admin"].includes(role),logout:()=>{},logoutMutation:{mutate(){},isPending:false}};
}`}));
  b.onResolve({filter:/^@\/pages\//},a=>{
   if(a.importer!==join(work,"client/src/App.tsx"))return;
   const page=a.path.slice("@/pages/".length);
   if(!allowedPages.has(page))return {path:page,namespace:"unrelated"};
  });
  b.onLoad({filter:/.*/,namespace:"unrelated"},a=>({resolveDir:work,loader:"tsx",contents:`
import React from "react";export default function Unrelated(){return <div data-testid="unrelated-page">${a.path}</div>}`}));
  b.onResolve({filter:/(?:^|\/)server(?:\/|$)|^node:|^pg$|^@neondatabase\//},a=>{throw Error("Forbidden browser dependency "+a.path)});
 }}]});
assert.ok(Object.keys(bundled.metafile.inputs).some(p=>p.endsWith("client/src/App.tsx")));
assert.ok(Object.keys(bundled.metafile.inputs).some(p=>p.includes("wouter/esm")));
assert.ok(!Object.keys(bundled.metafile.inputs).some(p=>/server\/|clerk|replit_integrations/.test(p)));
await build({entryPoints:[join(work,"tailwind.config.ts")],outfile:join(work,"tailwind.cjs"),bundle:true,platform:"node",format:"cjs"});
const loaded=(await import(pathToFileURL(join(work,"tailwind.cjs")).href)).default,config=loaded.default??loaded;
config.content=[join(work,"client/src/**/*.{ts,tsx}")];
const styles=await postcss([tailwind(config)]).process(read(join(work,"client/src/index.css")),{from:join(work,"client/src/index.css")});
const script=bundled.outputFiles.find(f=>f.path.endsWith(".js")).text,css=styles.css+(bundled.outputFiles.find(f=>f.path.endsWith(".css"))?.text??"");
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",
 args:["--disable-background-networking","--disable-component-update","--disable-sync","--no-first-run","--disable-dev-shm-usage"]});
const scenarios=[],errors=[],unexpected=[],screenshots=[];
async function fixture(options={}){
 const cfg={branch:"indiana",path:"/inventory",role:"manager",lang:"ko",theme:"dark",width:390,...options};
 const prefix=cfg.branch?"/branches/"+cfg.branch:"",url="https://synthetic.invalid"+prefix+cfg.path;
 const context=await browser.newContext({viewport:{width:cfg.width,height:874},locale:"en-US",timezoneId:"UTC"});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",r=>r.request().url()===url?r.fulfill({contentType:"text/html",body:"<!doctype html><html><body><div id='root'></div></body></html>"}):(unexpected.push(r.request().url()),r.abort()));
 await page.goto(url);
 await page.evaluate(cfg=>{
  window.config=cfg;window.authId=cfg.role?"actor":null;window.posts=[];window.gets=[];window.receipts={};window.mode="ready";window.unexpected=[];
  localStorage.setItem("voltstock_lang",cfg.lang);localStorage.setItem("voltstock_field_theme",cfg.theme);
  window.item={id:901,itemId:901,name:"Synthetic cable",itemName:"Synthetic cable",sku:"SYN-901",sizeLabel:"1 inch",unitOfMeasure:"EA",
   unit:"EA",quantityOnHand:10,reorderPoint:12,reorderQuantity:5,status:"low_stock",categoryId:7,category:{id:7,name:"Synthetic category"},
   usagePattern:"core",itemType:"material",imageUrl:null,quantity:3,requestedQty:3,requestedBy:null,locationName:null,unitCost:"0"};
  window.requests=[{id:501,revision:7,requestNumber:"SYN-501",status:cfg.status??"requested",submittedBy:"actor",submittedByName:"Synthetic user",
    submittedAt:"2026-01-01T12:00:00Z",itemsJson:JSON.stringify([window.item]),requestType:"issue",projectId:null,
    requesterName:"Synthetic user",requesterRole:"staff",notes:"Synthetic note",fulfilledMovementId:null}];
  window.categories=[{id:7,name:"Synthetic category",code:"SYN",skuCount:40,totalQuantity:10,lowStockCount:1,outOfStockCount:0,imageUrl:null}];
  window.fetch=async(input,init={})=>{
   const url=new URL(String(input),location.origin),prefix=cfg.branch?"/branches/"+cfg.branch:"";
   if(!url.pathname.startsWith(prefix+"/api/"))throw Error("Unscoped synthetic request");
   const path=url.pathname.slice(prefix.length),json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
   if(init.method&&init.method!=="GET"){
    const body=JSON.parse(init.body);window.posts.push({method:init.method,path,body});
    if(window.mode==="unknown")throw Error("Synthetic response loss");
    if(window.mode==="forbidden")return json({code:"FORBIDDEN"},403);
    let result=window.receipts[body.operationId];
    if(!result){const req={...window.requests[0],...body.payload,revision:(body.expectedRevision??-1)+1};if(path.endsWith("/undo-complete"))req.status="ready";
      result={request:req,operationId:body.operationId};window.requests[0]=req;window.receipts[body.operationId]=result;}
    if(window.mode==="lost-once"){window.mode="ready";throw Error("Synthetic committed reply loss");}
    return json(result);
   }
   window.gets.push(path+url.search);
   if(path.startsWith("/api/field/request-operations/")){const id=path.split("/").pop();return json(window.receipts[id]?{state:"committed",result:window.receipts[id]}:{state:"unknown"});}
   if(window.queryError===path)return json({code:window.queryCode??"SYNTHETIC_FAILURE",message:"PRIVATE_SYNTHETIC_DIAGNOSTIC"},window.queryStatus??503);
   if(path==="/api/field/requests")return json(window.requests);
   if(path==="/api/dashboard/stats")return json({totalValue:"0",totalSkus:40,lowStockCount:1,outOfStockCount:0,pendingReorderCount:0,recentActivity:[]});
   if(path==="/api/dashboard/monthly-trend")return json([]);
   if(path==="/api/reports/low-stock")return json({lowStock:[window.item],outOfStock:[]});
   if(path==="/api/inventory/categories/summary")return json(window.categories);
   if(path==="/api/categories")return json(window.categories);
   if(path==="/api/items"||path==="/api/inventory"){
    const miss=url.searchParams.has("search")&&!window.item.name.toLowerCase().includes(url.searchParams.get("search").toLowerCase());
    return json({items:miss?[]:[window.item],total:miss?0:40});
   }
   if(path==="/api/items/901")return json(window.item);
   if(path==="/api/field/items")return json([window.item]);
   if(path==="/api/inventory/category")return json([window.item]);
   if(path==="/api/inventory/category/7")return json([window.item]);
   if(["/api/projects","/api/locations","/api/suppliers","/api/manufacturers","/api/manpower","/api/workers","/api/movements","/api/drafts"].includes(path))return json([]);
   if(/^\/api\/(?:media\/|inventory\/901\/images|wire-reels|item-assets)/.test(path))return json([]);
   window.unexpected.push(path);throw Error("Unexpected synthetic GET "+path);
  };
 },cfg);
 await page.addStyleTag({content:css});await page.addScriptTag({content:script});await page.waitForFunction(()=>!!window.commands);
 return {page,context,cfg,prefix,close:async()=>{unexpected.push(...await page.evaluate(()=>window.unexpected));await context.close()}};
}
async function test(name,fn,opts){
 const only=process.argv.find(s=>s.startsWith("--case="))?.slice(7);if(only&&!name.includes(only))return;
 const f=await fixture(opts);try{await fn(f);scenarios.push(name);console.log("PASS "+name)}finally{await f.close()}
}
async function nav(page,relativePath){await page.evaluate(path=>{const p=window.config.branch?"/branches/"+window.config.branch:"";history.pushState(null,"",p+path)},relativePath)}
async function screenshot(f,name){const path=join(evidence,name+".jpg");await f.page.screenshot({path,type:"jpeg",quality:70});screenshots.push(relative(root,path))}
try{
 await test("same-mounted Inventory accepts query navigation instead of overwriting it",async({page,prefix})=>{
  await page.getByTestId("input-search").waitFor();await nav(page,"/inventory?q=cable&status=low_stock&category=7&usage=core&page=2&perPage=5&sort=sku&dir=desc");
  await page.waitForFunction(()=>document.querySelector('[data-testid="input-search"]')?.value==="cable");
  assert.equal(new URL(page.url()).pathname,prefix+"/inventory");
  const params=new URL(page.url()).searchParams;for(const [key,value]of Object.entries({q:"cable",status:"low_stock",category:"7",usage:"core",page:"2",perPage:"5",sort:"sku",dir:"desc"}))assert.equal(params.get(key),value);
 });
 await test("Inventory back and forward restore same-mounted search filters",async({page})=>{
  await page.getByTestId("input-search").waitFor();await nav(page,"/inventory?q=cable&status=low_stock");
  await page.waitForFunction(()=>document.querySelector('[data-testid="input-search"]')?.value==="cable");
  await nav(page,"/inventory?q=Synthetic&category=7");await page.waitForFunction(()=>document.querySelector('[data-testid="input-search"]')?.value==="Synthetic");
  await page.goBack();await page.waitForFunction(()=>document.querySelector('[data-testid="input-search"]')?.value==="cable");
  await page.goForward();await page.waitForFunction(()=>document.querySelector('[data-testid="input-search"]')?.value==="Synthetic");
 });
 await test("Inventory controls preserve consecutive filter updates and reset page only",async({page})=>{
  await page.getByTestId("input-search").waitFor();
  await page.getByTestId("input-search").fill("cable");
  await page.waitForURL(u=>u.searchParams.get("q")==="cable"&&!u.searchParams.has("page"));
  assert.equal(new URL(page.url()).searchParams.get("category"),"7");
  assert.equal(new URL(page.url()).searchParams.get("usage"),"core");
  await page.getByTestId("sort-quantityOnHand").click();
  await page.waitForURL(u=>u.searchParams.get("sort")==="quantityOnHand");
  assert.equal(new URL(page.url()).searchParams.get("q"),"cable");
  assert.equal(new URL(page.url()).searchParams.has("dir"),false);
  await page.getByTestId("button-clear-filters").click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="input-search"]')?.value==="");
  const params=new URL(page.url()).searchParams;
  for(const key of ["q","status","category","usage","page"])assert.equal(params.has(key),false);
  assert.equal(params.get("sort"),"quantityOnHand");assert.equal(params.get("perPage"),"5");
 },{path:"/inventory?status=low_stock&category=7&usage=core&page=2&perPage=5&sort=sku&dir=desc"});
 for(const branch of ["indiana","savannah"])await test("full detail return preserves all list state in "+branch,async({page,prefix})=>{
  await page.getByTestId("link-item-name-901").waitFor();const before=new URL(page.url()).search;
  await page.getByTestId("link-item-name-901").click();await page.waitForURL(u=>u.pathname===prefix+"/inventory/901");
  const returnTo=new URL(page.url()).searchParams.get("returnTo");assert.ok(returnTo.startsWith("/inventory?"));
  const back=page.locator(`a[href^="${prefix}/inventory?"]`).first();await back.waitFor();await back.click();
  await page.getByTestId("input-search").waitFor();assert.equal(new URL(page.url()).search,before);
 },{branch,path:"/inventory?q=cable&status=low_stock&category=7&usage=core&page=2&perPage=5&sort=sku&dir=desc"});
 for(const returnTo of ["//external.invalid/inventory","/branches/savannah/inventory","/inventory?q=cable&private=discard"])await test("detail return target remains branch-local and allow-listed: "+returnTo,async({page,prefix})=>{
  const link=page.locator(`a[href^="${prefix}/inventory"]`).filter({hasText:/./}).last();
  // Only the detail breadcrumb inside main, not sidebar inventory navigation.
  const main=page.locator("main");const candidate=main.locator(`a[href^="${prefix}/inventory"]`).first();await candidate.waitFor();
  const href=await candidate.getAttribute("href"),target=new URL(href,"https://synthetic.invalid");
  assert.equal(target.pathname,prefix+"/inventory");assert.equal(target.origin,"https://synthetic.invalid");
  assert.equal(target.searchParams.has("private"),false);
  if(returnTo.startsWith("/inventory?"))assert.equal(target.searchParams.get("q"),"cable");
 },{path:"/inventory/901?"+new URLSearchParams({returnTo})});
 for(const branch of ["indiana","savannah"])await test("Dashboard request links open real Field route and preserve filter in "+branch,async f=>{
  const {page,prefix}=f;await page.getByTestId("admin-request-links").waitFor();
  await page.locator('[data-testid="admin-request-links"] a').first().click();await page.getByTestId("admin-request-status").waitFor();
  assert.equal(new URL(page.url()).pathname,prefix+"/field/transactions");assert.equal(await page.getByTestId("admin-request-status").inputValue(),"requested");
  await page.getByTestId("admin-request-status").selectOption("preparing");await page.waitForURL(u=>u.searchParams.get("requestStatus")==="preparing");
  assert.equal(new URL(page.url()).searchParams.get("tab"),"requests");
 },{branch,path:"/"});
 await test("Field URL tab navigation and history select the matching tab",async({page})=>{
  await page.getByTestId("tab-history").waitFor();await nav(page,"/field/transactions?tab=requests&requestStatus=requested");
  await page.getByTestId("admin-request-status").waitFor();
  await nav(page,"/field/transactions?tab=history");await page.getByTestId("admin-request-status").waitFor({state:"detached"});
  await page.goBack();await page.getByTestId("admin-request-status").waitFor();
 },{path:"/field/transactions?tab=history"});
 await test("pending Admin operation survives actual route unmount and re-entry",async({page})=>{
  await page.getByTestId("request-card-501").waitFor();await page.getByTestId("btn-request-expand-501").click();
  await page.evaluate(()=>window.mode="unknown");await page.getByTestId("btn-status-preparing-501").click();
  await page.waitForFunction(()=>window.commands.getPendingRequest("501")?.phase==="checking");
  await nav(page,"/inventory");await page.getByTestId("input-search").waitFor();
  await nav(page,"/field/transactions?tab=requests");await page.getByTestId("btn-request-expand-501").click();
  await page.getByTestId("admin-retry-501").waitFor();assert.equal(await page.getByTestId("btn-status-preparing-501").isDisabled(),true);
  await page.evaluate(()=>window.mode="ready");await page.getByTestId("admin-retry-501").click();
  await page.waitForFunction(()=>!window.commands.getPendingRequest("501"));
  const posts=await page.evaluate(()=>window.posts);assert.deepEqual(posts[0].body,posts[1].body);
 },{path:"/field/transactions?tab=requests"});
 for(const role of ["staff","viewer"])await test("Admin guard sends "+role+" to mode hub without inventory reads",async({page})=>{
  await page.getByTestId("unrelated-page").waitFor();assert.ok(new URL(page.url()).pathname.endsWith("/home"));
  assert.ok(!(await page.evaluate(()=>window.gets)).some(p=>p.startsWith("/api/items")));
 },{role});
 for(const role of ["staff","manager","admin"])await test("Field request manager controls respect "+role+" UI role",async({page})=>{
  await page.getByTestId("request-card-501").waitFor();await page.getByTestId("btn-request-expand-501").click();
  assert.equal(await page.getByTestId("admin-actions-501").count(),role==="staff"?0:1);
 },{role,path:"/field/transactions?tab=requests"});
 for(const branch of ["indiana","savannah"])for(const lang of ["en","ko","es"])for(const theme of ["light","dark"]){
  for(const screen of ["inventory","dashboard","requests"])await test(`actual App smoke ${branch}/${lang}/${theme}/${screen}`,async f=>{
   const {page,prefix}=f;
   await page.getByTestId(screen==="inventory"?"input-search":screen==="dashboard"?"admin-request-links":"request-card-501").waitFor();
   assert.equal(new URL(page.url()).pathname,prefix+(screen==="dashboard"?"/":screen==="inventory"?"/inventory":"/field/transactions"));
   if(branch==="indiana"&&lang==="ko")await screenshot(f,`${screen}-${theme}`);
  },{branch,lang,theme,path:screen==="dashboard"?"/":screen==="inventory"?"/inventory":"/field/transactions?tab=requests",width:theme==="light"?1280:390});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 checkUpstream();
 for(const input of inputs){assert.equal(hash(join(delivery,"prepared",input.path+".txt")),input.preparedSha256);if(input.currentRootSha256)assert.equal(hash(join(root,input.path)),input.currentRootSha256);}
 const result={typecheck:"passed",actualApp:true,actualWouter:true,scenarios:scenarios.length,cases:scenarios,browserErrors:errors.length,unexpectedRequests:unexpected.length,screenshots,
  limits:["Identity and HTTP are synthetic; no real auth, DB, storage or application access","Unrelated App pages are sentinels; relevant pages/layouts/guards/routes are real","No publishing or performance claim"]};
 if(!process.argv.some(s=>s.startsWith("--case="))){writeFileSync(join(delivery,"route-results.json"),JSON.stringify(result,null,2)+"\n");writeFileSync(join(delivery,"manifest.json"),JSON.stringify({candidateOnly:true,files:inputs},null,2)+"\n");}
 writeFileSync(join(evidence,"last-run.json"),JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}
