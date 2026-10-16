import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import { TRANSLATIONS } from "../client/src/lib/i18n";
import { buildIsolatedFieldFlow } from "./helpers/fieldDraftFlowHarness";

let browser: Browser;
let script: string;
before(async () => {
  script = await buildIsolatedFieldFlow();
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); });

async function fixture(width = 1280, lang: "en" | "ko" | "es" = "ko", theme = "dark") {
  const context = await browser.newContext({
    viewport: { width, height: 900 }, serviceWorkers: "block",
  });
  const network: string[] = [];
  const errors: string[] = [];
  await context.route("**/*", route => route.abort());
  const page = await context.newPage();
  page.on("request", req => network.push(req.resourceType()));
  page.on("pageerror", error => errors.push(error.message));
  await page.setContent(`<html><head><style>
    *{box-sizing:border-box}body{margin:0}p{margin:0}
    [data-toast-viewport]{position:fixed;left:0;top:0;z-index:9999;max-width:240px;padding:4px}
    [data-toast-viewport] li{background:white;color:black}
  </style></head><body><div id="root"></div></body></html>`);
  await page.evaluate(config => { (window as any).__config = config; }, { lang, theme });
  await page.evaluate(`(() => {
    const blocked = () => { throw Error("Network forbidden in isolated field test"); };
    window.fetch = blocked;
    window.XMLHttpRequest = blocked;
    window.WebSocket = blocked;
    navigator.sendBeacon = blocked;
  })()`);
  await page.addScriptTag({ content: script });
  await page.getByTestId("fixture-open-inventory").waitFor();
  return {
    page,
    async finish() {
      assert.deepEqual(network, [], "No browser requests may reach any service");
      assert.deepEqual(errors, [], "No browser runtime errors");
      await context.close();
    },
  };
}

const draft = (page: Page) => page.evaluate(() => (window as any).__readDraft());
const calls = (page: Page) => page.evaluate(() => (window as any).__calls);
const toasts = (page: Page) => page.evaluate(() => (window as any).__readToasts());
async function confirmClick(page: Page, id: string, accept: boolean) {
  let seen = false;
  page.once("dialog", async dialog => {
    seen = true;
    if (accept) await dialog.accept(); else await dialog.dismiss();
  });
  await page.getByTestId(id).click();
  assert.equal(seen, true, `Expected confirmation for ${id}`);
}
async function openInventory(page: Page) {
  await page.getByTestId("fixture-open-inventory").click();
  await page.getByTestId("cart-panel").waitFor();
}
async function addItem(page: Page, which: "a" | "b") {
  // Only fixture inventory selection is synthetic; all draft/form actions below
  // use the real app controls.
  await page.getByTestId("btn-close-cart-panel").click();
  await page.getByTestId(`fixture-add-${which}`).click();
  await openInventory(page);
}
async function fillMeta(page: Page, notes: string, project = "902") {
  await page.getByTestId("select-project").selectOption(project);
  await page.getByTestId("input-requester").click();
  await page.getByTestId("input-requester-option-905").click();
  await page.getByTestId("cart-notes-input").fill(notes);
  await page.getByTestId("btn-reqtype-transfer").click();
}
async function openRequestEdit(page: Page) {
  await page.getByTestId("fixture-open-requests").click();
  await page.getByTestId("btn-request-expand-501").click();
  await page.getByTestId("btn-req-edit-501").click();
  await page.getByTestId("btn-edit-continue-inventory").waitFor();
}
async function startExistingEdit(page: Page) {
  await openRequestEdit(page);
  await page.getByTestId("btn-edit-continue-inventory").click();
  await page.getByTestId("edit-mode-banner").waitFor();
}
async function beginPending(page: Page) {
  await page.evaluate(() => { (window as any).__defer = true; });
  await page.getByTestId("btn-submit-request").click();
  await page.waitForFunction(() => (window as any).__pending.length === 1);
}
async function resolvePending(page: Page, success: boolean) {
  await page.evaluate(success => {
    const pending = (window as any).__pending.shift();
    (window as any).__defer = false;
    if (success) pending.resolve(); else pending.reject(Error("Mock server failure"));
  }, success);
}
async function createNewBAfterClosingA(page: Page) {
  await page.getByTestId("btn-close-cart-panel").click();
  await openInventory(page);
  if ((await draft(page)).editingRequestId !== null) {
    await confirmClick(page, "btn-end-request-edit", true);
  } else {
    await page.getByTestId("btn-cart-remove-901").click();
    await page.getByTestId("cart-notes-input").fill("");
  }
  await addItem(page, "b");
  await fillMeta(page, "B latest draft");
  const b = await draft(page);
  assert.equal(b.editingRequestId, null);
  assert.equal(b.items[0].itemId, 903);
  return b;
}

