/**
 * Verification only. Never imports server/db.ts, routes.ts or app startup.
 * All SQL is confined to a NEW private PostgreSQL cluster with synthetic data.
 */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { cpus, totalmem, platform, arch } from "node:os";
import { disposableFieldPg } from "./helpers/disposableFieldPg";

const report: any = {
  startedAt: new Date().toISOString(),
  equipment: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCPUs: cpus().length,
    hostMemoryGiB: +(totalmem() / 2 ** 30).toFixed(2), note: "Shared container; host resources are not guaranteed container allocations" },
  isolation: { freshCluster: true, tcpDisabled: true, applicationReadsReadOnly: true,
    existingDBUsed: false, existingAppStarted: false, credentialsCopied: false },
  fixtureSchema: "Existing column types/defaults, PK and unique constraints; unrelated foreign keys omitted. No business schema/index changes.",
  checks: [], measurements: [],
};
let db: Awaited<ReturnType<typeof disposableFieldPg>> | undefined;
const plain = (value: any) => JSON.parse(JSON.stringify(value));
function errorSummary(e: any) {
  return { code: e.cause?.code || e.code || e.name,
    message: String(e.cause?.message || (e.name === "AssertionError" ? e.message : e.name)).slice(0, 220) };
}
async function check(name: string, action: () => Promise<void>) {
  try { await action(); report.checks.push({ name, pass: true }); console.log("PASS", name); }
  catch (e) { const error = errorSummary(e); report.checks.push({ name, pass: false, error }); console.log("FAIL", name, JSON.stringify(error)); }
}
try {
  db = await disposableFieldPg();
  report.postgresql = db.version;
  const { setup, storage, trace } = db;
  await setup.query(`INSERT INTO categories(id,name) VALUES(1,'Synthetic category one'),(2,'Synthetic category two'),(3,'Synthetic three'),(4,'Synthetic four');
    INSERT INTO locations(id,name) VALUES(1,'Synthetic warehouse one'),(2,'Synthetic warehouse two');
    INSERT INTO suppliers(id,name) VALUES(1,'Synthetic supplier');
    INSERT INTO items(id,sku,name,description,unit_of_measure,category_id,subcategory,detail_type,sub_type,
      manufacturer,size_label,quantity_on_hand,minimum_stock,reorder_point,primary_location_id,supplier_id)
    SELECT id,'SKU-'||id,'EMT synthetic '||id,'plain','FT',1,'EMT Conduit','Steel','Other','A',id::text,20,5,1,1,1
    FROM generate_series(1,10) id;
    UPDATE items SET name='EMT alpha',sku='SKU-NEEDLE',description='cobalt finish',size_label='1/2"',quantity_on_hand=4,sub_type='Coupling' WHERE id=1;
    UPDATE items SET manufacturer='B',size_label='3/4"',sub_type='Connector' WHERE id=2;
    UPDATE items SET description='cobalt finish',size_label='1"',quantity_on_hand=99,sub_type='Coupling' WHERE id=3;
    UPDATE items SET quantity_on_hand=0,size_label='2"' WHERE id=4;
    UPDATE items SET quantity_on_hand=0,status_override='ORDERED',size_label='3"' WHERE id=5;
    UPDATE items SET category_id=2,size_label='4"' WHERE id=6;
    UPDATE items SET is_active=false WHERE id=7;
    UPDATE items SET size_label='5"' WHERE id=8;
    UPDATE items SET quantity_on_hand=7,size_label='6"' WHERE id=9;
    UPDATE items SET primary_location_id=NULL,quantity_on_hand=8,size_label='7"' WHERE id=10;
    INSERT INTO wire_reels(item_id,reel_id,length_ft,location_id,is_active) VALUES
      (3,'SYN-3-1',1,1,true),(3,'SYN-3-2',1,2,true),(3,'SYN-3-X',1000,2,false),
      (8,'SYN-8',0,1,true),(9,'SYN-9-X',1000,2,false);
    INSERT INTO inventory_location_balances(item_id,location_id,quantity_on_hand) VALUES(1,1,0),(1,2,4);
    INSERT INTO item_images(item_id,image_url,sort_order) VALUES(1,'/synthetic-only/image-one.jpg',0);`);
  report.correctnessFixture = { items: 10, activeItems: 9, categories: 4, warehouses: 2,
    brands: 2, reels: 5, activeReels: 3, images: 1, locationBalances: 2 };
  const ids = async (params: any) => plain((await storage.getFieldItems({ perPage: 100, ...params })).items.map((i: any) => i.id)).sort((a: number,b: number)=>a-b);
  await check("SQL active/category/brand selection", async () => {
    assert.deepEqual(await ids({ categoryId: 1, brand: "B" }), [2]);
    assert.deepEqual(await ids({ categoryId: 2 }), [6]);
    assert.ok(!(await ids({})).includes(7));
  });
  await check("SQL brand candidates exclude inactive and other categories", async () => {
    const brands = plain(await storage.getFieldBrands({ categoryId: 1, family: "EMT" }));
    assert.deepEqual(brands.map((b: any)=>b.name).sort(), ["A","B"]);
    assert.equal(brands.reduce((n: number,b: any)=>n+b.count,0), 8);
  });
  await check("SQL brand-specific subcategory and size candidates", async () => {
    assert.deepEqual(plain(await storage.getFieldSubcategories({ categoryId: 1, family: "EMT", type: "Steel", brand: "B" })), [{name:"Connector",count:1}]);
    assert.deepEqual(plain(await storage.getFieldSizes({ categoryId: 1, brand: "B" })), ['3/4"']);
  });
  for (const [search, expected] of [["alpha",[1]],["SKU-NEEDLE",[1]],['1/2"',[1]],
    ["cobalt",[1,3]],["cobalt EMT",[1,3]],["no-match",[]]] as [string,number[]][]) {
    await check(`SQL search and size consistency: ${search}`, async () => {
      assert.deepEqual(await ids({search}), expected);
      const rows = (await storage.getFieldItems({search,perPage:100})).items;
      assert.deepEqual(plain(await storage.getFieldSizes({search})).sort(),
        plain([...new Set(rows.map((i:any)=>i.sizeLabel))]).sort());
    });
  }
  await check("SQL minimum stock (not reorderPoint) and live reel sums", async () => {
    assert.deepEqual(await ids({status:"low_stock"}), [1,3]);
    assert.deepEqual(plain(await storage.getFieldSizes({status:"low_stock"})).sort(), ['1/2"','1"'].sort());
    const live = (await storage.getFieldItems({size:'1"'})).items[0];
    assert.equal(live.quantityOnHand,2);
  });
  await check("SQL zero stock, zero-length active reels, ordered and inactive-only fallback", async () => {
    assert.deepEqual(await ids({status:"out_of_stock"}), [4,8]);
    assert.deepEqual(await ids({status:"ordered"}), [5]);
    assert.equal((await storage.getFieldItems({size:'6"'})).items[0].quantityOnHand,7);
  });
  await check("SQL combined category/family/type/brand/subcategory/search/status/size", async () => {
    assert.deepEqual(await ids({categoryId:1,family:"EMT",type:"Steel",brand:"A",subcategory:"Coupling",search:"cobalt",status:"low_stock",size:'1"'}),[3]);
  });
  await check("SQL pagination totals and rows; size candidates independent of page/selected size", async () => {
    const all = await storage.getFieldItems({categoryId:1,brand:"A",perPage:100});
    const pages = [];
    for(let page=1;page<=Math.ceil(all.total/2)+1;page++){
      const r=await storage.getFieldItems({categoryId:1,brand:"A",perPage:2,page});
      assert.equal(r.total,all.total); pages.push(...r.items.map((i:any)=>i.id));
    }
    assert.deepEqual(plain(pages),plain(all.items.map((i:any)=>i.id)));
    const sizes=await storage.getFieldSizes({categoryId:1,brand:"A"});
    assert.deepEqual(plain(await storage.getFieldSizes({categoryId:1,brand:"A",page:2,perPage:1,size:'1"'})),plain(sizes));
  });
  await check("SQL global inventory semantics: warehouse-one zero is not a warehouse filter", async () => {
    const start=trace.length;
    const all=(await storage.getFieldItems({perPage:100})).items;
    assert.equal(all.find((i:any)=>i.id===1).quantityOnHand,4);
    assert.equal(all.find((i:any)=>i.id===3).quantityOnHand,2);
    assert.equal(all.find((i:any)=>i.id===10).location,null);
    assert.ok(!trace.slice(start).some(q=>q.table==="inventory_location_balances"));
  });
  await check("SQL image attachment and read-only session retained", async () => {
    assert.equal((await storage.getFieldItems({search:"SKU-NEEDLE"})).items[0].imageUrl,"/synthetic-only/image-one.jpg");
    assert.equal((await db!.reads.query("SHOW transaction_read_only")).rows[0].transaction_read_only,"on");
  });

  report.performanceFixture = {
    scales: [1000,10000,50000,80000], allItemsActive: true, categories: 4, brandsPerCategory: 2,
    sizes: 8, subcategories: 3, minimumStock: 5,
    storedQuantity: "g%20=0..5 => 0..5; otherwise 100. Every 1000th item ordered.",
    location: "10% missing; remaining split across two locations", images: 0,
    reels: "Each fifth item has 3 active + 1 inactive reels; half such items have active total 0, half 6.",
    repeats: 3, warmups: 1, concurrency: 1, filter: {categoryId:1,brand:"A",search:"Synthetic",page:1,perPage:10},
    measurement: "End-to-end actual storage method; SQL round-trip includes transfer/decode, not EXPLAIN/server-only time",
  };
  for (const n of report.performanceFixture.scales) {
    await setup.query("TRUNCATE item_images,wire_reels,inventory_location_balances,items RESTART IDENTITY");
    await setup.query(`INSERT INTO items(id,sku,name,description,unit_of_measure,category_id,subcategory,detail_type,
      sub_type,manufacturer,size_label,quantity_on_hand,minimum_stock,primary_location_id,supplier_id,status_override)
      SELECT g,'SYN-'||g,'Synthetic EMT '||lpad(g::text,8,'0'),'Synthetic description','FT',g%4+1,
      'EMT Conduit','Steel',(ARRAY['Coupling','Connector','Other'])[g%3+1],
      CASE WHEN (g/4)%2=0 THEN 'A' ELSE 'B' END,(ARRAY['1/2','3/4','1','2','3','4','6','8'])[(g/8)%8+1],
      CASE WHEN g%20<6 THEN g%20 ELSE 100 END,5,CASE WHEN g%10=0 THEN NULL ELSE g%2+1 END,1,
      CASE WHEN g%1000=0 THEN 'ORDERED' ELSE NULL END FROM generate_series(1,$1::int) g`,[n]);
    for (const withReels of [false,true]) {
      if(withReels) await setup.query(`INSERT INTO wire_reels(item_id,reel_id,length_ft,location_id,is_active)
        SELECT g,'SYN-'||g||'-'||r,CASE WHEN r=4 THEN 999 WHEN g%10=0 THEN 0 ELSE r END,r%2+1,r<4
        FROM generate_series(5,$1::int,5) g CROSS JOIN generate_series(1,4) r`,[n]);
      await setup.query("ANALYZE items; ANALYZE wire_reels; ANALYZE item_images");
      for(const method of ["getFieldItems","getFieldSizes"]) {
        const measurement:any={items:n,reels:withReels?n/5*4:0,activeReels:withReels?n/5*3:0,method,samplesMs:[],sqlSamples:[]};
        for(let repeat=-1;repeat<3;repeat++) {
          trace.length=0;
          const start=performance.now();
          try {
            const value=await storage[method](report.performanceFixture.filter);
            const ms=+(performance.now()-start).toFixed(2);
            if(method==="getFieldItems"){ assert.equal(value.total,n/8); assert.equal(value.items.length,10); }
            else assert.equal(value.length,8);
            if(repeat<0)measurement.warmupMs=ms;
            else { measurement.samplesMs.push(ms); measurement.sqlSamples.push([...trace]); }
          } catch(e) {
            measurement.error=errorSummary(e);
            measurement.failedMs=+(performance.now()-start).toFixed(2);
            measurement.failedQueries=[...trace];
            break;
          }
        }
        if(measurement.samplesMs.length){
          const s=[...measurement.samplesMs].sort((a,b)=>a-b);
          measurement.medianMs=s[Math.floor(s.length/2)];
          measurement.minMs=s[0]; measurement.maxMs=s[s.length-1];
          const reelTimes=measurement.sqlSamples.flat().filter((q:any)=>q.table==="wire_reels").map((q:any)=>q.ms);
          measurement.meanReelQueryMs=+(reelTimes.reduce((a:number,b:number)=>a+b,0)/reelTimes.length).toFixed(2);
        }
        report.measurements.push(measurement);
        console.log("MEASURE",JSON.stringify({items:n,reels:measurement.reels,method,medianMs:measurement.medianMs,error:measurement.error}));
      }
    }
  }
} catch(e) {
  report.fatal=errorSummary(e); console.log("FATAL",JSON.stringify(report.fatal));
} finally {
  if(db) { await db.close(); report.isolation.privateClusterStoppedAndRemoved=true; }
  report.finishedAt=new Date().toISOString();
  report.summary={passed:report.checks.filter((c:any)=>c.pass).length,
    failed:report.checks.filter((c:any)=>!c.pass).length,
    successfulMeasurements:report.measurements.filter((m:any)=>!m.error).length,
    failedMeasurements:report.measurements.filter((m:any)=>m.error).length};
  await writeFile("tests/fieldFilters.pg-results.json",JSON.stringify(report,null,2)+"\n");
  console.log("SUMMARY",JSON.stringify(report.summary));
  if(report.fatal || report.summary.failed || report.summary.failedMeasurements) process.exitCode=1;
}
