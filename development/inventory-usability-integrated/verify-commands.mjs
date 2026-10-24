/** Offline, synthetic verification only. Never starts or contacts the application. */
import { build } from "esbuild";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const delivery = dirname(fileURLToPath(import.meta.url)), root = resolve(delivery, "../..");
for (const key of Object.keys(process.env)) assert.ok(["PATH","HOME","LANG","LC_ALL","NODE_ENV","PWD","SHLVL","_"].includes(key), "Unexpected inherited environment key");
const read = path => readFileSync(path, "utf8");
const hash = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const walk = path => readdirSync(path, { withFileTypes:true }).flatMap(e => e.isDirectory() ? walk(join(path,e.name)) : [join(path,e.name)]);
const inputs = walk(join(delivery,"prepared")).map(path => {
  assert.ok(path.endsWith(".txt"));
  const source = relative(join(delivery,"prepared"),path).slice(0,-4);
  return { path:source, preparedSha256:hash(path), currentRootSha256:existsSync(join(root,source)) ? hash(join(root,source)) : null };
});
const upstreamInputs = ["common","media","field","admin"].flatMap(stage=>{
  const folder=join(root,"development/inventory-usability-"+stage,"prepared");
  return walk(folder).map(path=>({path:relative(root,path),sha256:hash(path)}));
});
const evidence = join(root,"generated-artifacts/inventory-usability-integrated/commands");
mkdirSync(evidence,{recursive:true});
const work = mkdtempSync(join(tmpdir(),"tk-request-operation-"));
for (const dir of ["client/src","shared","server","tests/helpers"]) cpSync(join(root,dir),join(work,dir),{recursive:true,
  filter:p=>!/(?:^|\/)(?:node_modules|\.env(?:\..*)?|storage|uploads|sessions|backups)(?:\/|$)/.test(p)});
for (const name of ["package.json","tsconfig.json","vite.config.ts","tailwind.config.ts"]) cpSync(join(root,name),join(work,name));
symlinkSync(join(root,"node_modules"),join(work,"node_modules"));
for (const stage of ["inventory-usability-integrated"]) {
  const prepared = join(root,"development",stage,"prepared");
  for (const path of walk(prepared)) {
    assert.ok(path.endsWith(".txt"));
    const out = join(work,relative(prepared,path).slice(0,-4));
    mkdirSync(dirname(out),{recursive:true}); cpSync(path,out);
  }
}
const typeInputs = dir => walk(dir).filter(p=>/\.(?:tsx?|json)$/.test(p)).sort().map(p=>relative(dir,p)+":"+hash(p)).join("\n");
const reuse = process.argv.find(arg=>arg.startsWith("--checked-work="))?.slice("--checked-work=".length);
if (reuse) {
  assert.equal(typeInputs(work),typeInputs(reuse),"Type-check inputs changed");
  console.log("Candidate TypeScript reused: identical inputs");
} else {
const checked = spawnSync(process.execPath,["--require",join(root,"tests/helpers/guardStartupPlanOffline.cjs"),
  join(root,"node_modules/typescript/bin/tsc"),"--noEmit","--incremental","false"],{
  cwd:work,encoding:"utf8",env:{PATH:process.env.PATH,LANG:"C.UTF-8"},
});
writeFileSync(join(evidence,"typecheck.log"),checked.stdout+checked.stderr);
assert.equal(checked.status,0,checked.stdout+checked.stderr);
console.log("Candidate TypeScript passed");
}
console.log("Isolated workcopy: "+work);

