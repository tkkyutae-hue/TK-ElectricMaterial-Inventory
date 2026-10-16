// Isolated actual-storage harness. Never imports application DB/bootstrap.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../../shared/schema";
import { users } from "../../shared/models/auth";

export async function disposableMovementPg() {
  const root = await mkdtemp(join(tmpdir(), "movement-only-pg-"));
  const socket = join(root, "socket"), data = join(root, "data");
  await mkdir(socket, { mode: 0o700 });
  let started = false, pool: pg.Pool | undefined;
  function command(bin: string, args: string[]) {
    const r = spawnSync(bin, args, { env: {
      PATH: process.env.PATH!, HOME: root, LANG: "C", LC_ALL: "C",
    }, encoding: "utf8", timeout: 60000 });
    if (r.status !== 0) throw Error(`Private synthetic PostgreSQL ${bin} failed`);
  }
  async function close() {
    await pool?.end();
    if (started) command("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    assert.ok(root.startsWith(join(tmpdir(), "movement-only-pg-")));
    await rm(root, { recursive: true, force: true });
  }
  try {
    command("initdb", ["-D", data, "--no-locale", "-A", "trust"]);
    command("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o",
      `-c listen_addresses='' -c unix_socket_directories='${socket}' -c unix_socket_permissions=0700 -p 6543`,
      "-w", "start"]);
    started = true;
    pool = new pg.Pool({ host: socket, port: 6543, database: "postgres",
      user: userInfo().username, password: async () => "", ssl: false, max: 8,
      connectionTimeoutMillis: 5000, query_timeout: 15000,
      options: "-c statement_timeout=12000 -c lock_timeout=5000" });
    assert.equal((await pool.query("SHOW data_directory")).rows[0].data_directory, data);
    assert.equal((await pool.query("SHOW listen_addresses")).rows[0].listen_addresses, "");
    assert.equal((await pool.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n, 0);
    const dialect = new PgDialect();
    const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
    for (const table of [users, schema.categories, schema.locations, schema.suppliers,
      schema.projects, schema.items, schema.inventoryMovements, schema.inventoryLocationBalances,
      schema.projectMaterialTransactions, schema.movementDrafts, schema.wireReels,
      schema.wireReelMovementLines, schema.materialRequests, schema.materialRequestOperations]) {
      const cfg = getTableConfig(table);
      const columns = cfg.columns.map(c => {
        const v = c.default;
        const def = v === undefined ? "" : typeof v === "string" ? "'" + v.replaceAll("'", "''") + "'"
          : typeof v === "number" || typeof v === "boolean" ? String(v) : dialect.sqlToQuery(v as any).sql;
        return `${quote(c.name)} ${c.getSQLType()}${c.primary ? " PRIMARY KEY" : ""}${c.notNull ? " NOT NULL" : ""}${c.isUnique && !c.primary ? " UNIQUE" : ""}${def ? " DEFAULT " + def : ""}`;
      });
      await pool.query(`CREATE TABLE ${quote(cfg.name)} (${columns.join(",")})`);
    }
    // Relevant actual FK constraints; unrelated application tables are omitted.
    await pool.query(`
      ALTER TABLE inventory_movements ADD FOREIGN KEY(item_id) REFERENCES items(id);
      ALTER TABLE inventory_movements ADD FOREIGN KEY(supplier_id) REFERENCES suppliers(id);
      ALTER TABLE project_material_transactions ADD FOREIGN KEY(movement_id) REFERENCES inventory_movements(id);
    `);
    const output = await build({ entryPoints: ["server/storage.ts"], bundle: true, write: false,
      metafile: true, platform: "node", format: "cjs",
      plugins: [{ name: "private-db-only", setup(p) {
        p.onResolve({ filter: /^\.\/db$/ }, () => ({ path: "private-db", namespace: "private-db" }));
        p.onLoad({ filter: /.*/, namespace: "private-db" }, () => ({
          contents: "export const db=globalThis.privateDB; export const pool=globalThis.privatePool;",
        }));
      }}] });
    assert.ok(!Object.keys(output.metafile!.inputs).some(p => /server\/(?:db|index)\.ts|node_modules\/(?:pg|@neondatabase)/.test(p)));
    const exports = {};
    const context: any = { module: { exports }, exports, privateDB: drizzle(pool), privatePool: pool,
      console, require(name: string) { throw Error(`Unexpected dependency ${name}`); } };
    runInNewContext(output.outputFiles[0].text, context);
    return { pool, storage: context.module.exports.storage, close };
  } catch (e) { await close(); throw e; }
}
