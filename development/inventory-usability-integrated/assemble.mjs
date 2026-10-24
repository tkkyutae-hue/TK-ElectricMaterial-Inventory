/** Consolidates inert candidates only. NEVER writes an application source path. */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const delivery = dirname(fileURLToPath(import.meta.url)), root = resolve(delivery,"../..");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const walk = path => readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(path,e.name)):[join(path,e.name)]);
const stages = ["inventory-usability-common","inventory-usability-media","inventory-usability-field","inventory-usability-admin","request-operation-safety"];
const records = new Map();
const sourceManifests = [];
for (const stage of stages) {
  const directory = join(root,"development",stage), rawBytes = readFileSync(join(directory,"manifest.json"));
  const raw = JSON.parse(rawBytes), inputs = Array.isArray(raw) ? raw : raw.inputs ?? raw.files ?? raw.candidates;
  assert.ok(Array.isArray(inputs), "Missing manifest inputs: "+stage);
  sourceManifests.push({stage,sha256:hash(rawBytes)});
  for (const input of inputs) {
    const bytes = readFileSync(join(directory,"prepared",input.path+".txt"));
    assert.equal(hash(bytes),input.preparedSha256,"Candidate drift: "+stage+"/"+input.path);
    const current = existsSync(join(root,input.path)) ? hash(readFileSync(join(root,input.path))) : null;
    assert.equal(current,input.currentRootSha256,"Runtime baseline drift: "+input.path);
    const existing = records.get(input.path);
    records.set(input.path,{path:input.path,currentRootSha256:current,preparedSha256:hash(bytes),
      sources:[...(existing?.sources??[]),{stage,sha256:hash(bytes)}],bytes});
  }
}
for (const record of records.values()) {
  const out = join(delivery,"prepared",record.path+".txt");
  assert.ok(out.startsWith(join(delivery,"prepared")+ "/"));
  if (existsSync(out)) assert.equal(hash(readFileSync(out)),record.preparedSha256,
    "Refusing to overwrite a reviewed integration adjustment: "+relative(delivery,out));
  else {mkdirSync(dirname(out),{recursive:true});writeFileSync(out,record.bytes);}
}
writeFileSync(join(delivery,"assembly.json"),JSON.stringify({
  candidateOnly:true,sourceManifests,
  files:[...records.values()].map(({bytes,...record})=>record),
},null,2)+"\n");
console.log(`Consolidated ${records.size} inert full-source candidates; runtime files unchanged.`);
