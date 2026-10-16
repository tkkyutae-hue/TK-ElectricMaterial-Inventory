import assert from "node:assert/strict";
import test from "node:test";
import {
  createFieldDraftStore, emptyFieldDraft, hasFieldDraft,
  needsDraftReplacementConfirmation, sameFieldDraft,
  type FieldCartDraft,
} from "../client/src/lib/fieldCartDraft";

const item = {
  itemId: 901, itemName: "Mock material", sku: "MOCK", sizeLabel: null,
  requestedQty: 3, unit: "ea", locationName: null, imageUrl: null,
};
function editDraft(): FieldCartDraft {
  return {
    items: [{ ...item }],
    editingRequestId: 901, editingRequestNumber: "REQ-MOCK",
    meta: {
      requestType: "transfer", projectId: 902, requesterName: "Mock requester",
      requesterRole: "Mock role", notes: "Mock draft",
    },
  };
}

test("removing the last item and clearing all items preserve edit session and form", () => {
  for (const remove of [
    (items: typeof item[]) => items.filter(i => i.itemId !== item.itemId),
    () => [],
  ]) {
    const store = createFieldDraftStore();
    store.replace(editDraft(), () => { throw Error("empty draft needs no confirmation"); });
    store.updateItems(remove);
    assert.equal(store.getSnapshot().items.length, 0);
    assert.equal(store.getSnapshot().editingRequestNumber, "REQ-MOCK");
    assert.deepEqual(store.getSnapshot().meta, editDraft().meta);
    assert.equal(hasFieldDraft(store.getSnapshot()), true);
  }
});

test("new and editing form updates survive unsubscribe/re-subscribe (panel lifecycle)", () => {
  for (const editing of [false, true]) {
    const store = createFieldDraftStore();
    if (editing) store.replace(editDraft(), () => true);
    store.updateItems(() => [{ ...item, requestedQty: 7 }]);
    store.patchMeta(editDraft().meta);
    store.patchMeta({ notes: "Latest notes", requesterName: "Mock latest" });
    const before = store.getSnapshot();
    const unsubscribe = store.subscribe(() => {});
    unsubscribe();
    const unsubscribeAgain = store.subscribe(() => {});
    assert.equal(store.getSnapshot(), before);
    assert.equal(before.meta.notes, "Latest notes");
    assert.equal(before.meta.requesterName, "Mock latest");
    assert.equal(before.items[0].requestedQty, 7);
    unsubscribeAgain();
  }
});

test("form-only and empty edit drafts are protected; pristine new draft is not", () => {
  assert.equal(hasFieldDraft(emptyFieldDraft()), false);
  const patches = [
    { notes: " " }, { projectId: 1 }, { requesterName: "Mock" },
    { requesterRole: "Mock" }, { requestType: "transfer" as const },
  ];
  for (const patch of patches) {
    const current = emptyFieldDraft();
    Object.assign(current.meta, patch);
    assert.equal(needsDraftReplacementConfirmation(current, editDraft()), true);
  }
  const emptyEdit = { ...editDraft(), items: [] };
  assert.equal(needsDraftReplacementConfirmation(emptyEdit, emptyFieldDraft()), true);
});

test("cancel replacement changes nothing; confirmed replacement is atomic and copies input", () => {
  const store = createFieldDraftStore();
  store.patchMeta({ notes: "Keep me" });
  const before = store.getSnapshot();
  assert.equal(store.replace(editDraft(), () => false), false);
  assert.equal(store.getSnapshot(), before);
  let notifications = 0;
  store.subscribe(() => { notifications++; });
  const next = editDraft();
  assert.equal(store.replace(next, () => true), true);
  assert.equal(notifications, 1);
  next.items[0].requestedQty = 999;
  next.meta.notes = "Changed outside store";
  assert.equal(store.getSnapshot().items[0].requestedQty, 3);
  assert.equal(store.getSnapshot().meta.notes, "Mock draft");
});

test("same edit continues without confirmation but changed quantity/form requires it", () => {
  const store = createFieldDraftStore();
  store.replace(editDraft(), () => true);
  assert.equal(store.replace(editDraft(), () => { throw Error("redundant confirmation"); }), true);
  const changed = editDraft();
  changed.items[0].requestedQty++;
  assert.equal(sameFieldDraft(store.getSnapshot(), changed), false);
  assert.equal(store.replace(changed, () => false), false);
  changed.meta.notes = "Another draft";
  assert.equal(needsDraftReplacementConfirmation(store.getSnapshot(), changed), true);
});

test("explicit local reset ends editing and clears every field without external actions", () => {
  const store = createFieldDraftStore();
  store.replace(editDraft(), () => true);
  store.reset();
  assert.deepEqual(store.getSnapshot(), emptyFieldDraft());
});

test("submission success clears only the exact submitted draft, never newer work", () => {
  const store = createFieldDraftStore();
  store.replace(editDraft(), () => true);
  const submitted = store.getSnapshot();
  store.patchMeta({ notes: "Typed while submitting" });
  assert.equal(store.clearIfCurrent(submitted), false);
  assert.equal(store.getSnapshot().meta.notes, "Typed while submitting");
  assert.equal(store.clearIfCurrent(store.getSnapshot()), true);
  assert.deepEqual(store.getSnapshot(), emptyFieldDraft());
});

test("late draft restoration checks the current draft, not a captured empty cart", () => {
  const store = createFieldDraftStore();
  const approved = store.getSnapshot();
  store.patchMeta({ notes: "New work after async operation started" });
  let asked = 0;
  assert.equal(store.replace(editDraft(), () => {
    if (store.getSnapshot() === approved) return true;
    asked++;
    return false;
  }), false);
  assert.equal(asked, 1);
  assert.equal(store.getSnapshot().meta.notes, "New work after async operation started");
});

test("a new provider/store starts empty; no cross-refresh persistent draft storage", () => {
  const old = createFieldDraftStore();
  old.replace(editDraft(), () => true);
  assert.deepEqual(createFieldDraftStore().getSnapshot(), emptyFieldDraft());
});
