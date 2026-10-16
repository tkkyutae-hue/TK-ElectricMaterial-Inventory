/** In-memory draft state only. No storage, network, or application imports. */
export interface CartItem {
  itemId: number;
  itemName: string;
  sizeLabel: string | null;
  sku: string;
  requestedQty: number;
  unit: string;
  locationName: string | null;
  imageUrl?: string | null;
}

export interface EditingRequestMeta {
  requestType: "issue" | "transfer";
  projectId: number | null;
  notes: string;
  requesterName: string;
  requesterRole: string;
}

export interface FieldCartDraft {
  items: CartItem[];
  meta: EditingRequestMeta;
  editingRequestId: number | null;
  editingRequestNumber: string | null;
}

export function emptyFieldDraft(): FieldCartDraft {
  return {
    items: [],
    meta: { requestType: "issue", projectId: null, notes: "", requesterName: "", requesterRole: "" },
    editingRequestId: null,
    editingRequestNumber: null,
  };
}

export function hasFieldDraft(draft: FieldCartDraft): boolean {
  const { meta } = draft;
  return draft.editingRequestId !== null || draft.items.length > 0 ||
    meta.projectId !== null || meta.requestType !== "issue" ||
    meta.notes !== "" || meta.requesterName !== "" || meta.requesterRole !== "";
}

export function sameFieldDraft(a: FieldCartDraft, b: FieldCartDraft): boolean {
  return a.editingRequestId === b.editingRequestId &&
    a.editingRequestNumber === b.editingRequestNumber &&
    (Object.keys(a.meta) as (keyof EditingRequestMeta)[]).every(key => a.meta[key] === b.meta[key]) &&
    a.items.length === b.items.length &&
    a.items.every((item, index) => {
      const other = b.items[index];
      return item.itemId === other.itemId && item.requestedQty === other.requestedQty &&
        item.itemName === other.itemName && item.sizeLabel === other.sizeLabel &&
        item.sku === other.sku && item.unit === other.unit &&
        item.locationName === other.locationName && item.imageUrl === other.imageUrl;
    });
}

export function needsDraftReplacementConfirmation(current: FieldCartDraft, next: FieldCartDraft): boolean {
  return hasFieldDraft(current) && !sameFieldDraft(current, next);
}

/** The provider owns one store; unmounting the review panel cannot lose its form. */
export function createFieldDraftStore() {
  let draft = emptyFieldDraft();
  const listeners = new Set<() => void>();
  function publish(next: FieldCartDraft) {
    draft = next;
    listeners.forEach(listener => listener());
  }
  return {
    getSnapshot: () => draft,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    updateItems(update: (items: CartItem[]) => CartItem[]) {
      publish({ ...draft, items: update(draft.items) });
    },
    patchMeta(patch: Partial<EditingRequestMeta>) {
      publish({ ...draft, meta: { ...draft.meta, ...patch } });
    },
    replace(next: FieldCartDraft, confirmDiscard: () => boolean): boolean {
      if (needsDraftReplacementConfirmation(draft, next) && !confirmDiscard()) return false;
      publish({ ...next, items: next.items.map(item => ({ ...item })), meta: { ...next.meta } });
      return true;
    },
    reset() {
      publish(emptyFieldDraft());
    },
    clearIfCurrent(submitted: FieldCartDraft) {
      // A request may finish after the panel closes and a newer draft is started.
      if (draft !== submitted) return false;
      publish(emptyFieldDraft());
      return true;
    },
  };
}