// Existing receipt service with a tiny query-contract double, not a database.
const service = await build({stdin:{resolveDir:work,loader:"ts",contents:`
import assert from "node:assert/strict";
import {MaterialRequestCommands} from "./server/services/materialRequestCommands";
async function check(options:any) {
 const operation={operation_id:"synthetic-op",actor_id:"actor",request_id:501,action:options.action??"edit",
   result:{operationId:"synthetic-op",request:{id:501,revision:2,notes:"must-not-leak",deleted:options.action==="delete"}}};
 const pool={connect:async()=>({release(){},query:async(sql:string)=>{
   if(sql.includes("FROM material_request_operations"))return {rows:options.absent?[]:[operation]};
   if(sql.includes("FROM material_requests"))return {rows:options.deleted?[]:[{submitted_by:options.owner??"actor"}]};
   return {rows:[]};
 }})};
 const service=new MaterialRequestCommands(pool as any,async()=>({id:"actor",status:"active",role:options.role??"staff"}));
 try {const r=await service.receipt("actor","synthetic-op");assert.ok(!options.denied);
   if(options.absent)assert.deepEqual(r,{state:"unknown"});
   else if(options.action==="delete")assert.deepEqual(r,{state:"committed",result:{operationId:"synthetic-op",request:{id:501,revision:2,deleted:true}}});
   else assert.equal(r.state,"committed");
 }catch(e:any){assert.ok(options.denied);assert.equal(e.code,"FORBIDDEN");}
}
(async()=>{
 await check({});await check({owner:"other",denied:true});await check({deleted:true,denied:true});
 await check({deleted:true,action:"delete",role:"staff",denied:true});
 await check({deleted:true,action:"delete",role:"manager"});await check({absent:true});
 console.log("Receipt service: 6 query-contract cases passed");
})().catch(e=>{console.error(e);process.exitCode=1});
`},bundle:true,write:false,platform:"node",format:"cjs"});
const serviceFile = join(work,"receipt-check.cjs");
writeFileSync(serviceFile,service.outputFiles[0].text);
const serviceRun = spawnSync(process.execPath,["--require",join(root,"tests/helpers/guardStartupPlanOffline.cjs"),serviceFile],{
  cwd:work,encoding:"utf8",env:{PATH:process.env.PATH,LANG:"C.UTF-8"},
});
assert.equal(serviceRun.status,0,serviceRun.stdout+serviceRun.stderr);
console.log(serviceRun.stdout.trim());

const fixture = await build({stdin:{resolveDir:work,loader:"tsx",contents:`
import React,{useState,useSyncExternalStore} from "react";
import {createRoot} from "react-dom/client";
import {QueryClientProvider} from "@tanstack/react-query";
import {queryClient} from "@/lib/queryClient";
import * as commands from "@/lib/requestCommands";
import * as transport from "@/lib/branchTransport";
import {LanguageProvider} from "@/hooks/use-language";
import {FieldThemeProvider} from "@/hooks/use-field-theme";
import {FieldCartProvider,useFieldCart} from "@/lib/fieldCart";
import {useFieldCommandFeedback,FieldCommandFeedback} from "@/pages/field/FieldCommandFeedback";
import {AdminRequestActions} from "@/components/admin/AdminRequestActions";
import FieldCartReview from "@/pages/field/FieldCartReview";
import FieldRequestsList from "@/pages/field/FieldRequestsList";
import {Toaster} from "@/components/ui/toaster";
import {TRANSLATIONS} from "@/lib/i18n";
window.commands=commands;window.transport=transport;window.queryClient=queryClient;
transport.setBranchAccount("actor");window.messages=TRANSLATIONS[window.config.lang];
function Probe(){
 const f=useFieldCommandFeedback(window.config.feedbackTarget??"request-501");
 window.feedback=f;
 return <FieldCommandFeedback feedback={f} onRetry={()=>void f.recover()}/>;
}
function Content(){
 const cart=useFieldCart();window.cart=cart;
 const [mounted,setMounted]=useState(true),[tick,setTick]=useState(0);
 window.mount=setMounted;window.refresh=()=>{setTick(x=>x+1);queryClient.invalidateQueries()};
 const [,navigate]=useState("");window.navigate=navigate;
 const s=window.config.screen;
 return <><div data-testid="probe-count">{tick}</div>{mounted&&(s==="admin"
  ?<AdminRequestActions req={window.req} onStatusChanged={()=>{window.statusChanges++;setTick(x=>x+1)}}/>
  :s==="cart"?<FieldCartReview/>:s==="list"?<FieldRequestsList/>:s==="probe"?<Probe/>:null)}<Toaster/></>;
}
createRoot(document.getElementById("root")).render(<QueryClientProvider client={queryClient}><LanguageProvider><FieldThemeProvider><FieldCartProvider><Content/></FieldCartProvider></FieldThemeProvider></LanguageProvider></QueryClientProvider>);
`},bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",metafile:true,
  plugins:[{name:"synthetic-boundaries",setup(b){
    b.onResolve({filter:/(?:^|\/)use-auth$/},()=>({path:"auth",namespace:"fixture"}));
    b.onLoad({filter:/.*/,namespace:"fixture"},()=>({loader:"tsx",resolveDir:work,contents:`
import {useSyncExternalStore} from "react";
const listeners=new Set();window.changeUser=id=>{window.authId=id;listeners.forEach(fn=>fn())};
export function useAuth(){const id=useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>window.authId);
return {user:id?{id,role:window.config.role,name:"Synthetic actor",status:"active"}:null,isLoading:false};}
`}));
    b.onResolve({filter:/^wouter$/},()=>({path:"router",namespace:"router"}));
    b.onLoad({filter:/.*/,namespace:"router"},()=>({loader:"tsx",resolveDir:work,contents:`
import React from "react";export const useLocation=()=>["/field/transactions?tab=requests",()=>{}];
export const useSearch=()=>"?tab=requests";export const Link=({children,href})=><a href={href}>{children}</a>;
`}));
    b.onResolve({filter:/(?:^|\/)server(?:\/|$)|^node:|^pg$|^@neondatabase\//},a=>{throw Error("Forbidden browser dependency "+a.path)});
  }}]});
assert.ok(!Object.keys(fixture.metafile.inputs).some(path=>/server\/|clerk|replit_integrations|client\/src\/(?:App|main)\./.test(path)));
const script=fixture.outputFiles[0].text;
const browser = await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",
  args:["--disable-background-networking","--disable-component-update","--disable-sync","--no-first-run","--disable-dev-shm-usage"]});
