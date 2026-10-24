/** Static file/hash audit only. No app imports, tests, network, credentials or Git writes. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const here=dirname(fileURLToPath(import.meta.url)),delivery=resolve(here,".."),root=resolve(delivery,"../..");
const read=p=>readFileSync(join(root,p));
const json=p=>JSON.parse(read(p));
const digest=b=>createHash("sha256").update(b).digest("hex");
const sha=p=>digest(read(p));
const git=(...a)=>execFileSync("git",a,{cwd:root,encoding:"utf8"}).trim();
const write=(p,v)=>{const out=join(here,p);mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(v,null,2)+"\n")};
const base=relative(root,delivery),manifest=json(base+"/manifest.json"),commands=json(base+"/command-manifest.json"),assembly=json(base+"/assembly.json");
assert.equal(manifest.files.length,35);assert.equal(commands.inputs.length,35);
const current=manifest.files.map(f=>{
 assert.equal(sha(base+"/prepared/"+f.path+".txt"),f.preparedSha256,"Candidate changed: "+f.path);
 assert.equal(existsSync(join(root,f.path))?sha(f.path):null,f.currentRootSha256,"Runtime baseline changed: "+f.path);
 const command=commands.inputs.find(x=>x.path===f.path);assert.ok(command);assert.equal(command.preparedSha256,f.preparedSha256);assert.equal(command.currentRootSha256,f.currentRootSha256);
 return {path:f.path,preparedSha256:f.preparedSha256,currentRootSha256:f.currentRootSha256};
});
for(const s of assembly.sourceManifests)assert.equal(sha("development/"+s.stage+"/manifest.json"),s.sha256);
for(const f of assembly.files)for(const s of f.sources)assert.equal(sha("development/"+s.stage+"/prepared/"+f.path+".txt"),s.sha256);
for(const f of commands.upstreamInputs)assert.equal(sha(f.path),f.sha256);
const routes=json(base+"/route-results.json"),results=json(base+"/command-results.json");
assert.equal(routes.scenarios,53);assert.equal(results.browserScenarios,46);assert.equal(results.receiptQueryContractCases,6);
assert.equal(routes.typecheck,"passed");
for(const r of [routes,results]){assert.equal(r.browserErrors,0);assert.equal(r.unexpectedRequests,0);}
const evidenceCommit=git("log","-1","--format=%H","--",base+"/route-results.json");
const remote=json(base+"/preservation/remote-source-index.json");
assert.equal(remote.branch,"Indiana");assert.equal(remote.recursiveTreeComplete,true);
const remoteMap=new Map(remote.files.map(f=>[f.path,f]));
const baselinePaths=execFileSync("git",["ls-files","-z","--","client/src","shared","server","tests/helpers"],{cwd:root,encoding:"utf8"})
 .split("\0").filter(p=>/\.(?:ts|tsx|css|cjs)$/.test(p));
baselinePaths.push("package.json","package-lock.json","tsconfig.json","vite.config.ts","tailwind.config.ts","attached_assets/tk_logo_1772726610288.png");
const findings=[];
const reviewedLiterals = new Map([
 ["client/src/lib/i18n.ts:15:literal-credential","English password field label, not a credential"],
 ["client/src/lib/i18n.ts:5273:literal-credential","Spanish password field label, not a credential"],
 ["server/branches/developmentRuntimeEnvironment.ts:6:literal-credential","Environment-variable key name, not its value"],
 ["server/branches/developmentRuntimeEnvironment.ts:7:literal-credential","Environment-variable key name, not its value"],
 ["server/branches/developmentRuntimeEnvironment.ts:8:literal-credential","Environment-variable key name, not its value"],
 ["server/branches/developmentRuntimeEnvironment.ts:17:literal-database-uri","Credential-free localhost URL constructor template; no username, password or real endpoint"]
]);
const baseline=baselinePaths.sort().map(path=>{
 const bytes=read(path),blob=createHash("sha1").update(Buffer.from("blob "+bytes.length+"\0")).update(bytes).digest("hex");
 // The attached logo was not tracked at its alias, but its exact bytes are
 // tracked as the application's public server logo. No employee photo is used.
 const evidenceSourcePath=path==="attached_assets/tk_logo_1772726610288.png"?"server/assets/tk_logo.png":path;
 assert.equal(blob,git("rev-parse",evidenceCommit+":"+evidenceSourcePath),"Baseline differs from evidence commit: "+path);
 const prior=remoteMap.get(evidenceSourcePath),same=prior?.gitBlobSha===blob;
 const row={path,evidenceSourcePath,sha256:digest(bytes),gitBlobSha:blob,bytes:bytes.length,source:same?
  {kind:"pinned-remote-blob",commit:remote.observedHead,path:evidenceSourcePath}:
  {kind:"inert-snapshot",path:"development/inventory-usability-integrated/preservation/baseline/"+path+".txt"}};
 if(!path.endsWith(".png")){
  const text=bytes.toString("utf8");
  const patterns=[["private-key",/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
   ["provider-token",/\b(?:gh[pousr]_[A-Za-z0-9]{25,}|sk-(?:proj-)?[A-Za-z0-9_-]{25,})\b/g],
   ["literal-database-uri",/postgres(?:ql)?:\/\/[^'"\s]+/g],
   ["literal-credential",/\b(?:password|apiKey|api_key|secret|token)\s*[:=]\s*["'][^"'\n]{6,}["']/gi]];
  for(const [kind,re]of patterns)for(const m of text.matchAll(re)){
   if(/synthetic|example|placeholder|dummy|fake|redacted|test[-_]?|not[-_]?(?:a|real)/i.test(m[0]))continue;
   const line=text.slice(0,m.index).split("\n").length,reason=reviewedLiterals.get(`${path}:${line}:${kind}`);
   findings.push({path,line,kind,reviewedHarmless:!!reason,...(reason?{reason}:{})});
  }
 }
 if(!same&&!findings.some(f=>f.path===path&&!f.reviewedHarmless)){
  assert.ok(!path.endsWith(".png"),"Brand binary drift needs separate review");
  const out=join(root,row.source.path);mkdirSync(dirname(out),{recursive:true});writeFileSync(out,bytes);
 }
 if(findings.some(f=>f.path===path&&!f.reviewedHarmless))row.reviewHold=true;
 return row;
});
write("baseline-index.json",{scope:"Reproduction inputs only; no runtime installation or execution",evidenceCommit,remoteBase:remote.observedHead,
 excluded:[".replit","environment/secrets","business records","employee documents","uploaded photos","database dumps","server/assets/tk_logo.png","server/templates/rms-template.xlsx","node_modules","generated-artifacts"],
 files:baseline});
write("source-review-findings.json",{scope:"Literal credential pattern triage; not a security scan or proof of absence of PII",
 unresolved:findings.filter(f=>!f.reviewedHarmless).length,findings});
const proofFiles=["manifest.json","command-manifest.json","assembly.json","route-results.json","command-results.json","verify-routes.mjs","verify-commands.mjs"];
write("hash-audit.json",{performedNow:"Static SHA-256/Git-blob comparison only; no tests repeated",recordedEvidenceCommit:evidenceCommit,
 candidateCount:current.length,candidatesMatchRecordedHashes:true,currentCandidateBaselinesMatchRecordedHashes:true,
 commandAndRouteCandidateSetsMatch:true,upstreamHashesMatch:true,
 reproductionInputFiles:baseline.length,reproductionInputsMatchEvidenceCommit:true,
 baselinePinnedRemoteFiles:baseline.filter(f=>f.source.kind==="pinned-remote-blob").length,
 baselineInertSnapshots:baseline.filter(f=>f.source.kind==="inert-snapshot").length,
 historicalResultsReused:{typeScript:"passed",appWouter:53,commands:46,receiptQueryContracts:6},
 newTestRuns:0,credentialTriageFindings:findings.length,unresolvedCredentialTriageFindings:findings.filter(f=>!f.reviewedHarmless).length,
 proofFiles:proofFiles.map(name=>({path:base+"/"+name,sha256:sha(base+"/"+name)})),candidates:current});
assert.equal(findings.filter(f=>!f.reviewedHarmless).length,0,"Resolve disclosure findings before preparing an upload list");
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
const upload=walk(delivery).filter(p=>p!==join(here,"upload-allowlist.json"));
for(const stage of assembly.sourceManifests){
 const dir=join(root,"development",stage.stage);
 upload.push(...walk(join(dir,"prepared")),join(dir,"manifest.json"),join(dir,"README.md"));
}
const allowed=[...new Set(upload)].sort().map(p=>{
 const path=relative(root,p);
 assert.ok(/^development\//.test(path)&&/\.(?:txt|md|json|mjs)$/.test(path),"Non-source upload candidate");
 assert.ok(!/\/(?:node_modules|generated-artifacts|attached_assets|uploads|storage|backups)\//.test(path),"Forbidden artifact path");
 const bytes=readFileSync(p);
 assert.ok(bytes.length<1024*1024,"Oversized individual preservation file");
 return {path,sha256:digest(bytes),bytes:bytes.length};
});
write("upload-allowlist.json",{candidateOnly:true,remoteWriteAuthorizedOnlyAfterAutomationGate:true,
 repository:"tkkyutae-hue/TK-ElectricMaterial-Inventory",branch:"Indiana",expectedParent:remote.observedHead,
 newRemoteCommit:null,remoteEqualityVerified:false,files:allowed,
 totalBytes:allowed.reduce((n,f)=>n+f.bytes,0),excludesLocalHistory:true,
 indexSelfHashExcluded:true});
console.log(JSON.stringify({candidateHashes:current.length,baselineFiles:baseline.length,snapshots:baseline.filter(f=>f.source.kind==="inert-snapshot").length,
 credentialFindings:findings,evidenceCommit,testsRerun:0,uploadFiles:allowed.length,totalBytes:allowed.reduce((n,f)=>n+f.bytes,0)},null,2));
