/**
 * No app bootstrap, Vite server, DB, ports or external services.
 * Check actual setup wiring plus the installed Vite logger's error behavior.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@babel/parser";
import { createLogger } from "vite";

test("development Vite wiring uses its normal logger, without fatal transform-error hooks", () => {
  const source = readFileSync("server/vite.ts", "utf8");
  const ast = parse(source, { sourceType: "module", plugins: ["typescript"] });
  const configs: any[] = [];
  function visit(value: any) {
    if (!value || typeof value !== "object") return;
    if (value.type === "ObjectProperty" && value.key?.name === "customLogger") configs.push(value.value);
    for (const item of Object.values(value)) {
      if (Array.isArray(item)) item.forEach(visit);
      else if (item && typeof item === "object") visit(item);
    }
  }
  visit(ast);
  assert.equal(configs.length, 1);
  assert.equal(configs[0].type, "Identifier");
  assert.equal(configs[0].name, "viteLogger");
  assert.equal(source.includes("process.exit"), false);
});

test("installed Vite logger reports an error and remains usable for the next message", () => {
  const messages: string[] = [];
  const capture = (...args: any[]) => { messages.push(args.join(" ")); };
  const logger = createLogger("error", {
    allowClearScreen: false,
    customLogger: { ...console, log: capture, error: capture },
  });
  logger.error("Synthetic recoverable JSX transform failure");
  logger.error("Synthetic subsequent transform failure");
  assert.equal(messages.length, 2);
  assert.match(messages[0], /recoverable JSX/);
  assert.match(messages[1], /subsequent transform/);
});
