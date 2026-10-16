import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { chromium, type Browser } from "playwright";
import { buildFieldFilters, mountFieldFilters } from "./helpers/fieldFiltersHarness";
let browser: Browser, bundle: string;
before(async () => { bundle = await buildFieldFilters(); browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
const poll = async (page: any, expression: string) => page.waitForFunction(expression);

test("real page: category selection and explicit clear remove old brand from all requests", async () => {
  const f = await mountFieldFilters(browser, bundle);
  try {
    await f.page.getByTestId("field-inv-row-101").waitFor();
    await f.page.getByTestId("card-category-2").click();
    await poll(f.page, `window.calls.some(c=>c.path==="/api/field/items"&&c.query.includes("category=2")&&!c.query.includes("brand="))`);
    await f.page.getByTestId("btn-clear-category").click();
    await poll(f.page, `window.lastNavigation==="/field/inventory"`);
  } finally { await f.close(); }
});

test("real page: brand reaches size/subcategory query and brand changes create distinct cache keys", async () => {
  const f = await mountFieldFilters(browser, bundle);
  try {
    await poll(f.page, `["/api/field/sizes","/api/field/subcategories"].every(p=>window.calls.some(c=>c.path===p&&c.query.includes("brand=A")))`);
    await f.page.getByTestId("chip-brand-B").click();
    await poll(f.page, `window.calls.some(c=>c.path==="/api/field/sizes"&&c.query.includes("brand=B"))`);
    await f.page.getByTestId("chip-type-Steel").click();
    await poll(f.page, `window.calls.some(c=>c.path==="/api/field/subcategories"&&c.query.includes("brand=B"))`);
  } finally { await f.close(); }
});

for (const lang of ["ko", "en", "es"]) for (const theme of ["light", "dark"]) {
  test(`real page: failure/retry preserves selected filters (${lang}/${theme})`, async () => {
    const f = await mountFieldFilters(browser, bundle, { lang, theme, width: theme === "dark" ? 390 : 1280, failures: ["/api/field/sizes"] });
    try {
      const retry = lang === "ko" ? "다시 시도" : lang === "es" ? "Reintentar" : "Try again";
      await f.page.getByRole("button", { name: retry, exact: true }).waitFor();
      assert.equal(await f.page.getByTestId("field-inv-row-101").count(), 0);
      assert.ok((await f.page.evaluate(() => (window as any).lastNavigation)).includes("size=1%2F2"));
      await f.page.evaluate(() => { (window as any).failures = []; });
      await f.page.getByRole("button", { name: retry, exact: true }).click();
      await f.page.getByTestId("field-inv-row-101").waitFor();
      const url = await f.page.evaluate(() => (window as any).lastNavigation);
      for (const condition of ["brand=A", "size=1%2F2", "category=1"]) assert.ok(url.includes(condition));
    } finally { await f.close(); }
  });
}

test("real page/query library: late older item/size responses cannot overwrite newer search or selection", async () => {
  const f = await mountFieldFilters(browser, bundle);
  try {
    await f.page.getByTestId("field-inv-row-101").waitFor();
    await f.page.evaluate(() => { (window as any).slow = true; });
    await f.page.getByTestId("field-inv-search").fill("older");
    await poll(f.page, `window.calls.some(c=>c.path==="/api/field/items"&&c.query.includes("q=older"))`);
    await f.page.getByTestId("field-inv-search").fill("newer");
    await f.page.getByTestId("field-inv-row-902").waitFor();
    await f.page.waitForTimeout(800);
    assert.equal(await f.page.getByTestId("field-inv-row-901").count(), 0);
    await f.page.getByTestId("field-inv-row-902").waitFor();
    assert.ok((await f.page.evaluate(() => (window as any).lastNavigation)).includes("size=1%2F2"));
    const sizeData = await f.page.evaluate(() => (window as any).testClient.getQueryCache().getAll()
      .filter((q: any) => q.queryKey[0] === "/api/field/sizes" && q.queryKey.includes("newer"))[0].state.data);
    assert.deepEqual(sizeData, ["NEW"]);
  } finally { await f.close(); }
});

for (const path of ["/api/inventory/categories/summary", "/api/field/families",
  "/api/field/brands", "/api/field/types", "/api/field/subcategories", "/api/field/items"]) {
  test(`real page: ${path} failure is not empty success; retry retains draft filters`, async () => {
    const f = await mountFieldFilters(browser, bundle, { failures: [path] });
    try {
      await f.page.getByRole("button", { name: "Try again", exact: true }).waitFor();
      assert.equal(await f.page.getByTestId("field-inv-row-101").count(), 0);
      const previousURL = await f.page.evaluate(() => (window as any).lastNavigation);
      await f.page.evaluate(() => { (window as any).failures = []; });
      await f.page.getByRole("button", { name: "Try again", exact: true }).click();
      await f.page.getByTestId("field-inv-row-101").waitFor();
      assert.equal(await f.page.evaluate(() => (window as any).lastNavigation), previousURL);
    } finally { await f.close(); }
  });
}

test("real request function: malformed response and rejected transport surface retry without clearing filters", async () => {
  const f = await mountFieldFilters(browser, bundle);
  try {
    await f.page.getByTestId("field-inv-row-101").waitFor();
    await f.page.evaluate(`window.originalFetch=window.fetch;
      window.fetch=async(url,options)=>String(url).startsWith("/api/field/items")
        ?new Response(JSON.stringify({error:"malformed success"}),{status:200})
        :window.originalFetch(url,options);
      window.testClient.invalidateQueries({queryKey:["/api/field/items"]});`);
    await f.page.getByRole("button", { name: "Try again", exact: true }).waitFor();
    assert.equal(await f.page.getByTestId("field-inv-row-101").count(), 0, "Do not show cached rows as successful fresh results");
    await f.page.evaluate(`window.fetch=async(url,options)=>String(url).startsWith("/api/field/items")
        ?Promise.reject(new Error("Synthetic disconnected transport")):window.originalFetch(url,options);`);
    await f.page.getByRole("button", { name: "Try again", exact: true }).click();
    await poll(f.page, `window.testClient.getQueryCache().getAll().some(q=>q.queryKey[0]==="/api/field/items"&&q.state.error?.message==="Synthetic disconnected transport")`);
    await f.page.evaluate("window.fetch=window.originalFetch");
    await f.page.getByRole("button", { name: "Try again", exact: true }).click();
    await f.page.getByTestId("field-inv-row-101").waitFor();
    assert.ok((await f.page.evaluate(() => (window as any).lastNavigation)).includes("brand=A"));
    // Offline capture only. Never contact the existing preview/app server.
    await f.page.screenshot({ path: "/tmp/field-filters-synthetic-check.jpg", type: "jpeg", quality: 65 });
  } finally { await f.close(); }
});