const scenarios=[],browserErrors=[],unexpected=[],screenshots=[];
async function pageFor(options={}) {
  const config={screen:"core",lang:"ko",theme:"dark",role:"manager",branch:"indiana",...options};
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:"UTC"});
  const page=await context.newPage();
  page.on("pageerror",error=>browserErrors.push(error.message));
  const url=`https://synthetic.invalid/branches/${config.branch}/field/transactions`;
  await page.route("**/*",route=>route.request().url()===url
    ?route.fulfill({contentType:"text/html",body:"<!doctype html><html><body><div id='root'></div></body></html>"})
    :route.request().isNavigationRequest() && /^https:\/\/synthetic\.invalid\/(?:login|home)$/.test(route.request().url())
    ?route.fulfill({contentType:"text/html",body:"<!doctype html><html><body>Synthetic navigation destination</body></html>"})
    :(unexpected.push(route.request().url()),route.abort()));
  await page.goto(url);
  await page.evaluate(config=>{
    window.config=config;window.authId="actor";window.statusChanges=0;
    localStorage.setItem("voltstock_lang",config.lang);localStorage.setItem("voltstock_field_theme",config.theme);
    window.item={itemId:901,itemName:"Synthetic material",sizeLabel:"1 inch",sku:"SYN-901",requestedQty:3,unit:"EA",locationName:null,imageUrl:null};
    window.req={id:501,requestNumber:"SYN-501",status:"requested",revision:7,submittedBy:"actor",submittedByName:"Synthetic actor",
      submittedAt:"2026-01-01T00:00:00Z",itemsJson:JSON.stringify([window.item]),notes:null,requestType:"issue",
      projectId:null,requesterName:null,requesterRole:null,fulfilledMovementId:null};
    window.writeMode="success";window.readMode="auto";window.writes=[];window.reads=[];window.receipts={};window.commits=0;
    window.defer=false;window.deferred=[];window.delayBody=false;window.bodyDeferred=[];window.syntheticUnexpected=[];
    window.fetch=async(input,init={})=>{
      const url=new URL(String(input),location.origin),prefix="/branches/"+config.branch;
      if(!url.pathname.startsWith(prefix+"/api/"))throw Error("Unexpected unscoped request");
      const path=url.pathname.slice(prefix.length),method=init.method??"GET";
      const json=(data,status=200)=>{
        const response=new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
        if(window.delayBody&&status===200){const original=response.json.bind(response);response.json=async()=>{
          await new Promise(resolve=>window.bodyDeferred.push(resolve));return original();
        }}
        return response;
      };
      if(method==="GET") {
        window.reads.push(path);
        if(path.startsWith("/api/field/request-operations/")){
          const id=path.split("/").pop();
          if(window.readMode==="forbidden")return json({code:"FORBIDDEN"},403);
          if(window.readMode==="malformed")return json({state:"committed",result:{operationId:id,request:{id:999,revision:3}}});
          if(window.readMode==="unknown")return json({state:"unknown"});
          return json(window.receipts[id]?{state:"committed",result:window.receipts[id]}:{state:"unknown"});
        }
        if(path==="/api/workers"||path==="/api/projects")return json([]);
        if(path==="/api/field/requests")return json([window.req]);
        if(path.startsWith("/api/media/targets/"))return json([]);
        window.syntheticUnexpected.push(path);throw Error("Unexpected synthetic read "+path);
      }
      if(!/^\/api\/field\/requests(?:\/\d+(?:\/(?:status|undo-edit|undo-complete))?)?$/.test(path)){
        window.syntheticUnexpected.push(path);throw Error("Unexpected synthetic write "+path);
      }
      const body=JSON.parse(init.body);window.writes.push({method,url:path,body,account:new Headers(init.headers).get("X-Inventory-Account")});
      if(window.defer)await new Promise(resolve=>window.deferred.push(resolve));
      const mode=window.writeMode;
      const errors={forbidden:["FORBIDDEN",403],conflict:["REQUEST_CHANGED",409],stock:["INSUFFICIENT_STOCK",409],
        location:["LOCATION_BALANCE_MISSING",409],rolledback:["COMMAND_ROLLED_BACK",409],auth:["AUTH_REQUIRED",403]};
      if(errors[mode])return json({code:errors[mode][0]},errors[mode][1]);
      if(mode==="unknown")throw Error("Synthetic response loss");
      if(mode==="malformed")return json({operationId:body.operationId,request:{id:501,revision:"bad"}});
      if(mode==="wrong-id")return json({operationId:body.operationId,request:{id:999,revision:8}});
      if(mode==="wrong-op")return json({operationId:"wrong",request:{id:501,revision:8}});
      let result=window.receipts[body.operationId];
      if(!result){
        window.commits++;
        const request={...window.req,...body.payload,revision:(body.expectedRevision??-1)+1};
        if(path.endsWith("/undo-complete"))request.status="ready";
        if(method==="DELETE")request.deleted=true;
        result={operationId:body.operationId,request};
        window.receipts[body.operationId]=result;
        window.req=request;
      }
      if(mode==="lost-once"){window.writeMode="success";throw Error("Synthetic lost commit reply");}
      return json(result);
    };
    window.attempt=async(fn)=>{try{return {ok:true,result:await fn()}}catch(e){return {ok:false,code:e.code,uncertain:e.uncertain}}};
  },config);
  await page.addScriptTag({content:script});
  await page.waitForFunction(()=>!!window.commands&&!!window.cart);
  return {page,context};
}
async function test(name,fn,options) {
  const selected=process.argv.find(arg=>arg.startsWith("--case="))?.slice("--case=".length);
  if(selected&&!name.includes(selected))return;
  const f=await pageFor(options);
  try {await fn(f.page);assert.deepEqual(await f.page.evaluate(()=>window.syntheticUnexpected??[]),[]);scenarios.push(name);console.log("PASS "+name);}
  finally {await f.context.close();}
}
const submit = page=>page.evaluate(()=>window.attempt(()=>window.commands.requestCommand("PATCH","/api/field/requests/501/status",{status:"preparing"},7)));
const pending = page=>page.evaluate(()=>window.commands.getPendingRequest("501"));
const retry = page=>page.evaluate(()=>{const p=window.commands.getPendingRequest("501");return window.attempt(()=>window.commands.retryPendingRequest(p.target,p.operationId))});
async function remount(page) {
  await page.evaluate(()=>window.mount(false));
  await page.waitForFunction(()=>!document.querySelector("[data-testid='field-command-feedback']")&&!document.querySelector("[data-testid='admin-actions-501']"));
  await page.evaluate(()=>window.mount(true));
}
try {
  await test("concurrent identical calls share one write and original ID",async page=>{
    await page.evaluate(()=>{window.defer=true;window.first=window.attempt(()=>window.commands.requestCommand("PATCH","/api/field/requests/501/status",{status:"preparing"},7));
      window.second=window.attempt(()=>window.commands.requestCommand("PATCH","/api/field/requests/501/status",{status:"preparing"},7));});
    await page.waitForFunction(()=>window.writes.length===1);
    await page.evaluate(()=>window.deferred.splice(0).forEach(fn=>fn()));
    const r=await page.evaluate(async()=>[await window.first,await window.second,window.commits]);
    assert.ok(r[0].ok&&r[1].ok);assert.equal(r[0].result.operationId,r[1].result.operationId);assert.equal(r[2],1);
  });
  for(const mode of ["forbidden","auth","conflict","stock","location","rolledback"]) {
    await test(`initial definite ${mode} releases target`,async page=>{
      await page.evaluate(mode=>window.writeMode=mode,mode);
      const failed=await submit(page);assert.equal(failed.uncertain,false);assert.equal(await pending(page),null);
      await page.evaluate(()=>window.writeMode="success");assert.equal((await submit(page)).ok,true);
    });
    await test(`uncertain then ${mode} preserves ID and captured envelope`,async page=>{
      await page.evaluate(()=>window.writeMode="unknown");
      assert.equal((await submit(page)).uncertain,true);const original=await pending(page);
      await page.evaluate(mode=>{window.writeMode=mode;window.readMode="unknown"},mode);
      assert.equal((await retry(page)).uncertain,true);
      const retained=await pending(page);assert.equal(retained.operationId,original.operationId);assert.deepEqual(retained.intent,original.intent);
      const writes=await page.evaluate(()=>window.writes);assert.deepEqual(writes[0].body,writes[1].body);
      const count=writes.length;assert.equal((await page.evaluate(()=>window.attempt(()=>window.commands.requestCommand("PATCH","/api/field/requests/501/status",{status:"cancelled"},8)))).uncertain,true);
      assert.equal(await page.evaluate(()=>window.writes.length),count);
    });
  }
  await test("committed receipt resolves lost reply without a second write",async page=>{
    await page.evaluate(()=>window.writeMode="lost-once");await submit(page);const p=await pending(page);
    const saved=await retry(page);assert.equal(saved.ok,true);assert.equal(saved.result.operationId,p.operationId);
    assert.deepEqual(await page.evaluate(()=>[window.writes.length,window.reads.length,window.commits]),[1,1,1]);assert.equal(await pending(page),null);
  });
  await test("unknown receipt replays original intent without adopting a newer revision",async page=>{
    await page.evaluate(()=>window.writeMode="unknown");await submit(page);
    await page.evaluate(()=>window.writeMode="success");const saved=await retry(page);
    assert.equal(saved.ok,true);const writes=await page.evaluate(()=>window.writes);assert.deepEqual(writes[0].body,writes[1].body);assert.equal(writes[1].body.expectedRevision,7);
  });
  await test("later permission refusal allows receipt confirmation but no further writes",async page=>{
    await page.evaluate(()=>window.writeMode="unknown");await submit(page);
    await page.evaluate(()=>window.writeMode="forbidden");await retry(page);const p=await pending(page);
    assert.equal(p.writeRetryAllowed,false);
    await page.evaluate(()=>window.writeMode="success");
    assert.equal((await retry(page)).uncertain,true);assert.equal(await page.evaluate(()=>window.writes.length),2);
    await page.evaluate(id=>window.receipts[id]={operationId:id,request:{id:501,revision:8}},p.operationId);
    assert.equal((await retry(page)).ok,true);assert.equal(await page.evaluate(()=>window.writes.length),2);
  });
  await test("receipt access refusal cannot release or disclose the original operation",async page=>{
    await page.evaluate(()=>window.writeMode="lost-once");await submit(page);
    await page.evaluate(()=>window.readMode="forbidden");
    const result=await retry(page);assert.equal(result.ok,false);assert.equal(result.result,undefined);
    assert.ok(await pending(page));assert.equal(await page.evaluate(()=>window.writes.length),1);
  });
  for(const mode of ["malformed","wrong-id","wrong-op"]) await test(`invalid response ${mode} remains uncertain`,async page=>{
    await page.evaluate(mode=>window.writeMode=mode,mode);assert.equal((await submit(page)).uncertain,true);assert.ok(await pending(page));
  });
  await test("malformed committed receipt remains uncertain and never writes",async page=>{
    await page.evaluate(()=>window.writeMode="unknown");await submit(page);await page.evaluate(()=>window.readMode="malformed");
    assert.equal((await retry(page)).uncertain,true);assert.equal(await page.evaluate(()=>window.writes.length),1);
  });
  await test("captured payload and detached read snapshots cannot mutate original intent",async page=>{
    await page.evaluate(async()=>{
      const payload={status:"preparing",nested:{value:1}};window.writeMode="unknown";
      const p=window.attempt(()=>window.commands.requestCommand("PATCH","/api/field/requests/501/status",payload,7));
      payload.nested.value=99;await p;
      const snap=window.commands.getPendingRequest("501");snap.intent.payload.nested.value=100;
    });
    assert.equal((await pending(page)).intent.payload.nested.value,1);
    await page.evaluate(()=>window.writeMode="success");await retry(page);
    assert.equal(await page.evaluate(()=>window.writes[1].body.payload.nested.value),1);
  });
  await test("completion recovery preserves original completion source for Undo",async page=>{
    await page.evaluate(()=>window.writeMode="lost-once");
    await page.evaluate(()=>window.attempt(()=>window.commands.requestCommand("PATCH","/api/field/requests/501/status",{status:"completed"},7)));
    const original=await pending(page);const saved=await retry(page);
    assert.equal(saved.ok,true);
    const undo=await page.evaluate(saved=>window.attempt(()=>window.commands.requestCommand("POST","/api/field/requests/501/undo-complete",{},saved.request.revision,saved.operationId)),saved.result);
    assert.equal(undo.ok,true);assert.equal(await page.evaluate(()=>window.writes[1].body.sourceOperationId),original.operationId);
  });
  await test("deleted receipt returns only minimal confirmation",async page=>{
    await page.evaluate(()=>window.writeMode="lost-once");
    await page.evaluate(()=>window.attempt(()=>window.commands.requestCommand("DELETE","/api/field/requests/501",{},7)));
    const saved=await retry(page);assert.deepEqual(Object.keys(saved.result.request).sort(),["deleted","id","revision"]);
  });
  await test("session invalidation during response body parsing discards late success",async page=>{
    await page.evaluate(()=>{window.delayBody=true;window.late=window.attempt(()=>window.commands.requestCommand("PATCH","/api/field/requests/501/status",{status:"preparing"},7))});
    await page.waitForFunction(()=>window.bodyDeferred.length===1);
    await page.evaluate(()=>{try{window.transport.setBranchAccount(null)}catch{}window.bodyDeferred.splice(0).forEach(fn=>fn())});
    assert.equal((await page.evaluate(()=>window.late)).ok,false);assert.equal(await pending(page),null);
    assert.equal((await submit(page)).ok,false);assert.equal(await page.evaluate(()=>window.writes.length),1);
  });
  await test("account switch cannot claim an old pending ID or send another write",async page=>{
    await page.evaluate(()=>window.writeMode="unknown");await submit(page);
    await page.evaluate(()=>{window.transport.setBranchAccount(null);try{window.transport.setBranchAccount("other")}catch{}});
    assert.equal(await pending(page),null);assert.equal((await submit(page)).ok,false);
    assert.equal(await page.evaluate(()=>window.writes.length),1);
  });
  await test("direct account change discards the business document instead of carrying its pending ID",async page=>{
    await page.evaluate(()=>window.writeMode="unknown");await submit(page);
    const navigation=page.waitForURL("https://synthetic.invalid/home");
    await page.evaluate(()=>{try{window.transport.setBranchAccount("other")}catch{}}).catch(()=>{});
    await navigation;
    assert.equal(await page.evaluate(()=>typeof window.commands),"undefined");
  });
  await test("new document has no pending memory (refresh boundary is explicit)",async page=>{
    await page.evaluate(()=>window.writeMode="unknown");await submit(page);assert.ok(await pending(page));
    const second=await pageFor();try{assert.equal(await pending(second.page),null)}finally{await second.context.close()}
  });
  for(const branch of ["indiana","savannah"]) await test(`immutable ${branch} document scopes reads and writes`,async page=>{
    await page.evaluate(()=>window.writeMode="lost-once");await submit(page);await retry(page);
    assert.equal(await page.evaluate(()=>window.writes[0].account),"actor");
    assert.equal(await page.evaluate(()=>window.transport.documentBranchPrefix),"/branches/"+branch);
  },{branch});
  await test("feedback remount recovers checking state and blocks a new intent",async page=>{
    await page.evaluate(()=>window.writeMode="unknown");await submit(page);await remount(page);
    await page.waitForFunction(()=>window.feedback?.restored&&window.feedback.phase==="checking");
    assert.equal(await page.evaluate(()=>window.feedback.locked),true);
    await page.evaluate(()=>window.writeMode="success");
    await page.getByTestId("field-retry-same-action").click();
    await page.waitForFunction(()=>window.feedback.phase==="success");
    const writes=await page.evaluate(()=>window.writes);assert.deepEqual(writes[0].body,writes[1].body);
  },{screen:"probe"});
  await test("remount during an in-flight Admin action stays locked through uncertain settlement",async page=>{
    await page.evaluate(()=>{window.defer=true;window.writeMode="unknown"});
    await page.getByTestId("btn-status-preparing-501").click();
    await page.waitForFunction(()=>window.writes.length===1);
    await remount(page);
    assert.equal(await page.getByTestId("btn-status-preparing-501").isDisabled(),true);
    await page.evaluate(()=>{window.defer=false;window.deferred.splice(0).forEach(fn=>fn())});
    await page.getByTestId("admin-retry-501").waitFor();
    await page.evaluate(()=>window.writeMode="success");await page.getByTestId("admin-retry-501").click();
    await page.waitForFunction(()=>!window.commands.getPendingRequest("501"));
    const writes=await page.evaluate(()=>window.writes);assert.deepEqual(writes[0].body,writes[1].body);
  },{screen:"admin"});
  await test("new auth render cannot show or recover another actor's pending intent",async page=>{
    await page.evaluate(()=>window.writeMode="unknown");await submit(page);
    await page.evaluate(()=>window.changeUser("other"));await page.waitForFunction(()=>!window.feedback.current());
    assert.equal(await page.evaluate(()=>window.feedback.pending),null);
    await page.evaluate(()=>window.feedback.recover());assert.equal(await page.evaluate(()=>window.writes.length),1);
  },{screen:"probe"});
  for(const lang of ["en","ko","es"]) for(const theme of ["light","dark"]) await test(`Admin remount → denied → authorized receipt ${lang}/${theme}`,async page=>{
    await page.evaluate(()=>window.writeMode="unknown");
    await page.getByTestId("btn-status-preparing-501").click();
    await page.waitForFunction(()=>window.commands.getPendingRequest("501")?.phase==="checking");
    const original=await pending(page);await remount(page);
    await page.getByTestId("admin-retry-501").waitFor();
    assert.equal(await page.getByTestId("btn-status-preparing-501").isDisabled(),true);
    await page.evaluate(()=>window.writeMode="forbidden");
    await page.getByTestId("admin-retry-501").click();
    await page.waitForFunction(()=>window.commands.getPendingRequest("501")?.writeRetryAllowed===false);
    await remount(page);await page.getByTestId("admin-retry-501").waitFor();
    await page.evaluate(id=>window.receipts[id]={operationId:id,request:{...window.req,status:"preparing",revision:8}},original.operationId);
    await page.getByTestId("admin-retry-501").click();
    await page.waitForFunction(()=>window.statusChanges===1);
    assert.equal(await pending(page),null);assert.equal(await page.evaluate(()=>window.writes.length),2);
    const path=join(evidence,`admin-confirmed-${lang}-${theme}.jpg`);
    await page.screenshot({path,type:"jpeg",quality:70});screenshots.push(relative(root,path));
  },{screen:"admin",lang,theme});
  await test("Admin completed remount recovery retains server-defined completion Undo",async page=>{
    await page.evaluate(()=>{window.req.status="ready";window.writeMode="lost-once";window.refresh()});
    await page.getByTestId("btn-status-completed-501").click();
    await page.waitForFunction(()=>window.commands.getPendingRequest("501")?.phase==="checking");
    const original=await pending(page);await remount(page);
    await page.getByTestId("admin-retry-501").click();await page.getByTestId("admin-undo-501").waitFor();
    await page.getByTestId("admin-undo-501").click();
    await page.waitForFunction(()=>window.writes.length===2&&!window.commands.getPendingRequest("501"));
    assert.equal(await page.evaluate(()=>window.writes[1].body.sourceOperationId),original.operationId);
  },{screen:"admin"});
  for(const changed of [false,true]) await test(`Field cart remount confirms original create, ${changed?"preserves newer":"clears matching"} draft`,async page=>{
    await page.evaluate(()=>{window.cart.addToCart(window.item,3);window.cart.updateMeta({requesterName:"Synthetic actor"});window.writeMode="unknown"});
    const button=page.getByTestId("btn-submit-request");
    // Existing Field button name is discovered from the actual source fixture.
    const submitButton=await button.count()?button:page.getByTestId("btn-submit-cart");
    await submitButton.click();
    await page.waitForFunction(()=>window.commands.getPendingRequest("new")?.phase==="checking");
    if(changed)await page.evaluate(()=>window.cart.updateMeta({notes:"Newer draft"}));
    await remount(page);await page.getByTestId("field-retry-same-action").first().waitFor();
    await page.evaluate(()=>window.writeMode="success");
    await page.getByTestId("field-retry-same-action").first().click();
    await page.waitForFunction(()=>!window.commands.getPendingRequest("new"));
    await page.waitForFunction(changed=>changed?window.cart.draft.meta.notes==="Newer draft":window.cart.cartItems.length===0,changed);
    const writes=await page.evaluate(()=>window.writes);assert.deepEqual(writes[0].body,writes[1].body);
    if(changed)assert.equal(await page.evaluate(()=>window.cart.cartItems.length),1);
    const path=join(evidence,`field-cart-${changed?"newer":"matching"}.jpg`);
    await page.screenshot({path,type:"jpeg",quality:70});screenshots.push(relative(root,path));
  },{screen:"cart",role:"staff"});
  await test("Field cart changing edit target cannot hide its earlier unresolved create",async page=>{
    await page.evaluate(()=>{window.cart.addToCart(window.item,3);window.writeMode="unknown"});
    await page.getByTestId("btn-submit-request").click();
    await page.waitForFunction(()=>window.commands.getPendingRequest("new")?.phase==="checking");
    await page.evaluate(()=>window.cart.replaceDraft({...window.cart.getDraft(),editingRequestId:502,editingRevision:11,editingRequestNumber:"SYN-502"},()=>true));
    await remount(page);await page.getByTestId("field-retry-same-action").first().waitFor();
    assert.equal(await page.getByTestId("btn-submit-request").isDisabled(),true);
    await page.evaluate(()=>window.writeMode="success");await page.getByTestId("field-retry-same-action").first().click();
    await page.waitForFunction(()=>!window.commands.getPendingRequest("new"));
    assert.equal(await page.evaluate(()=>window.cart.editingRequestId),502);
    assert.equal(await page.evaluate(()=>window.cart.cartItems.length),1);
    const writes=await page.evaluate(()=>window.writes);assert.deepEqual(writes[0].body,writes[1].body);
  },{screen:"cart",role:"staff"});
  await test("Field Undo remount reuses original source without inventing a lost draft snapshot",async page=>{
    await page.evaluate(async()=>{
      window.cart.addToCart(window.item,2);window.cart.updateMeta({notes:"Preserve this newer work"});
      window.writeMode="unknown";
      await window.attempt(()=>window.commands.requestCommand("POST","/api/field/requests/501/undo-edit",{},7,"original-edit-operation","cart-undo"));
    });
    await remount(page);await page.getByTestId("field-retry-same-action").waitFor();
    await page.evaluate(()=>window.writeMode="success");await page.getByTestId("field-retry-same-action").click();
    await page.waitForFunction(()=>!window.commands.getPendingRequest("501"));
    const writes=await page.evaluate(()=>window.writes);assert.deepEqual(writes[0].body,writes[1].body);
    assert.equal(writes[1].body.sourceOperationId,"original-edit-operation");
    assert.equal(await page.evaluate(()=>window.cart.draft.meta.notes),"Preserve this newer work");
    assert.equal(await page.evaluate(()=>window.cart.cartItems[0].requestedQty),2);
  },{screen:"cart",role:"staff"});
  await test("Field card remount keeps self-cancel pending locked and confirms original action",async page=>{
    await page.evaluate(()=>window.writeMode="unknown");
    await page.getByTestId("btn-request-expand-501").click();
    await page.getByTestId("btn-req-cancel-501").click();
    await page.getByTestId("btn-confirm-cancel-501").click();
    await page.waitForFunction(()=>window.commands.getPendingRequest("501")?.phase==="checking");
    await remount(page);await page.getByTestId("field-retry-same-action").waitFor();
    await page.evaluate(()=>window.writeMode="success");await page.getByTestId("field-retry-same-action").click();
    await page.waitForFunction(()=>!window.commands.getPendingRequest("501"));
    const writes=await page.evaluate(()=>window.writes);assert.deepEqual(writes[0].body,writes[1].body);
  },{screen:"list",role:"staff"});
  await test("Field inline edit remount retains captured edits and blocks a different edit",async page=>{
    await page.getByTestId("btn-request-expand-501").click();await page.getByTestId("btn-req-edit-501").click();
    await page.getByTestId("input-edit-notes").fill("Original captured edit");
    await page.evaluate(()=>window.writeMode="unknown");await page.getByTestId("btn-edit-save").click();
    await page.waitForFunction(()=>window.commands.getPendingRequest("501")?.phase==="checking");
    await remount(page);await page.getByTestId("btn-request-expand-501").click();
    assert.equal(await page.getByTestId("btn-req-edit-501").isDisabled(),true);
    await page.evaluate(()=>window.writeMode="success");await page.getByTestId("field-retry-same-action").last().click();
    await page.waitForFunction(()=>!window.commands.getPendingRequest("501"));
    const writes=await page.evaluate(()=>window.writes);assert.deepEqual(writes[0].body,writes[1].body);
    assert.equal(writes[1].body.payload.notes,"Original captured edit");
  },{screen:"list",role:"staff"});
  assert.deepEqual(browserErrors,[]);assert.deepEqual(unexpected,[]);
  for(const input of inputs)if(input.currentRootSha256)assert.equal(hash(join(root,input.path)),input.currentRootSha256,"Runtime file changed");
  for(const input of inputs)assert.equal(hash(join(delivery,"prepared",input.path+".txt")),input.preparedSha256,"Candidate changed during verification");
  for(const input of upstreamInputs)assert.equal(hash(join(root,input.path)),input.sha256,"Upstream candidate changed during verification");
  const result={typecheck:"passed",browserScenarios:scenarios.length,receiptQueryContractCases:6,scenarios,
    browserErrors:browserErrors.length,unexpectedRequests:unexpected.length,screenshots,
    limits:["No running app, real auth, DB or storage access","Wouter and API boundaries are synthetic","Refresh/tab termination intentionally does not persist intentions"]};
  if(!process.argv.some(arg=>arg.startsWith("--case="))) {
    writeFileSync(join(delivery,"command-manifest.json"),JSON.stringify({inputs,upstreamInputs},null,2)+"\n");
    writeFileSync(join(delivery,"command-results.json"),JSON.stringify(result,null,2)+"\n");
    writeFileSync(join(evidence,"results.json"),JSON.stringify(result,null,2)+"\n");
  }
  console.log(JSON.stringify(result,null,2));
} finally {await browser.close()}
