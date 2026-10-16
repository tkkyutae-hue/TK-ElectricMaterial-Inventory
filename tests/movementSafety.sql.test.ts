import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { disposableMovementPg } from "./helpers/disposableMovementPg";
import { MaterialRequestCommands } from "../server/services/materialRequestCommands";

let fixture: Awaited<ReturnType<typeof disposableMovementPg>>;
let storage: any, service: MaterialRequestCommands;
before(async () => {
  fixture = await disposableMovementPg();
  storage = fixture.storage;
  service = new MaterialRequestCommands(fixture.pool);
});
after(async () => { await fixture?.close(); });
beforeEach(async () => {
  await fixture.pool.query(`TRUNCATE inventory_movements,project_material_transactions,
    material_request_operations,material_requests,movement_drafts,wire_reel_movement_lines,
    wire_reels,items,suppliers,users RESTART IDENTITY CASCADE;
    INSERT INTO users(id,name,role,status) VALUES('synthetic','Synthetic','admin','active');
    INSERT INTO suppliers(id,name) VALUES(1,'Synthetic supplier');
    INSERT INTO items(id,sku,name,unit_of_measure,quantity_on_hand) VALUES
      (1,'SYN-1','Synthetic one','EA',100),(2,'SYN-2','Synthetic two','EA',2);`);
});
const qty = async (id = 1) => (await fixture.pool.query("SELECT quantity_on_hand q FROM items WHERE id=$1", [id])).rows[0].q;
const movements = async () => (await fixture.pool.query("SELECT * FROM inventory_movements ORDER BY id")).rows;
const create = (type: string, quantity: number, extra = {}) => storage.createInventoryMovement({
  itemId: 1, movementType: type, quantity, previousQuantity: 100,
  newQuantity: type === "issue" ? 100 - quantity : 100 + quantity, ...extra,
});
const draft = (type = "receive", rows = [{ itemId: 1, qty: 10, supplierId: 1 }]) =>
  storage.createDraft({ movementType: type, itemsJson: JSON.stringify(rows), savedBy: "synthetic" });

