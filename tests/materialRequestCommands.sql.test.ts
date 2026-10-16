/**
 * REAL PostgreSQL, but exclusively a fresh /tmp cluster. Never imports db.ts,
 * storage.ts, routes.ts or app startup, and never reads connection secrets.
 * TCP listening is disabled. Only private Unix sockets are used.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import express from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";
import { isSessionAuthenticated, loadRequestUser } from "../server/services/requestIdentity";
import { MaterialRequestCommands, RequestCommandError, type RequestCommand } from "../server/services/materialRequestCommands";
import { registerMaterialRequestCommands } from "../server/services/materialRequestRoutes";
import { assertStandaloneMovement } from "../server/services/requestMovementGuard";

let root: string, pool: pg.Pool, service: MaterialRequestCommands;
let started = false;
function command(bin: string, args: string[]) {
  const result = spawnSync(bin, args, {
    env: { PATH: process.env.PATH!, HOME: root, LANG: "C", LC_ALL: "C" }, encoding: "utf8",
  });
  if (result.status !== 0) throw Error(`Disposable PostgreSQL ${bin} failed (no existing DB attempted)`);
}
before(async () => {
  root = await mkdtemp(join(tmpdir(), "tk-request-only-"));
  const socket = join(root, "socket");
  await mkdir(socket, { mode: 0o700 });
  command("initdb", ["-D", join(root, "data"), "--no-locale", "-A", "trust"]);
  command("pg_ctl", ["-D", join(root, "data"), "-l", join(root, "postgres.log"),
    "-o", `-c listen_addresses='' -c unix_socket_directories='${socket}' -c unix_socket_permissions=0700 -p 6543`, "-w", "start"]);
  started = true;
  pool = new pg.Pool({
    host: socket, port: 6543, database: "postgres", user: userInfo().username,
    password: async () => "", ssl: false, max: 12,
  });
  assert.equal((await pool.query("SHOW listen_addresses")).rows[0].listen_addresses, "");
  await pool.query(`
    CREATE TABLE users(id text PRIMARY KEY,name text,role text,status text);
    INSERT INTO users VALUES('owner','Mock owner','staff','active'),('other','Mock other','staff','active'),
      ('admin','Mock admin','admin','active');
    CREATE TABLE locations(id serial PRIMARY KEY,name text);
    INSERT INTO locations VALUES(1,'Mock warehouse');
    CREATE TABLE projects(id integer PRIMARY KEY);
    INSERT INTO projects VALUES(9);
    CREATE TABLE items(id serial PRIMARY KEY,quantity_on_hand integer NOT NULL,is_active boolean DEFAULT true,updated_at timestamp);
    INSERT INTO items VALUES(1,100,true,NULL),(2,2,true,NULL);
    CREATE TABLE inventory_location_balances(id serial PRIMARY KEY,item_id integer,location_id integer,quantity_on_hand integer,updated_at timestamp);
    INSERT INTO inventory_location_balances VALUES(1,1,1,100,NULL);
    CREATE TABLE material_requests(id serial PRIMARY KEY,revision integer NOT NULL DEFAULT 0,request_number text NOT NULL,
      submitted_by text,submitted_by_name text,status text DEFAULT 'requested',request_type text DEFAULT 'issue',
      items_json text,project_id integer REFERENCES projects(id),requester_name text,requester_role text,notes text,fulfilled_movement_id integer);
    CREATE TABLE inventory_movements(id serial PRIMARY KEY,item_id integer REFERENCES items(id),movement_type text,
      quantity integer,previous_quantity integer,new_quantity integer,source_location_id integer REFERENCES locations(id),project_id integer REFERENCES projects(id),
      reference_type text,reference_id text,created_by text,created_at timestamp DEFAULT now());
    CREATE TABLE project_material_transactions(id serial PRIMARY KEY,project_id integer REFERENCES projects(id),item_id integer REFERENCES items(id),movement_id integer REFERENCES inventory_movements(id),
      transaction_type text,quantity integer);
    CREATE TABLE material_request_operations(operation_id text PRIMARY KEY,actor_id text NOT NULL,request_id integer NOT NULL,
      action text NOT NULL,fingerprint text NOT NULL,before_state jsonb,result jsonb NOT NULL,effects jsonb NOT NULL,
      created_at timestamp NOT NULL DEFAULT now());
  `);
  service = new MaterialRequestCommands(pool);
});
after(async () => {
  await pool?.end();
  if (started) command("pg_ctl", ["-D", join(root, "data"), "-m", "fast", "-w", "stop"]);
  if (root) await rm(root, { recursive: true, force: true });
});

const data = (notes = "A", lines = [{ itemId: 1, requestedQty: 3 }]) => ({
  itemsJson: JSON.stringify(lines), requestType: "issue", notes, projectId: null,
  requesterName: "Mock requester", requesterRole: "Mock role",
});
async function run(action: RequestCommand["action"], request?: any, payload?: any, sourceOperationId?: string, actor = "owner") {
  return service.execute(actor, {
    operationId: randomUUID(), action, requestId: request?.id, expectedRevision: request?.revision, payload, sourceOperationId,
  });
}
const create = (payload = data()) => run("create", undefined, payload);
async function ready(payload = data()) {
  let r = (await create(payload)).request;
  r = (await run("status", r, { status: "preparing" }, undefined, "admin")).request;
  return (await run("status", r, { status: "ready" }, undefined, "admin")).request;
}
async function code(promise: Promise<any>, expected: string) {
  await assert.rejects(promise, e => e instanceof RequestCommandError && e.code === expected);
}
async function quantity(id = 1) {
  return (await pool.query("SELECT quantity_on_hand FROM items WHERE id=$1", [id])).rows[0].quantity_on_hand;
}

test("SQL: A -> B -> Undo restores exactly A, and old Undo cannot run twice", async () => {
  const a = (await create()).request;
  const b = await run("edit", a, data("B"));
  const undo = await run("undo_edit", b.request, {}, b.operationId);
  for (const key of ["itemsJson", "requestType", "projectId", "requesterName", "requesterRole", "notes"]) {
    assert.deepEqual(undo.request[key], a[key]);
  }
  assert.equal(undo.request.revision, a.revision + 2);
  await code(run("undo_edit", b.request, {}, b.operationId), "REQUEST_CHANGED");
});

test("SQL: other employee change and B -> C -> B invalidate the old Undo (ABA)", async () => {
  const a = (await create()).request;
  const b = await run("edit", a, data("B"));
  const c = await run("edit", b.request, data("C"), undefined, "admin");
  const sameB = await run("edit", c.request, data("B"), undefined, "admin");
  assert.equal(sameB.request.notes, b.request.notes);
  await code(run("undo_edit", b.request, {}, b.operationId), "REQUEST_CHANGED");
});

test("SQL: concurrent edits accept exactly one expected revision", async () => {
  const a = (await create()).request;
  const outcomes = await Promise.allSettled([run("edit", a, data("B")), run("edit", a, data("C"))]);
  assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(x => x.status === "rejected").length, 1);
});

test("SQL: duplicate completion processes one inventory effect, never partial success", async () => {
  const r = await ready();
  const before = await quantity();
  const outcomes = await Promise.allSettled([
    run("status", r, { status: "completed" }, undefined, "admin"),
    run("status", r, { status: "completed" }, undefined, "admin"),
  ]);
  assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(await quantity(), before - 3);
  const rows = await pool.query("SELECT * FROM inventory_movements WHERE reference_id=$1", [String(r.id)]);
  assert.equal(rows.rows.length, 1);
  const winner = outcomes.find(x => x.status === "fulfilled") as PromiseFulfilledResult<any>;
  const undone = await run("undo_complete", winner.value.request, {}, winner.value.operationId, "admin");
  assert.equal(undone.request.status, "ready");
  assert.equal(await quantity(), before);
});

test("SQL: cancel versus completion and edit versus status race consistently", async () => {
  const r = await ready();
  const before = await quantity();
  const outcomes = await Promise.allSettled([
    run("status", r, { status: "completed" }, undefined, "admin"),
    run("status", r, { status: "cancelled" }, undefined, "admin"),
    run("edit", r, data("competing"), undefined, "admin"),
  ]);
  assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
  const actual = (await pool.query("SELECT * FROM material_requests WHERE id=$1", [r.id])).rows[0];
  assert.equal(await quantity(), before - (actual.status === "completed" ? 3 : 0));
});

test("SQL: shortage/invalid later item rollback every prior movement and request change", async () => {
  for (const badId of [2, 999]) {
    const r = await ready(data("atomic", [{ itemId: 1, requestedQty: 1 }, { itemId: badId, requestedQty: 5 }]));
    const before = await quantity();
    await code(run("status", r, { status: "completed" }, undefined, "admin"),
      badId === 2 ? "INSUFFICIENT_STOCK" : "INVALID_ITEM");
    assert.equal(await quantity(), before);
    assert.equal((await pool.query("SELECT id FROM inventory_movements WHERE reference_id=$1", [String(r.id)])).rows.length, 0);
    assert.equal((await pool.query("SELECT revision FROM material_requests WHERE id=$1", [r.id])).rows[0].revision, r.revision);
  }
});

test("SQL: forced SQL failure rolls back all effects and produces no success receipt", async () => {
  const r = await ready();
  const before = await quantity();
  await pool.query(`CREATE FUNCTION mock_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'mock failure'; END $$;
    CREATE TRIGGER mock_fail BEFORE UPDATE ON material_requests FOR EACH ROW
    WHEN (NEW.status='completed') EXECUTE FUNCTION mock_failure();`);
  const operationId = randomUUID();
  try {
    await assert.rejects(service.execute("admin", {
      action: "status", requestId: r.id, expectedRevision: r.revision, payload: { status: "completed" }, operationId,
    }));
    assert.equal(await quantity(), before);
    assert.deepEqual(await service.receipt("admin", operationId), { state: "unknown" });
  } finally {
    await pool.query("DROP TRIGGER mock_fail ON material_requests; DROP FUNCTION mock_failure()");
  }
});

test("SQL: lost response, concurrent identical retries and new service instance replay one durable receipt", async () => {
  const command: RequestCommand = { action: "create", operationId: randomUUID(), payload: data("one intent") };
  const [a, b] = await Promise.all([service.execute("owner", command), service.execute("owner", command)]);
  assert.equal(a.request.id, b.request.id);
  const restarted = new MaterialRequestCommands(pool);
  const replay = await restarted.execute("owner", command);
  assert.equal(replay.replayed, true);
  assert.equal(replay.request.id, a.request.id);
  assert.equal((await restarted.receipt("owner", command.operationId)).state, "committed");
  await code(restarted.execute("owner", { ...command, payload: data("different") }), "OPERATION_REUSED");
});

test("SQL: missing revision blocked, wrong actor blocked, revocation checked at actual mutation", async () => {
  const a = (await create()).request;
  await code(service.execute("owner", { action: "edit", operationId: randomUUID(), requestId: a.id, payload: data() }), "REVISION_REQUIRED");
  await code(run("edit", a, data(), undefined, "other"), "FORBIDDEN");
  const blocker = await pool.connect();
  await blocker.query("BEGIN");
  await blocker.query("UPDATE users SET role='viewer' WHERE id='owner'");
  const saving = run("edit", a, data("not allowed"));
  await blocker.query("COMMIT");
  blocker.release();
  await code(saving, "FORBIDDEN");
  await pool.query("UPDATE users SET role='staff' WHERE id='owner'");
});

test("SQL: new-request Undo cancellation rejects follow-up status/content changes", async () => {
  const original = await create();
  const changed = await run("edit", original.request, data("other change"), undefined, "admin");
  await code(run("status", original.request, { status: "cancelled" }, original.operationId), "REQUEST_CHANGED");
  assert.equal(changed.request.status, "requested");
  const untouched = await create();
  const cancelled = await run("status", untouched.request, { status: "cancelled" }, untouched.operationId);
  assert.equal(cancelled.request.status, "cancelled");
});

test("SQL: source balance and project ledger commit/reverse together; edited fulfillment blocks Undo", async () => {
  const payload = { ...data("warehouse", [{ itemId: 1, requestedQty: 2, locationName: "Mock warehouse" } as any]), projectId: 9 };
  const r = await ready(payload);
  const balance = (await pool.query("SELECT quantity_on_hand FROM inventory_location_balances WHERE id=1")).rows[0].quantity_on_hand;
  const done = await run("status", r, { status: "completed" }, undefined, "admin");
  assert.equal((await pool.query("SELECT quantity_on_hand FROM inventory_location_balances WHERE id=1")).rows[0].quantity_on_hand, balance - 2);
  await run("undo_complete", done.request, {}, done.operationId, "admin");
  assert.equal((await pool.query("SELECT quantity_on_hand FROM inventory_location_balances WHERE id=1")).rows[0].quantity_on_hand, balance);
  const next = await ready();
  const complete = await run("status", next, { status: "completed" }, undefined, "admin");
  await pool.query("UPDATE inventory_movements SET quantity=quantity+1 WHERE id=$1", [complete.request.fulfilledMovementId]);
  await code(run("undo_complete", complete.request, {}, complete.operationId, "admin"), "FULFILLMENT_CHANGED");
});

test("SQL: deletion is version guarded and its lost response can be replayed", async () => {
  const r = (await create()).request;
  const command: RequestCommand = {
    action: "delete", operationId: randomUUID(), requestId: r.id, expectedRevision: r.revision,
  };
  const deleted = await service.execute("admin", command);
  assert.equal(deleted.request.deleted, true);
  assert.equal((await service.execute("admin", command)).replayed, true);
});

test("SQL: concurrent different requests cannot overspend a shared item's stock", async () => {
  await pool.query("INSERT INTO items VALUES(3,5,true,NULL)");
  const a = await ready(data("one", [{ itemId: 3, requestedQty: 4 }]));
  const b = await ready(data("two", [{ itemId: 3, requestedQty: 4 }]));
  const outcomes = await Promise.allSettled([
    run("status", a, { status: "completed" }, undefined, "admin"),
    run("status", b, { status: "completed" }, undefined, "admin"),
  ]);
  assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(await quantity(3), 1);
});

test("SQL: completed/cancelled rows reject edit Undo; transfer without destination fails closed", async () => {
  const a = (await create()).request;
  const edited = await run("edit", a, data("B"));
  const cancelled = await run("status", edited.request, { status: "cancelled" }, undefined, "admin");
  await code(run("undo_edit", cancelled.request, {}, edited.operationId), "STATE_CHANGED");
  const transfer = await ready({ ...data(), requestType: "transfer" });
  const before = await quantity();
  await code(run("status", transfer, { status: "completed" }, undefined, "admin"), "TRANSFER_DESTINATION_REQUIRED");
  assert.equal(await quantity(), before);
});

test("route adapter: every old unconditional mutation is rejected without fall-through", async () => {
  const routes: Array<{ method: string; path: string; handler: any }> = [];
  const app: any = {};
  for (const method of ["post", "patch", "delete", "get"]) {
    app[method] = (path: string, ...handlers: any[]) => routes.push({ method, path, handler: handlers.at(-1) });
  }
  registerMaterialRequestCommands(app, pool, (() => {}) as any, (() => {}) as any);
  const writes = routes.filter(r => r.method !== "get");
  assert.equal(writes.length, 6);
  for (const route of writes) {
    let status = 200, body: any;
    const res: any = { status(n: number) { status = n; return this; }, json(value: any) { body = value; } };
    await route.handler({ user: { id: "owner" }, params: { id: "1" }, body: {} }, res);
    assert.equal(status, 428);
    assert.equal(body.code, "OPERATION_ID_REQUIRED");
    if (route.path !== "/api/field/requests") {
      await route.handler({ user: { id: "owner" }, params: { id: "1" }, body: { operationId: randomUUID() } }, res);
      assert.equal(status, 428);
      assert.equal(body.code, "REVISION_REQUIRED");
    }
  }
});

test("direct linked-movement writes fail closed without changing unrelated movement types", () => {
  assert.throws(() => assertStandaloneMovement({ referenceType: "material_request" }));
  assert.doesNotThrow(() => assertStandaloneMovement({ referenceType: "manual" }));
  assert.doesNotThrow(() => assertStandaloneMovement({ referenceType: null }));
});

test("SQL: proposed constant revision default needs no corrective row backfill on PostgreSQL 16", async () => {
  await pool.query("CREATE TABLE mock_legacy_requests(id integer PRIMARY KEY,notes text)");
  await pool.query("INSERT INTO mock_legacy_requests VALUES(1,'Mock preexisting record')");
  const before = (await pool.query("SELECT notes,xmin::text,ctid::text FROM mock_legacy_requests WHERE id=1")).rows[0];
  await pool.query("ALTER TABLE mock_legacy_requests ADD COLUMN revision integer NOT NULL DEFAULT 0");
  const after = (await pool.query("SELECT notes,xmin::text,ctid::text,revision FROM mock_legacy_requests WHERE id=1")).rows[0];
  assert.equal(after.revision, 0);
  assert.deepEqual({ notes: after.notes, xmin: after.xmin, ctid: after.ctid }, before);
});

test("SQL: receipt and replay use CURRENT ownership, not the original permission", async () => {
  const command: RequestCommand = { action: "create", operationId: randomUUID(), payload: data("private A") };
  const created = await service.execute("owner", command);
  await pool.query("UPDATE material_requests SET submitted_by='other',revision=revision+1 WHERE id=$1", [created.request.id]);
  const before = (await pool.query("SELECT * FROM material_requests WHERE id=$1", [created.request.id])).rows[0];
  await code(service.receipt("owner", command.operationId), "FORBIDDEN");
  await code(service.execute("owner", command), "FORBIDDEN");
  assert.deepEqual((await pool.query("SELECT * FROM material_requests WHERE id=$1", [created.request.id])).rows[0], before);
  assert.deepEqual(await service.receipt("other", command.operationId), { state: "unknown" });
});

test("SQL: role/status revocation protects both receipt reads and replays without re-execution", async () => {
  const a = (await create()).request;
  const command: RequestCommand = { action: "edit", requestId: a.id, expectedRevision: a.revision,
    operationId: randomUUID(), payload: data("manager result") };
  const saved = await service.execute("admin", command);
  try {
    for (const [role, status] of [["staff", "active"], ["viewer", "active"], ["admin", "inactive"]]) {
      await pool.query("UPDATE users SET role=$1,status=$2 WHERE id='admin'", [role, status]);
      await code(service.receipt("admin", command.operationId), "FORBIDDEN");
      await code(service.execute("admin", command), "FORBIDDEN");
      assert.equal((await pool.query("SELECT revision FROM material_requests WHERE id=$1", [a.id])).rows[0].revision, saved.request.revision);
    }
  } finally { await pool.query("UPDATE users SET role='admin',status='active' WHERE id='admin'"); }
  assert.equal((await service.execute("admin", command)).replayed, true);
});

test("SQL: operation ID rejects another actor, target, action and body; exact replay makes no new change", async () => {
  const a = (await create()).request, other = (await create()).request;
  const command: RequestCommand = { action: "edit", requestId: a.id, expectedRevision: a.revision,
    operationId: randomUUID(), payload: data("B bound") };
  const saved = await service.execute("owner", command);
  await code(service.execute("admin", command), "OPERATION_REUSED");
  await code(service.execute("owner", { ...command, requestId: other.id }), "OPERATION_REUSED");
  await code(service.execute("owner", { ...command, action: "status" }), "OPERATION_REUSED");
  await code(service.execute("owner", { ...command, payload: data("tampered") }), "OPERATION_REUSED");
  assert.equal((await service.execute("owner", command)).request.revision, saved.request.revision);
  assert.equal((await pool.query("SELECT revision FROM material_requests WHERE id=$1", [a.id])).rows[0].revision, saved.request.revision);
});

test("SQL: deletion confirms only a minimal tombstone to the original currently privileged deleter", async () => {
  const original: RequestCommand = { action: "create", operationId: randomUUID(), payload: data("private deleted notes") };
  const a = (await service.execute("owner", original)).request;
  const command: RequestCommand = { action: "delete", requestId: a.id, expectedRevision: a.revision, operationId: randomUUID() };
  const result = await service.execute("admin", command);
  assert.deepEqual(Object.keys(result.request).sort(), ["deleted", "id", "revision"]);
  assert.deepEqual((await service.receipt("admin", command.operationId) as any).result, result);
  assert.equal((await service.execute("admin", command)).replayed, true);
  assert.deepEqual(await service.receipt("other", command.operationId), { state: "unknown" });
  await code(service.receipt("owner", original.operationId), "FORBIDDEN");
  await code(service.execute("owner", original), "FORBIDDEN");
  try {
    await pool.query("UPDATE users SET role='staff' WHERE id='admin'");
    await code(service.receipt("admin", command.operationId), "FORBIDDEN");
    await code(service.execute("admin", command), "FORBIDDEN");
  } finally { await pool.query("UPDATE users SET role='admin' WHERE id='admin'"); }
  assert.equal((await pool.query("SELECT id FROM material_requests WHERE id=$1", [a.id])).rows.length, 0);
});

/** Real Express chain, entirely in memory: no listen(), HTTP server or network. */
function dispatch(app: express.Express, method: string, url: string, actor?: string, body: any = {}) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const socket = new Duplex({ read() {}, write(_chunk, _encoding, cb) { cb(); } });
    const req = new IncomingMessage(socket);
    Object.assign(req, { method, url, body, session: actor ? { userId: actor } : {} });
    const res = new ServerResponse(req);
    const timer = setTimeout(() => reject(Error("Isolated middleware dispatch timeout")), 10000);
    res.end = ((chunk: any) => {
      clearTimeout(timer);
      try { resolve({ status: res.statusCode, body: JSON.parse(String(chunk)) }); }
      catch (e) { reject(e); }
      socket.destroy();
      return res;
    }) as any;
    app(req, res);
  });
}