test("A pending save success/failure cannot clear a newly created B draft through real panel controls", async () => {
  for (const width of [390, 1280]) {
    for (const success of [true, false]) {
      for (const editing of [false, true]) {
      const f = await fixture(width);
      try {
        if (editing) await startExistingEdit(f.page);
        else { await openInventory(f.page); await addItem(f.page, "a"); }
        await f.page.getByTestId("cart-notes-input").fill("A submitted");
        await beginPending(f.page);
        const b = await createNewBAfterClosingA(f.page);
        await resolvePending(f.page, success);
        await f.page.waitForFunction(() => (window as any).__readToasts().some((t: any) => t.open));
        assert.deepEqual(await draft(f.page), b);
        const sent = await calls(f.page);
        assert.equal(sent.length, 1);
        assert.equal(sent[0].method, editing ? "PATCH" : "POST");
        assert.equal(sent[0].body.notes, "A submitted");
        assert.equal((await toasts(f.page))[0].title,
          success
            ? (editing ? TRANSLATIONS.ko.requestUpdated : TRANSLATIONS.ko.requestSubmitted)
            : TRANSLATIONS.ko.errorTitle);
      } finally { await f.finish(); }
      }
    }
  }
});

test("normal successful new and existing saves clear only the submitted local draft", async () => {
  for (const editing of [false, true]) {
    const f = await fixture();
    try {
      if (editing) await startExistingEdit(f.page);
      else { await openInventory(f.page); await addItem(f.page, "a"); }
      await fillMeta(f.page, "A normal save");
      await f.page.getByTestId("btn-submit-request").click();
      await f.page.getByTestId("new-request-banner").waitFor();
      const current = await draft(f.page);
      assert.equal(current.items.length, 0);
      assert.equal(current.editingRequestId, null);
      assert.deepEqual(current.meta, {
        requestType: "issue", projectId: null, notes: "", requesterName: "", requesterRole: "",
      });
      const sent = await calls(f.page);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].method, editing ? "PATCH" : "POST");
    } finally { await f.finish(); }
  }
});

test("clicking the real older Undo toast and rejecting B replacement sends no Undo API request", async () => {
  for (const editing of [false, true]) {
    const f = await fixture();
    try {
      if (editing) await startExistingEdit(f.page);
      else { await openInventory(f.page); await addItem(f.page, "a"); }
      await f.page.getByTestId("btn-submit-request").click();
      await f.page.getByTestId("toast-undo-request").waitFor();
      await addItem(f.page, "b");
      await fillMeta(f.page, "B keep after old Undo");
      const b = await draft(f.page);
      const before = await calls(f.page);
      await confirmClick(f.page, "toast-undo-request", false);
      assert.deepEqual(await draft(f.page), b);
      assert.deepEqual(await calls(f.page), before);
      await f.page.getByTestId("toast-undo-request").waitFor();
    } finally { await f.finish(); }
  }
});

test("Undo completion rechecks a changed draft and distinguishes server success from declined local restoration", async () => {
  for (const lang of ["en", "ko", "es"] as const) {
    for (const editing of [false, true]) {
    const f = await fixture(1280, lang);
    try {
      if (editing) await startExistingEdit(f.page);
      else { await openInventory(f.page); await addItem(f.page, "a"); }
      await f.page.getByTestId("btn-submit-request").click();
      await f.page.getByTestId("toast-undo-request").waitFor();
      await addItem(f.page, "b");
      await fillMeta(f.page, "B before Undo");
      await f.page.evaluate(() => { (window as any).__defer = true; });
      await confirmClick(f.page, "toast-undo-request", true);
      await f.page.waitForFunction(() => (window as any).__pending.length === 1);
      await f.page.getByTestId("cart-notes-input").fill("B changed during Undo");
      const b = await draft(f.page);
      let rechecked = false;
      f.page.once("dialog", async dialog => { rechecked = true; await dialog.dismiss(); });
      await resolvePending(f.page, true);
      await f.page.getByText(TRANSLATIONS[lang].cartUndoServerDoneDraftKept, { exact: true }).waitFor();
      assert.equal(rechecked, true);
      assert.deepEqual(await draft(f.page), b);
      const sent = await calls(f.page);
      assert.equal(sent.length, 2);
      assert.equal(sent[1].method, "PATCH");
      assert.equal(sent[1].url, editing ? "/api/field/requests/501" : "/api/field/requests/501/status");
      const result = (await toasts(f.page))[0];
      assert.equal(result.description, TRANSLATIONS[lang].cartUndoDraftKeptHint);
      assert.notEqual(result.title, TRANSLATIONS[lang].undoDone);
    } finally { await f.finish(); }
    }
  }
});