test("two receives with the same stale snapshot both accumulate with coherent history", async () => {
  await Promise.all([create("receive", 10), create("receive", 10)]);
  assert.equal(await qty(), 120);
  assert.deepEqual((await movements()).map(r => [r.previous_quantity, r.new_quantity]), [[100,110],[110,120]]);
});
test("two returns accumulate without imposing new return policy", async () => {
  await Promise.all([create("return", 5), create("return", 5)]);
  assert.equal(await qty(), 110);
});
test("competing issues cannot overspend; only committed issue has a history row", async () => {
  const results = await Promise.allSettled([create("issue", 70), create("issue", 70)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(await qty(), 30);
  assert.equal((await movements()).length, 1);
});
test("sequential receive/issue/return recomputes even if caller quantities are stale", async () => {
  await create("receive", 10); await create("issue", 7); await create("return", 3);
  assert.equal(await qty(), 106);
});
test("same draft confirmed concurrently is consumed only once", async () => {
  const d = await draft();
  const results = await Promise.allSettled([storage.confirmDraft(d.id, "synthetic"), storage.confirmDraft(d.id, "synthetic")]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(await qty(), 110);
  assert.equal((await movements()).length, 1);
  assert.equal(await storage.getDraft(d.id), undefined);
});
test("different draft confirmations and normal issue cannot overspend", async () => {
  const a = await draft("issue", [{itemId:1,qty:60,supplierId:1}]);
  const b = await draft("issue", [{itemId:1,qty:60,supplierId:1}]);
  const results = await Promise.allSettled([storage.confirmDraft(a.id,"synthetic"), storage.confirmDraft(b.id,"synthetic"), create("issue",60)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(await qty(), 40);
  assert.equal((await movements()).length, 1);
});
test("later draft shortage rolls back prior movement and preserves draft", async () => {
  const d = await draft("issue", [{itemId:1,qty:10,supplierId:1},{itemId:2,qty:3,supplierId:1}]);
  await assert.rejects(storage.confirmDraft(d.id,"synthetic"));
  assert.equal(await qty(),100); assert.equal(await qty(2),2);
  assert.equal((await movements()).length,0);
  assert.ok(await storage.getDraft(d.id));
});
test("supplier survives real draft storage/load/confirmation", async () => {
  const d = await draft();
  assert.equal(JSON.parse((await storage.getDraft(d.id)).itemsJson)[0].supplierId,1);
  await storage.confirmDraft(d.id,"synthetic");
  assert.equal((await movements())[0].supplier_id,1);
});
test("legacy draft without supplier remains null, not guessed", async () => {
  const d = await draft("receive", [{itemId:1,qty:4}] as any);
  await storage.confirmDraft(d.id,"synthetic");
  assert.equal((await movements())[0].supplier_id,null);
});
test("bulk restore preserves suppliers and uses current quantities", async () => {
  const result = await storage.bulkRestoreMovements([
    {id:10,itemId:1,movementType:"receive",quantity:3,supplierId:1},
    {id:11,itemId:1,movementType:"receive",quantity:4,supplierId:null},
  ]);
  assert.equal(result.restored.length,2); assert.equal(result.errors.length,0);
  assert.deepEqual((await movements()).map(r => r.supplier_id),[1,null]);
  assert.equal(await qty(),107);
  assert.deepEqual((await movements()).map(r=>[r.previous_quantity,r.new_quantity]),[[100,103],[103,107]]);
});
test("invalid supplier insertion fails without altering inventory/history", async () => {
  await assert.rejects(create("receive",5,{supplierId:999}));
  assert.equal(await qty(),100); assert.equal((await movements()).length,0);
});
test("request completion competes safely with ordinary issue", async () => {
  let r = (await service.execute("synthetic",{operationId:randomUUID(),action:"create",payload:{
    itemsJson:JSON.stringify([{itemId:1,requestedQty:70}]),requestType:"issue",
  }})).request;
  for (const status of ["preparing","ready"]) {
    r=(await service.execute("synthetic",{operationId:randomUUID(),action:"status",requestId:r.id,expectedRevision:r.revision,payload:{status}})).request;
  }
  const outcomes = await Promise.allSettled([
    service.execute("synthetic",{operationId:randomUUID(),action:"status",requestId:r.id,expectedRevision:r.revision,payload:{status:"completed"}}),
    create("issue",70),
  ]);
  assert.equal(outcomes.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(await qty(),30); assert.equal((await movements()).length,1);
});

test("ordinary stale issue cannot overwrite an already completed request's deduction", async () => {
  let r=(await service.execute("synthetic",{operationId:randomUUID(),action:"create",payload:{
    itemsJson:JSON.stringify([{itemId:1,requestedQty:70}]),requestType:"issue",
  }})).request;
  for(const status of ["preparing","ready","completed"]) {
    r=(await service.execute("synthetic",{operationId:randomUUID(),action:"status",requestId:r.id,expectedRevision:r.revision,payload:{status}})).request;
  }
  await assert.rejects(create("issue",70));
  await create("receive",5);
  assert.equal(await qty(),35);
  assert.equal((await movements()).length,2);
});
test("inventory UPDATE failure rolls back inserted movement", async () => {
  await fixture.pool.query(`CREATE FUNCTION synthetic_fail_update() RETURNS trigger LANGUAGE plpgsql AS
    $$ BEGIN RAISE EXCEPTION 'synthetic forced failure'; END $$;
    CREATE TRIGGER synthetic_fail BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION synthetic_fail_update();`);
  try {
    await assert.rejects(create("receive",5));
    assert.equal(await qty(),100); assert.equal((await movements()).length,0);
  } finally {
    await fixture.pool.query("DROP TRIGGER synthetic_fail ON items; DROP FUNCTION synthetic_fail_update()");
  }
});
test("reel shortage rolls back draft quantity and history; supplier reaches incoming reels", async () => {
  const incoming=await draft("receive",[{itemId:1,qty:10,supplierId:1,newReels:[{reelId:"SYN-R",lengthFt:10}]}] as any);
  await storage.confirmDraft(incoming.id,"synthetic");
  const reel=(await fixture.pool.query("SELECT * FROM wire_reels")).rows[0];
  assert.equal(reel.supplier_id,1);
  const outgoing=await draft("issue",[{itemId:1,qty:11,reelSelections:{[reel.id]:11}}] as any);
  await assert.rejects(storage.confirmDraft(outgoing.id,"synthetic"));
  assert.equal(await qty(),110); assert.equal((await movements()).length,1);
  assert.ok(await storage.getDraft(outgoing.id));
});
test("opposite draft item ordering avoids inconsistent quantities", async () => {
  const a=await draft("receive",[{itemId:1,qty:1},{itemId:2,qty:1}] as any);
  const b=await draft("receive",[{itemId:2,qty:1},{itemId:1,qty:1}] as any);
  await Promise.all([storage.confirmDraft(a.id,"synthetic"),storage.confirmDraft(b.id,"synthetic")]);
  assert.equal(await qty(),102); assert.equal(await qty(2),4);
});
test("invalid and conflicting supplier drafts fail without consumption", async () => {
  for (const rows of [[{itemId:1,qty:1,supplierId:-1}], [{itemId:1,qty:1,supplierId:1},{itemId:2,qty:1}]]) {
    const d=await draft("receive",rows as any);
    await assert.rejects(storage.confirmDraft(d.id,"synthetic"));
    assert.ok(await storage.getDraft(d.id));
  }
  assert.equal(await qty(),100); assert.equal((await movements()).length,0);
});
test("concurrent restores serialize against normal receives and preserve supplier", async () => {
  const results=await Promise.all([
    storage.bulkRestoreMovements([{id:9,itemId:1,movementType:"receive",quantity:10,supplierId:1}]),
    create("receive",5),
  ]);
  assert.equal(results[0].errors.length,0);
  assert.equal(await qty(),115); assert.equal((await movements()).length,2);
  assert.equal((await movements()).filter(r=>r.supplier_id===1).length,1);
});
test("string draft quantities cannot concatenate into inventory", async () => {
  const d=await draft("receive",[{itemId:1,qty:"10"}] as any);
  await assert.rejects(storage.confirmDraft(d.id,"synthetic"));
  assert.equal(await qty(),100); assert.equal((await movements()).length,0);
  assert.ok(await storage.getDraft(d.id));
});
