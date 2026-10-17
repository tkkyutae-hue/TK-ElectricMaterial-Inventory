/**
 * No app/bootstrap/DB imports, no listening sockets. Run actual route
 * registration expressions/handlers from routes.ts in an isolated VM, with the
 * production authorization factory and Express Router, and a synthetic store.
 * Cookie authentication and SQL transaction behavior are NOT tested here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import express from "express";
import { createRoleAuthorization } from "../server/services/roleAuthorization";
import { isSessionAuthenticated } from "../server/services/requestIdentity";
import { validateNewMovement, validateDraftForConfirmation } from "../server/services/inventory/movement-validation";
import { canDoMovements, canRequestMaterials, canAccessDailyReport } from "../client/src/lib/role-access";

const text = readFileSync("server/routes.ts", "utf8");
const source = ts.createSourceFile("routes.ts", text, ts.ScriptTarget.Latest, true);
const registrations: ts.CallExpression[] = [];
const declarations = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(source) === "app") registrations.push(node);
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    if (["requireRole", "requireManager", "requireAdmin", "requireStaff", "requireStaffRead", "requireManagerRead"].includes(node.name.text)) {
      declarations.set(node.name.text, `const ${node.getText(source)};`);
    }
  }
  if (ts.isFunctionDeclaration(node) && node.name &&
      ["parseIntParam", "getUserId", "getUserDisplayName", "canAccessAllDrafts"].includes(node.name.text)) {
    declarations.set(node.name.text, node.getText(source));
  }
  ts.forEachChild(node, visit);
}
visit(source);
const compile = (code: string) => ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const prefix = compile([...declarations.values()].join("\n"));
function registration(method: string, path: string) {
  const result = registrations.find(node => {
    const prop = node.expression as ts.PropertyAccessExpression;
    const first = node.arguments[0];
    return prop.name.text === method && (ts.isStringLiteral(first) ? first.text : first.getText(source)) === path;
  });
  assert.ok(result, `${method} ${path} is a real registered route`);
  return result;
}
const typed = "`/api/movements/${type}`";
const core: [string, string, string?][] = [
  ["post", "/api/movements"], ["post", "/api/items/movements"],
  ...["receive", "issue", "return", "adjust", "transfer"].map(type => ["post", typed, type] as [string,string,string]),
  ["post", "/api/drafts/:id/confirm"],
];
const protectedRoutes: [string,string,string?][] = [...core,
  ["post", "/api/items"], ["put", "/api/items/:id"], ["delete", "/api/items/:id"], ["post", "/api/items/restore-batch"],
  ["put", "/api/movements/:id"], ["post", "/api/movements/:id/undo"], ["delete", "/api/movements/:id"],
  ["post", "/api/movements/bulk-delete"], ["post", "/api/movements/bulk-restore"],
  ["post", "/api/wire-reels/bulk"], ["post", "/api/wire-reels"], ["patch", "/api/wire-reels/:id"],
  ["post", "/api/wire-reels/:id/restore"], ["delete", "/api/wire-reels/:id"],
  ["post", "/api/items/:itemId/assets/generate-from-quantity"], ["post", "/api/items/:itemId/assets"],
  ["patch", "/api/tool-assets/:assetId"], ["delete", "/api/tool-assets/:assetId"],
];

function fixture(spec: [string,string,string?]) {
  const [method, path, type] = spec;
  const router = express.Router();
  const calls: string[] = [];
  const account = { id: "synthetic-actor", role: "manager", status: "active" };
  let lookupFailure = false;
  const storage = new Proxy({}, { get(_target, name: string) {
    return async (...args: any[]) => {
      calls.push(name);
      if (name === "getItem") return { id: 1, quantityOnHand: 100, unitOfMeasure: "EA" };
      if (name === "getDraft") return { id: 1, savedBy: account.id, movementType: "receive",
        itemsJson: JSON.stringify([{ itemId: 1, qty: 2 }]) };
      if (name === "confirmDraft") return [900];
      if (name === "createInventoryMovement") return { id: 900, ...args[0] };
      throw Error(`Unexpected synthetic storage method: ${name}`);
    };
  }});
  const context = vm.createContext({
    app: router, type, storage, createRoleAuthorization,
    authStorage: { getUser: async () => {
      if (lookupFailure) throw Error("Synthetic identity unavailable");
      return account;
    }},
    isAuthenticated: isSessionAuthenticated, validateNewMovement, validateDraftForConfirmation,
    console, Date,
  });
  vm.runInContext(prefix, context);
  vm.runInContext(compile(`${registration(method, path).getText(source)};`), context);
  const url = (type ? `/api/movements/${type}` : path)
    .replace(":itemId", "1").replace(":assetId", "1").replace(":id", "1");
  return {
    calls, account,
    failLookup: () => { lookupFailure = true; },
    invoke(body: any = { itemId: 1, quantity: 2, movementType: "receive", sourceLocationId: 1, destinationLocationId: 2 }, signedIn = true) {
      return new Promise<{status: number; body: any}>((resolve, reject) => {
        const timer = setTimeout(() => reject(Error("Synthetic route did not respond")), 3000);
        const finish = (status: number, body: any) => { clearTimeout(timer); resolve({ status, body }); };
        const req: any = { method: method.toUpperCase(), url, headers: {}, query: {}, body,
          session: signedIn ? { userId: account.id } : {},
          // Prove stale identity cannot grant access.
          currentUser: { id: "old-admin", role: "admin", status: "active" },
        };
        const res: any = {
          statusCode: 200,
          status(n: number) { this.statusCode = n; return this; },
          json(value: any) { finish(this.statusCode, value); return this; },
        };
        router.handle(req, res, (error?: any) => {
          clearTimeout(timer);
          reject(error ?? Error("Synthetic Express router did not match"));
        });
      });
    },
  };
}

for (const role of ["viewer", "manager_viewer", "staff", "unrecognized"]) {
  test(`${role}: all ${protectedRoutes.length} real stock-write routes reject before ANY storage call`, async () => {
    for (const spec of protectedRoutes) {
      const f = fixture(spec);
      f.account.role = role;
      const result = await f.invoke();
      assert.equal(result.status, 403, JSON.stringify(spec));
      assert.deepEqual(f.calls, [], "No draft, reel, movement or item reads/writes");
    }
  });
}
test("unauthenticated, inactive and identity failure deny every stock-write route", async () => {
  for (const spec of protectedRoutes) {
    for (const condition of ["anonymous", "inactive", "lookup-error"]) {
      const f = fixture(spec);
      if (condition === "inactive") f.account.status = "inactive";
      if (condition === "lookup-error") f.failLookup();
      const result = await f.invoke(undefined, condition !== "anonymous");
      assert.equal(result.status, condition === "lookup-error" ? 500 : 401);
      assert.deepEqual(f.calls, []);
    }
  }
});
for (const role of ["manager", "admin"]) {
  test(`${role}: generic, all typed, legacy and draft-confirm actual handlers retain normal saves`, async () => {
    for (const spec of core) {
      const f = fixture(spec);
      f.account.role = role;
      const response = await f.invoke();
      assert.equal(response.status, spec[1].includes("/drafts/") ? 200 : 201, JSON.stringify({spec,response}));
      assert.ok(f.calls.includes(spec[1].includes("/drafts/") ? "confirmDraft" : "createInventoryMovement"));
    }
  });
}
test("a retained session loses mutation access after role/status changes", async () => {
  const f = fixture(core[0]);
  assert.equal((await f.invoke()).status, 201);
  f.calls.length = 0;
  f.account.role = "staff";
  assert.equal((await f.invoke()).status, 403);
  f.account.role = "admin"; f.account.status = "inactive";
  assert.equal((await f.invoke()).status, 401);
  assert.deepEqual(f.calls, []);
});
test("all audited route registrations explicitly use manager gate (no alias bypass)", () => {
  for (const [method,path] of protectedRoutes) {
    const args = registration(method,path).arguments.map(a => a.getText(source));
    assert.ok(args.includes("requireManager"), `${method} ${path}`);
  }
});
test("request/report and non-stock draft permissions are not accidentally restricted", () => {
  for (const role of ["staff", "manager", "admin"]) {
    assert.equal(canRequestMaterials(role), true);
    assert.equal(canAccessDailyReport(role), true);
  }
  for (const role of ["staff", "viewer", "manager_viewer", "", "unknown"]) {
    assert.equal(canDoMovements(role), false);
  }
  for (const role of ["viewer", "manager_viewer", null, undefined]) assert.equal(canRequestMaterials(role), false);
  assert.equal(canDoMovements("manager"), true);
  assert.equal(canDoMovements("admin"), true);
  for (const [method,path] of [["post","/api/drafts"],["delete","/api/drafts/:id"]]) {
    assert.ok(registration(method,path).arguments.some(a => a.getText(source) === "requireStaff"));
  }
});