test("real request-list Continue protects another draft, permits confirmed replacement and skips identical continuation", async () => {
  const f = await fixture();
  try {
    await openInventory(f.page);
    await addItem(f.page, "b");
    await fillMeta(f.page, "B keep unless confirmed");
    const b = await draft(f.page);
    await f.page.getByTestId("btn-close-cart-panel").click();
    await openRequestEdit(f.page);
    await confirmClick(f.page, "btn-edit-continue-inventory", false);
    assert.deepEqual(await draft(f.page), b);
    await f.page.getByTestId("btn-edit-continue-inventory").waitFor();
    await confirmClick(f.page, "btn-edit-continue-inventory", true);
    await f.page.getByTestId("edit-mode-banner").waitFor();
    const a = await draft(f.page);
    assert.equal(a.editingRequestId, 501);
    assert.equal(a.items[0].itemId, 901);
    await f.page.getByTestId("btn-close-cart-panel").click();
    await openRequestEdit(f.page);
    let unexpectedPrompt = false;
    f.page.once("dialog", async d => { unexpectedPrompt = true; await d.dismiss(); });
    await f.page.getByTestId("btn-edit-continue-inventory").click();
    await f.page.getByTestId("edit-mode-banner").waitFor();
    assert.equal(unexpectedPrompt, false);
    f.page.removeAllListeners("dialog");
    assert.deepEqual(await draft(f.page), a);
    assert.equal((await calls(f.page)).length, 0);

    // Same request ID but only notes changed must still be protected.
    await f.page.getByTestId("cart-notes-input").fill("A unsaved local notes");
    const changedA = await draft(f.page);
    await f.page.getByTestId("btn-close-cart-panel").click();
    await openRequestEdit(f.page);
    await confirmClick(f.page, "btn-edit-continue-inventory", false);
    assert.deepEqual(await draft(f.page), changedA);
  } finally { await f.finish(); }
});

test("real request-list replacement also protects zero-item notes/project drafts", async () => {
  const f = await fixture();
  try {
    await openInventory(f.page);
    await f.page.getByTestId("cart-notes-input").fill("No items but important notes");
    await f.page.getByTestId("select-project").selectOption("904");
    const before = await draft(f.page);
    assert.equal(before.items.length, 0);
    await f.page.getByTestId("btn-close-cart-panel").click();
    await openRequestEdit(f.page);
    await confirmClick(f.page, "btn-edit-continue-inventory", false);
    assert.deepEqual(await draft(f.page), before);
    assert.equal((await calls(f.page)).length, 0);
  } finally { await f.finish(); }
});

test("actual X, backdrop and lower Close preserve latest metadata; empty edit ends locally in all languages/themes/viewports", async () => {
  for (const lang of ["en", "ko", "es"] as const) {
    for (const theme of ["dark", "light"]) {
      for (const width of [390, 1280]) {
        const f = await fixture(width, lang, theme);
        try {
          await startExistingEdit(f.page);
          for (const close of ["btn-close-cart-panel", "cart-panel-backdrop", "btn-cart-cancel"]) {
            await fillMeta(f.page, "Latest " + close);
            const before = await draft(f.page);
            if (close === "cart-panel-backdrop") {
              await f.page.getByTestId(close).click({ position: { x: 2, y: 2 } });
            } else await f.page.getByTestId(close).click();
            await f.page.getByTestId("cart-panel").waitFor({ state: "detached" });
            await openInventory(f.page);
            assert.deepEqual(await draft(f.page), before);
            assert.equal(await f.page.getByTestId("cart-notes-input").inputValue(), before.meta.notes);
            assert.equal(await f.page.getByTestId("select-project").inputValue(), "902");
            assert.match(await f.page.getByTestId("input-requester").innerText(), /Mock requester/);
          }
          await f.page.getByTestId("btn-cart-remove-901").click();
          assert.match(await f.page.getByTestId("edit-mode-banner").innerText(), /REQ-MOCK-A/);
          assert.equal(await f.page.getByTestId("btn-submit-request").isDisabled(), true);
          const empty = await draft(f.page);
          await confirmClick(f.page, "btn-end-request-edit", false);
          assert.deepEqual(await draft(f.page), empty);
          await confirmClick(f.page, "btn-end-request-edit", true);
          await f.page.getByTestId("new-request-banner").waitFor();
          assert.equal((await draft(f.page)).editingRequestId, null);
          assert.equal((await draft(f.page)).meta.requesterName, "");
          assert.equal((await calls(f.page)).length, 0);
        } finally { await f.finish(); }
      }
    }
  }
});
