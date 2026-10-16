import assert from "node:assert/strict";
import { test, before } from "node:test";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";

let storage: any;
let handlers: Record<string, Function>;
let queries: string[] = [];
const rows = [
  { id: 1, name: "EMT alpha", sku: "SKU-NEEDLE", description: "cobalt finish", sizeLabel: '1/2"', manufacturer: " A ", subType: "Coupling", quantityOnHand: 4, minimumStock: 5, reorderPoint: 1 },
  { id: 2, name: "EMT beta", sku: "SKU-B", description: "amber finish", sizeLabel: '3/4"', manufacturer: "B", subType: "Connector", quantityOnHand: 20, minimumStock: 5 },
  { id: 3, name: "EMT gamma", sku: "SKU-C", description: "cobalt finish", sizeLabel: '1"', manufacturer: "A", subType: "Coupling", quantityOnHand: 99, minimumStock: 5 },
  { id: 4, name: "EMT zero", sku: "SKU-D", description: "empty", sizeLabel: '2"', manufacturer: "A", subType: "Connector", quantityOnHand: 0, minimumStock: 5 },
  { id: 5, name: "EMT ordered", sku: "SKU-E", description: "ordered", sizeLabel: '3"', manufacturer: "A", subType: "Connector", quantityOnHand: 0, minimumStock: 5, statusOverride: "ORDERED" },
].map(row => ({ ...row, isActive: true, categoryId: 1, subcategory: "Conduit", detailType: "EMT", baseItemName: "EMT", sizeSortValue: 0, unitOfMeasure: "FT" }));