test("Express chain: real session guard, real user loader, routes and SQL reject revoked/forged access", async () => {
  const app = express();
  registerMaterialRequestCommands(app, pool, isSessionAuthenticated,
    loadRequestUser(async id => (await pool.query("SELECT * FROM users WHERE id=$1", [id])).rows[0]));
  assert.equal((await dispatch(app, "POST", "/api/field/requests")).status, 401);
  const operationId = randomUUID();
  const body = { operationId, payload: data("via real chain") };
  const saved = await dispatch(app, "POST", "/api/field/requests", "owner", body);
  assert.equal(saved.status, 200);
  assert.equal((await dispatch(app, "GET", `/api/field/request-operations/${operationId}`, "owner")).body.state, "committed");
  assert.equal((await dispatch(app, "POST", "/api/field/requests", "admin", body)).body.code, "OPERATION_REUSED");
  await pool.query("UPDATE material_requests SET submitted_by='other',revision=revision+1 WHERE id=$1", [saved.body.request.id]);
  for (const response of [
    await dispatch(app, "GET", `/api/field/request-operations/${operationId}`, "owner"),
    await dispatch(app, "POST", "/api/field/requests", "owner", body),
  ]) {
    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { code: "FORBIDDEN" });
  }
  try {
    await pool.query("UPDATE users SET status='inactive' WHERE id='owner'");
    assert.equal((await dispatch(app, "POST", "/api/field/requests", "owner", body)).status, 401);
  } finally { await pool.query("UPDATE users SET status='active' WHERE id='owner'"); }
});