before(async () => {
  // Bundle the real storage module, replacing its DB import before evaluation.
  // Nothing from db.ts, pg, app bootstrap or an environment file is evaluated.
  const result = await build({
    entryPoints: ["server/storage.ts"], bundle: true, write: false, metafile: true,
    platform: "node", format: "cjs",
    plugins: [{ name: "forbid-real-db", setup(p) {
      p.onResolve({ filter: /^\.\/db$/ }, () => ({ path: "db", namespace: "fake-db" }));
      p.onLoad({ filter: /.*/, namespace: "fake-db" }, () => ({ contents: "export const db=globalThis.syntheticDB; export const pool={};" }));
    }}],
  });
  assert.ok(!Object.keys(result.metafile!.inputs).some(p => /server\/db\.ts|node_modules\/(?:pg|@neondatabase)|server\/index/.test(p)));
  const db = {
    select(selection: any) {
      let table: any;
      const chain: any = {
        from(t: any) { table = t; return chain; },
        leftJoin() { return chain; }, where() { return chain; }, orderBy() { return chain; }, groupBy() { return chain; },
        then(resolve: Function, reject: Function) {
          try {
            const name = table[Symbol.for("drizzle:Name")];
            queries.push(name);
            let output: any[];
            if (name === "items") {
              output = selection?.item ? rows.map(item => ({
                item, category: { id: 1, name: "Synthetic category" },
                location: null, supplier: { name: "Synthetic supplier" },
              })) : rows.map(item => Object.fromEntries(Object.entries(selection).map(([key, column]: any) => {
                const property = Object.entries(table).find(([, v]) => v === column)?.[0];
                return [key, (item as any)[property!]];
              })));
            } else if (name === "item_images") output = [];
            else if (name === "wire_reels") output = [{ itemId: 3, total: 2 }];
            else throw Error(`Unexpected read ${name}`);
            return Promise.resolve(output).then(resolve as any, reject as any);
          } catch (e) { return Promise.reject(e).then(resolve as any, reject as any); }
        },
      };
      return chain;
    },
  };
  const exports: any = {};
  const context: any = {
    exports, module: { exports }, syntheticDB: db, console,
    require(name: string) { throw Error(`Forbidden module ${name}`); },
  };
  runInNewContext(result.outputFiles[0].text, context);
  storage = context.module.exports.storage;
  // Execute the exact route registration statements, not a rewritten handler.
  // Auth/server/bootstrap imports are deliberately excluded.
  const text = readFileSync("server/routes.ts", "utf8");
  const source = ts.createSourceFile("routes.ts", text, ts.ScriptTarget.Latest, true);
  const registrations: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
      const call = node.expression;
      if (call.expression.getText(source) === "app.get" &&
          call.arguments[0] && ts.isStringLiteral(call.arguments[0]) &&
          ["/api/field/items", "/api/field/sizes", "/api/field/subcategories"].includes(call.arguments[0].text)) {
        registrations.push(node.getText(source));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(registrations.length, 3);
  handlers = {};
  const routeCode = ts.transpile(registrations.join("\n"), { target: ts.ScriptTarget.ES2022 });
  runInNewContext(routeCode, { storage, isAuthenticated: () => {}, app: {
    get(path: string, auth: Function, handler: Function) { assert.equal(typeof auth, "function"); handlers[path] = handler; },
  }});
});

const plain = (value: any) => JSON.parse(JSON.stringify(value));
test("real storage: brand-specific sizes and subcategories match item results", async () => {
  const result = await storage.getFieldItems({ categoryId: 1, brand: "B" });
  assert.deepEqual(plain(result.items.map((i: any) => i.id)), [2]);
  assert.deepEqual(plain(await storage.getFieldSizes({ categoryId: 1, brand: "B" })), ['3/4"']);
  assert.deepEqual(plain(await storage.getFieldSubcategories({ categoryId: 1, brand: "B" })), [{ name: "Connector", count: 1 }]);
});
for (const search of ["alpha", "SKU-NEEDLE", '1/2"', "cobalt", "cobalt EMT", "synthetic supplier"]) {
  test(`real storage: shared search matches size choices (${search})`, async () => {
    const result = await storage.getFieldItems({ search });
    const sizes = await storage.getFieldSizes({ search });
    assert.deepEqual(plain(sizes), plain([...new Set(result.items.map((i: any) => i.sizeLabel))]));
    assert.ok(result.total > 0);
  });
}
test("real storage: minimumStock and live reel quantity, not reorderPoint/stale on-hand", async () => {
  const result = await storage.getFieldItems({ status: "low_stock" });
  assert.deepEqual(plain(result.items.map((i: any) => i.id)), [1, 3]);
  assert.deepEqual(plain(await storage.getFieldSizes({ status: "low_stock" })), ['1/2"', '1"']);
});
test("real storage: ordered/out-of-stock stay distinct", async () => {
  assert.deepEqual(plain(await storage.getFieldSizes({ status: "ordered" })), ['3"']);
  assert.deepEqual(plain(await storage.getFieldSizes({ status: "out_of_stock" })), ['2"']);
});
test("real storage: pagination does not truncate size choices; no DB writes possible", async () => {
  assert.equal((await storage.getFieldItems({ perPage: 1 })).items.length, 1);
  assert.equal((await storage.getFieldSizes({ perPage: 1, size: '1/2"' })).length, 5);
  assert.ok(queries.every(q => ["items", "item_images", "wire_reels"].includes(q)));
});
test("exact route handlers forward brand/search/status and return matching synthetic results", async () => {
  const query = { category: "1", brand: "A", q: "cobalt", status: "low_stock" };
  let body: any;
  await handlers["/api/field/items"]({ query }, { json(v: any) { body = v; } });
  const ids = plain(body.items.map((i: any) => i.id));
  assert.deepEqual(ids, [1, 3]);
  await handlers["/api/field/sizes"]({ query }, { json(v: any) { body = v; } });
  assert.deepEqual(plain(body), ['1/2"', '1"']);
  await handlers["/api/field/subcategories"]({ query: { category: "1", brand: "B" } }, { json(v: any) { body = v; } });
  assert.deepEqual(plain(body), [{ name: "Connector", count: 1 }]);
});
