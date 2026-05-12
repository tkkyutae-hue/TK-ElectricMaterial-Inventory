import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { generateReelId } from "@/lib/reel-utils";
import { shouldShowReelUI } from "@/lib/reelEligibility";
import { ChevronLeft, ChevronRight, ChevronDown, Trash2, Plus, X, Search } from "lucide-react";
import { SearchableItemSelect } from "./SearchableItemSelect";
import { useLanguage } from "@/hooks/use-language";
import { useFieldTheme } from "@/hooks/use-field-theme";
import type { ItemRow, NewReel } from "./types";

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  useEffect(() => {
    function onResize() { setNarrow(window.innerWidth < 640); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}

// ── Brand combobox ────────────────────────────────────────────────────────────
const KNOWN_BRANDS = [
  "Southwire", "Ideal", "Hubbell", "Leviton", "Siemens",
  "Square D", "Eaton", "Greenlee", "Milwaukee", "Klein",
  "Grainger", "3M", "Panduit", "Burndy", "ILSCO", "nVent",
  "Thomas & Betts", "ABB",
];

const LS_CUSTOM_BRANDS_KEY = "vstock_custom_brands";
function getStoredBrands(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_CUSTOM_BRANDS_KEY) || "[]"); } catch { return []; }
}
function saveCustomBrands(brands: string[]) {
  const existing = getStoredBrands();
  const merged = [...existing];
  for (const b of brands) {
    if (b && !merged.some(x => x.toLowerCase() === b.toLowerCase())) merged.push(b);
  }
  localStorage.setItem(LS_CUSTOM_BRANDS_KEY, JSON.stringify(merged));
}

function BrandCombobox({
  value, onChange, allBrands, idx,
}: {
  value: string;
  onChange: (v: string) => void;
  allBrands: string[];
  idx: number;
}) {
  const { t } = useLanguage();
  const { F } = useFieldTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allBrands;
    const q = query.toLowerCase();
    return allBrands.filter(b => b.toLowerCase().includes(q));
  }, [query, allBrands]);

  function select(brand: string) {
    setQuery(brand);
    onChange(brand);
    setOpen(false);
  }

  const INPUT_STYLE: React.CSSProperties = {
    height: 32, padding: "0 8px", fontSize: 13, background: F.surface,
    border: `1px solid ${F.borderStrong}`, borderRadius: 7, color: F.text,
    outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        placeholder={t.brandPlaceholderExample}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => { setOpen(false); if (query.trim()) onChange(query.trim()); }, 160)}
        style={INPUT_STYLE}
        data-testid={`bulk-reel-brand-${idx}`}
      />
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: F.bg, border: `1px solid ${F.borderStrong}`, borderRadius: 7, zIndex: 200, maxHeight: 150, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "7px 10px", fontSize: 11, color: F.textDim, fontStyle: "italic" }}>
              {t.movItemPressTabEnter.replace("{q}", query)}
            </div>
          ) : (
            filtered.map(brand => (
              <div
                key={brand}
                onMouseDown={() => select(brand)}
                style={{ padding: "6px 10px", fontSize: 13, color: brand.toLowerCase() === query.toLowerCase() ? F.accent : F.text, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", borderBottom: `1px solid ${F.border}` }}
              >
                {brand}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Reel Location Select ──────────────────────────────────────────────────────
function ReelLocationSelect({
  value, onChange, locations, idx,
}: {
  value: string;
  onChange: (v: string) => void;
  locations: any[];
  idx: number;
}) {
  const { t } = useLanguage();
  const { F } = useFieldTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = locations.find(l => String(l.id) === value);
  const filtered = search.trim()
    ? locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()))
    : locations;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const BTN: React.CSSProperties = {
    height: 32, width: "100%", display: "flex", alignItems: "center",
    justifyContent: "space-between", padding: "0 8px", fontSize: 13,
    background: F.surface, border: `1px solid ${open ? F.accent : F.borderStrong}`,
    borderRadius: open ? "7px 7px 0 0" : 7, color: selected ? F.text : F.textDim,
    cursor: "pointer", textAlign: "left", transition: "border-color 0.15s",
    boxSizing: "border-box",
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={BTN} data-testid={`bulk-reel-location-${idx}`}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.name : t.movItemDefault}
        </span>
        <ChevronDown style={{ width: 12, height: 12, color: F.textMuted, flexShrink: 0, marginLeft: 4 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: F.bg, border: `1px solid ${F.accent}`, borderTop: "none",
          borderRadius: "0 0 7px 7px", overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <div style={{ padding: "5px 7px", borderBottom: `1px solid ${F.border}`, display: "flex", alignItems: "center", gap: 5 }}>
            <Search style={{ width: 11, height: 11, color: F.textMuted, flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder={t.movItemFilter}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, fontSize: 12, outline: "none", background: "transparent", color: F.text, border: "none" }}
            />
          </div>
          <div style={{ maxHeight: 144, overflowY: "auto" }}>
            <button
              type="button"
              onMouseDown={() => { onChange(""); setOpen(false); setSearch(""); }}
              style={{ width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 13, color: !value ? F.accent : F.textMuted, background: "none", border: "none", borderBottom: `1px solid ${F.border}`, cursor: "pointer" }}
            >
              {t.movItemDefault}
            </button>
            {filtered.map(loc => (
              <button
                key={loc.id}
                type="button"
                onMouseDown={() => { onChange(String(loc.id)); setOpen(false); setSearch(""); }}
                style={{ width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 13, color: String(loc.id) === value ? F.accent : F.text, background: "none", border: "none", borderBottom: `1px solid ${F.border}`, cursor: "pointer" }}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bulk Reel Entry ───────────────────────────────────────────────────────────
interface BulkReelRow {
  tempId: string;
  lengthFt: number | "";
  brand: string;
  locationId: string;
  status: string;
  error: string | null;
}

function makeBulkRow(): BulkReelRow {
  return { tempId: crypto.randomUUID(), lengthFt: 500, brand: "", locationId: "", status: "new", error: null };
}

function BulkReelEntry({
  item, pendingCount, onAddAll, locations,
}: {
  item: any | null;
  pendingCount: number;
  onAddAll: (reels: NewReel[]) => void;
  locations: any[];
}) {
  const { t } = useLanguage();
  const { F } = useFieldTheme();
  const [rows, setRows] = useState<BulkReelRow[]>([makeBulkRow()]);
  const [nextSeq, setNextSeq] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);
  const prevItemId = useRef<number | null>(null);

  const { data: dbBrands = [] } = useQuery<string[]>({ queryKey: ["/api/wire-reels/brands"] });

  const allBrands = useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];
    const push = (b: string) => { const k = b.toLowerCase(); if (b && !seen.has(k)) { seen.add(k); merged.push(b); } };
    (dbBrands as string[]).forEach(push);
    getStoredBrands().forEach(push);
    KNOWN_BRANDS.forEach(push);
    return merged;
  }, [dbBrands]);

  useEffect(() => {
    if (!item || item.id === prevItemId.current) return;
    prevItemId.current = item.id;
    setFetching(true);
    fetch(`/api/wire-reels/${item.id}/next-id`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setNextSeq(typeof d.nextSeq === "number" ? d.nextSeq : 1); setFetching(false); })
      .catch(() => { setFetching(false); });
  }, [item?.id]);

  function getReelId(brand: string, rowIndex: number): string | null {
    if (nextSeq === null || !item) return null;
    return generateReelId(item, brand || "XX", nextSeq + pendingCount + rowIndex);
  }

  function updateRow(tempId: string, patch: Partial<BulkReelRow>) {
    setRows(prev => prev.map(r => r.tempId === tempId ? { ...r, ...patch, error: null } : r));
  }

  function removeRow(tempId: string) {
    setRows(prev => prev.length === 1 ? [makeBulkRow()] : prev.filter(r => r.tempId !== tempId));
  }

  function handleAddAll() {
    const validated = rows.map((row, idx) => {
      const ft = typeof row.lengthFt === "number" ? row.lengthFt : parseInt(String(row.lengthFt), 10);
      if (isNaN(ft) || ft <= 0) return { ...row, error: t.movItemLengthRequired };
      if (!getReelId(row.brand, idx)) return { ...row, error: t.movItemReelIdNotReady };
      return { ...row, error: null };
    });
    setRows(validated);
    if (validated.some(r => r.error)) return;

    const reels: NewReel[] = rows.map((row, idx) => {
      const ft = typeof row.lengthFt === "number" ? row.lengthFt : parseInt(String(row.lengthFt), 10);
      return {
        tempId: row.tempId,
        lengthFt: ft,
        brand: row.brand.trim(),
        reelId: getReelId(row.brand, idx)!,
        locationId: row.locationId ? parseInt(row.locationId, 10) : null,
        status: row.status,
      };
    });
    onAddAll(reels);
    const newBrands = rows.map(r => r.brand.trim()).filter(b => b && !allBrands.some(x => x.toLowerCase() === b.toLowerCase()));
    if (newBrands.length) saveCustomBrands(newBrands);
    setRows([makeBulkRow()]);
  }

  const narrow = useIsNarrow();

  const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: F.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.8, fontFamily: "Barlow Condensed, sans-serif" };
  const INPUT: React.CSSProperties = { height: 32, padding: "0 8px", fontSize: 13, background: F.surface, border: `1px solid ${F.borderStrong}`, borderRadius: 7, color: F.text, outline: "none", width: "100%", boxSizing: "border-box" as const };
  const GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(100px,130px) 78px 1fr 1fr 68px 26px", gap: 6, alignItems: "center" };

  const RemoveBtn = ({ tempId, idx: i }: { tempId: string; idx: number }) => (
    <button
      type="button"
      onClick={() => removeRow(tempId)}
      title={t.movItemRemoveRow}
      style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: F.danger, opacity: 0.6, borderRadius: 5, flexShrink: 0, transition: "opacity 0.15s, background 0.15s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,80,80,0.12)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.6"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
      data-testid={`btn-remove-bulk-row-${i}`}
    >
      <X style={{ width: 13, height: 13 }} />
    </button>
  );

  return (
    <div style={{ marginTop: 10, padding: "10px 12px", background: F.bg, border: `1px solid ${F.accentBorder}`, borderRadius: 9 }} data-testid="bulk-reel-entry">
      <div style={{ fontSize: 10, fontWeight: 700, color: F.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: "Barlow Condensed, sans-serif" }}>
        {t.movItemNewReels}
      </div>

      {/* ── Desktop header row ── */}
      {!narrow && (
        <div style={{ ...GRID, marginBottom: 4 }}>
          <div style={LBL}>{t.movItemReelId}</div>
          <div style={LBL}>{t.movItemLengthFt}</div>
          <div style={LBL}>{t.movItemBrand}</div>
          <div style={LBL}>{t.movItemLocation}</div>
          <div style={LBL}>{t.movItemStatus}</div>
          <div />
        </div>
      )}

      {rows.map((row, idx) => {
        const reelId = getReelId(row.brand, idx);

        if (narrow) {
          // ── Mobile: two-row card layout ────────────────────────────────────
          return (
            <div key={row.tempId} style={{ marginBottom: 8, background: F.surface, border: `1px solid ${F.border}`, borderRadius: 8, padding: "8px 10px" }}>
              {/* Row 1: Reel ID + Length FT */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                <div>
                  <div style={{ ...LBL, marginBottom: 3 }}>{t.movItemReelId}</div>
                  <div style={{ height: 32, display: "flex", alignItems: "center", background: F.bg, border: `1px solid ${F.border}`, borderRadius: 7, padding: "0 8px", overflow: "hidden" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: fetching ? F.textDim : reelId ? F.accent : F.textDim, fontFamily: "Barlow Condensed, sans-serif", whiteSpace: "nowrap", letterSpacing: 0.3, overflow: "hidden", textOverflow: "ellipsis" }} data-testid={`bulk-reel-id-${idx}`}>
                      {fetching ? "…" : reelId ?? "—"}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ ...LBL, marginBottom: 3 }}>{t.movItemLengthFt}</div>
                  <input
                    type="number" min={1} value={row.lengthFt}
                    onChange={e => { const v = parseInt(e.target.value, 10); updateRow(row.tempId, { lengthFt: isNaN(v) ? "" : v }); }}
                    style={INPUT}
                    data-testid={`bulk-reel-length-${idx}`}
                  />
                </div>
              </div>

              {/* Row 2: Brand + Location + Status + Remove */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 72px 26px", gap: 6, alignItems: "end" }}>
                <div>
                  <div style={{ ...LBL, marginBottom: 3 }}>{t.movItemBrand}</div>
                  <BrandCombobox
                    value={row.brand}
                    onChange={v => updateRow(row.tempId, { brand: v })}
                    allBrands={allBrands}
                    idx={idx}
                  />
                </div>
                <div>
                  <div style={{ ...LBL, marginBottom: 3 }}>{t.movItemLocation}</div>
                  <ReelLocationSelect
                    value={row.locationId}
                    onChange={v => updateRow(row.tempId, { locationId: v })}
                    locations={locations}
                    idx={idx}
                  />
                </div>
                <div>
                  <div style={{ ...LBL, marginBottom: 3 }}>{t.movItemStatus}</div>
                  <select
                    value={row.status}
                    onChange={e => updateRow(row.tempId, { status: e.target.value })}
                    style={INPUT}
                    data-testid={`bulk-reel-status-${idx}`}
                  >
                    <option value="new">{t.movItemNew}</option>
                    <option value="used">{t.movItemUsed}</option>
                  </select>
                </div>
                <div style={{ paddingBottom: 1 }}>
                  <RemoveBtn tempId={row.tempId} idx={idx} />
                </div>
              </div>

              {row.error && (
                <p style={{ fontSize: 10, color: F.danger, marginTop: 4 }}>{row.error}</p>
              )}
            </div>
          );
        }

        // ── Desktop: single-row grid ──────────────────────────────────────────
        return (
          <div key={row.tempId} style={{ marginBottom: 5 }}>
            <div style={GRID}>
              <div style={{ height: 32, display: "flex", alignItems: "center", background: F.bg, border: `1px solid ${F.border}`, borderRadius: 7, padding: "0 8px", overflow: "hidden" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: fetching ? F.textDim : reelId ? F.accent : F.textDim, fontFamily: "Barlow Condensed, sans-serif", whiteSpace: "nowrap", letterSpacing: 0.3 }} data-testid={`bulk-reel-id-${idx}`}>
                  {fetching ? "…" : reelId ?? "—"}
                </span>
              </div>
              <input
                type="number" min={1} value={row.lengthFt}
                onChange={e => { const v = parseInt(e.target.value, 10); updateRow(row.tempId, { lengthFt: isNaN(v) ? "" : v }); }}
                style={INPUT}
                data-testid={`bulk-reel-length-${idx}`}
              />
              <BrandCombobox
                value={row.brand}
                onChange={v => updateRow(row.tempId, { brand: v })}
                allBrands={allBrands}
                idx={idx}
              />
              <ReelLocationSelect
                value={row.locationId}
                onChange={v => updateRow(row.tempId, { locationId: v })}
                locations={locations}
                idx={idx}
              />
              <select
                value={row.status}
                onChange={e => updateRow(row.tempId, { status: e.target.value })}
                style={INPUT}
                data-testid={`bulk-reel-status-${idx}`}
              >
                <option value="new">{t.movItemNew}</option>
                <option value="used">{t.movItemUsed}</option>
              </select>
              <RemoveBtn tempId={row.tempId} idx={idx} />
            </div>
            {row.error && (
              <p style={{ fontSize: 10, color: F.danger, marginTop: 2, paddingLeft: 2 }}>{row.error}</p>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setRows(prev => [...prev, makeBulkRow()])}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "none", border: `1px dashed ${F.borderStrong}`, borderRadius: 7, color: F.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.3 }}
          data-testid="btn-add-reel-row"
        >
          <Plus style={{ width: 12, height: 12 }} />
          {t.movItemAddReelRow}
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setRows([makeBulkRow()])}
            style={{ padding: "5px 12px", borderRadius: 7, background: "none", border: `1px solid ${F.borderStrong}`, color: F.textMuted, fontSize: 12, cursor: "pointer" }}
            data-testid="btn-bulk-reel-clear"
          >
            {t.movItemClear}
          </button>
          <button
            type="button"
            onClick={handleAddAll}
            disabled={!nextSeq || fetching}
            style={{ padding: "5px 16px", borderRadius: 7, background: F.accent, border: "none", color: F.accentText, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: (!nextSeq || fetching) ? 0.5 : 1, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.3 }}
            data-testid="btn-add-all-reels"
          >
            {t.movItemAddAllReels}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Item Row (field mode) ─────────────────────────────────────────────────────
export function ItemRowField({
  row, idx, itemCount, items, locations, onUpdate, onRemove, movementType,
  isLoading = false, errorMessage = null,
  searchPlaceholder,
  closeText,
}: {
  row: ItemRow;
  idx: number;
  itemCount: number;
  items: any[];
  locations: any[];
  onUpdate: (rowId: string, patch: Partial<ItemRow>) => void;
  onRemove: (rowId: string) => void;
  movementType?: string;
  isLoading?: boolean;
  errorMessage?: string | null;
  searchPlaceholder?: string;
  closeText?: string;
}) {
  const { t } = useLanguage();
  const { F } = useFieldTheme();
  const sp = searchPlaceholder ?? t.movSearchByNameSkuSize;
  const ct = closeText ?? t.movSearchDone;
  const selectedItem = items?.find((i: any) => i.id === row.itemId);

  const { data: reelsRaw = [] } = useQuery<any[]>({
    queryKey: ["/api/wire-reels", row.itemId],
    enabled: !!row.itemId,
  });
  const reels = reelsRaw as any[];
  const hasReels = reels.length > 0;

  const isReelItem = shouldShowReelUI(selectedItem);
  const isReceive = movementType === "receive";
  const showReceiveReelUI = isReceive && !!row.itemId && isReelItem;
  const showIssueReelUI = !isReceive && isReelItem && hasReels;

  const selections = row.reelSelections ?? {};
  const snapshots = row.reelSnapshots ?? {};
  const selectedCount = Object.keys(selections).length;
  const totalFt = Object.values(selections).reduce((a, b) => a + b, 0);

  const newReels = row.newReels ?? [];
  const newReelsTotalFt = newReels.reduce((s, r) => s + r.lengthFt, 0);

  const didInitRef = useRef(false);
  useEffect(() => {
    if (showIssueReelUI && !didInitRef.current) {
      didInitRef.current = true;
      onUpdate(row.rowId, { quantity: 0 });
    }
  }, [showIssueReelUI]);

  useEffect(() => {
    if (showReceiveReelUI && !didInitRef.current) {
      didInitRef.current = true;
      onUpdate(row.rowId, { quantity: 0, newReels: [] });
    }
  }, [showReceiveReelUI]);

  function toggleReel(reel: any) {
    const newSel = { ...selections };
    const newSnap = { ...snapshots };
    if (newSel[reel.id] !== undefined) {
      delete newSel[reel.id];
      delete newSnap[reel.id];
    } else {
      newSel[reel.id] = reel.lengthFt;
      newSnap[reel.id] = { id: reel.id, reelId: reel.reelId, lengthFt: reel.lengthFt, status: reel.status };
    }
    const total = Object.values(newSel).reduce((a, b) => a + b, 0);
    onUpdate(row.rowId, { reelSelections: newSel, reelSnapshots: newSnap, quantity: total });
  }

  function setReelFt(reelId: number, value: number, maxFt: number) {
    const newSel = { ...selections };
    const newSnap = { ...snapshots };
    if (value <= 0) {
      delete newSel[reelId];
      delete newSnap[reelId];
    } else {
      newSel[reelId] = Math.min(value, maxFt);
    }
    const total = Object.values(newSel).reduce((a, b) => a + b, 0);
    onUpdate(row.rowId, { reelSelections: newSel, reelSnapshots: newSnap, quantity: total });
  }

  function removeNewReel(tempId: string) {
    const updated = newReels.filter(r => r.tempId !== tempId);
    const total = updated.reduce((s, r) => s + r.lengthFt, 0);
    onUpdate(row.rowId, { newReels: updated, quantity: total });
  }

  function addNewReels(reels: NewReel[]) {
    const updated = [...newReels, ...reels];
    const total = updated.reduce((s, r) => s + r.lengthFt, 0);
    onUpdate(row.rowId, { newReels: updated, quantity: total });
  }

  const showQtyStepper = !showReceiveReelUI && !showIssueReelUI;

  return (
    <div
      style={{ position: "relative", zIndex: itemCount - idx, background: F.surface, border: `1px solid ${F.borderStrong}`, borderRadius: 10, padding: 8 }}
      data-testid={`item-row-${idx}`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchableItemSelect
            value={row.itemId}
            onChange={(id) => {
              didInitRef.current = false;
              onUpdate(row.rowId, { itemId: id, reelSelections: {}, reelSnapshots: {}, quantity: 1, newReels: [] });
            }}
            items={items || []}
            dark={true}
            isLoading={isLoading}
            errorMessage={errorMessage}
            searchPlaceholder={sp}
            closeText={ct}
          />
          {row.errors.itemId && (
            <p style={{ fontSize: 10, color: F.danger, marginTop: 3, marginLeft: 2 }} data-testid={`error-item-${idx}`}>{row.errors.itemId}</p>
          )}
        </div>

        {showQtyStepper && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <button type="button" onClick={() => onUpdate(row.rowId, { quantity: Math.max(0, row.quantity - 1) })} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px 0 0 8px", border: `1px solid ${F.borderStrong}`, borderRight: "none", background: F.surface, color: F.textMuted, cursor: "pointer" }} data-testid={`btn-qty-dec-${idx}`}>
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" value={row.quantity}
                onChange={(e) => { const v = parseInt(e.target.value.replace(/\D/g, ""), 10); onUpdate(row.rowId, { quantity: isNaN(v) || v < 0 ? 0 : v }); }}
                onBlur={(e) => { const v = parseInt(e.target.value, 10); if (isNaN(v) || v < 0) onUpdate(row.rowId, { quantity: 0 }); }}
                style={{ textAlign: "center", height: 34, width: 56, fontSize: 13, fontWeight: 700, border: `1px solid ${F.borderStrong}`, borderLeft: "none", borderRight: "none", background: F.bg, color: F.text, outline: "none", padding: 0 }}
                data-testid={`input-quantity-${idx}`}
              />
              <button type="button" onClick={() => onUpdate(row.rowId, { quantity: row.quantity + 1 })} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 8px 8px 0", border: `1px solid ${F.borderStrong}`, borderLeft: "none", background: F.surface, color: F.textMuted, cursor: "pointer" }} data-testid={`btn-qty-inc-${idx}`}>
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
              {selectedItem && (
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: F.textMuted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{selectedItem.unitOfMeasure}</span>
              )}
            </div>
            {row.errors.quantity && (
              <p style={{ fontSize: 10, color: F.danger, marginTop: 3, textAlign: "center" }} data-testid={`error-qty-${idx}`}>{row.errors.quantity}</p>
            )}
          </div>
        )}

        <div style={{ flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onRemove(row.rowId)}
            disabled={itemCount === 1}
            style={{ padding: "5px 7px", borderRadius: 7, color: itemCount === 1 ? F.border : F.danger, background: "none", border: "none", cursor: itemCount === 1 ? "not-allowed" : "pointer", opacity: itemCount === 1 ? 0.35 : 0.65, transition: "opacity 0.15s, background 0.15s" }}
            onMouseEnter={itemCount > 1 ? e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,80,80,0.12)"; } : undefined}
            onMouseLeave={itemCount > 1 ? e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.65"; (e.currentTarget as HTMLButtonElement).style.background = "none"; } : undefined}
            data-testid={`btn-remove-row-${idx}`}
            title={t.movItemRemoveItem}
          >
            <Trash2 style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      {/* ── Receive Reel UI ─────────────────────────────────────────── */}
      {showReceiveReelUI && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${F.borderStrong}`, paddingTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: F.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: "Barlow Condensed, sans-serif" }}>
            {t.movItemActiveReels}
          </div>
          {reels.length === 0 ? (
            <div style={{ fontSize: 11, color: F.textDim, padding: "4px 0 8px", fontStyle: "italic" }}>{t.movItemNoActiveReels}</div>
          ) : (
            reels.map((reel: any) => {
              const isNew = reel.status === "new" || reel.status === "full";
              return (
                <div key={reel.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", marginBottom: 3, borderRadius: 7, background: F.bg, border: `1px solid ${F.border}` }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: F.text, fontFamily: "Barlow Condensed, sans-serif", minWidth: 44 }}>{reel.reelId}</span>
                  <span style={{ fontSize: 13, color: F.accent, fontWeight: 600, fontFamily: "Barlow Condensed, sans-serif" }}>{reel.lengthFt} FT</span>
                  {reel.brand && <span style={{ fontSize: 11, color: F.textMuted }}>{reel.brand}</span>}
                  {reel.location && <span style={{ fontSize: 11, color: F.textMuted }}>{reel.location.name}</span>}
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 10, background: isNew ? F.accentBg : F.warningBg, color: isNew ? F.accent : F.warning }}>
                    {isNew ? t.movItemNew : t.movItemUsed}
                  </span>
                </div>
              );
            })
          )}

          {newReels.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: F.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontFamily: "Barlow Condensed, sans-serif" }}>
                {t.movItemAdding}
              </div>
              {newReels.map(nr => (
                <div key={nr.tempId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", marginBottom: 3, borderRadius: 7, background: F.accentBg, border: `1px solid ${F.accentBorder}` }} data-testid={`new-reel-pending-${nr.tempId}`}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: F.accent, fontFamily: "Barlow Condensed, sans-serif", minWidth: 44 }}>{nr.reelId}</span>
                  <span style={{ fontSize: 13, color: F.text, fontWeight: 600, fontFamily: "Barlow Condensed, sans-serif" }}>{nr.lengthFt} FT</span>
                  {nr.brand && <span style={{ fontSize: 11, color: F.textMuted }}>{nr.brand}</span>}
                  <button type="button" onClick={() => removeNewReel(nr.tempId)} style={{ marginLeft: "auto", padding: 3, background: "none", border: "none", cursor: "pointer", color: F.textDim }} data-testid={`btn-remove-new-reel-${nr.tempId}`}>
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <BulkReelEntry item={selectedItem ?? null} pendingCount={newReels.length} onAddAll={addNewReels} locations={locations} />

          {newReels.length > 0 && (
            <div style={{ textAlign: "right", marginTop: 6, fontSize: 12, color: F.textMuted }}>
              {t.movItemNewReelsCountFt.replace("{n}", String(newReels.length)).replace("{ft}", newReelsTotalFt.toLocaleString())}
            </div>
          )}
          {row.errors.quantity && (
            <p style={{ fontSize: 10, color: F.danger, marginTop: 4 }} data-testid={`error-qty-${idx}`}>{row.errors.quantity}</p>
          )}
        </div>
      )}

      {/* ── Issue / Return Reel UI ───────────────────────────────────── */}
      {showIssueReelUI && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${F.borderStrong}`, paddingTop: 8 }}>
          {reels.map((reel: any) => {
            const isSelected = selections[reel.id] !== undefined;
            const ftValue = selections[reel.id] ?? reel.lengthFt;
            const isNew = reel.status === "new" || reel.status === "full";
            return (
              <div
                key={reel.id}
                onClick={() => toggleReel(reel)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", marginBottom: 4, borderRadius: 8, borderLeft: `3px solid ${isSelected ? F.accent : "transparent"}`, background: isSelected ? F.accentBg : "transparent", cursor: "pointer", userSelect: "none" }}
                data-testid={`reel-row-${reel.id}`}
              >
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${isSelected ? F.accent : F.borderStrong}`, background: isSelected ? F.accent : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isSelected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: F.accentText }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 12, color: F.text, fontFamily: "Barlow Condensed, sans-serif" }}>{reel.reelId}</span>
                    <span style={{ fontSize: 15, color: F.accent, fontFamily: "Barlow Condensed, sans-serif", fontWeight: 500 }}>{reel.lengthFt} FT</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 10, background: isNew ? F.accentBg : F.warningBg, color: isNew ? F.accent : F.warning }}>
                      {isNew ? t.movItemNew : t.movItemUsed}
                    </span>
                    {reel.location && <span style={{ fontSize: 11, color: F.textMuted }}>{reel.location.name}</span>}
                  </div>
                </div>
                {isSelected && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number" min={1} max={reel.lengthFt} value={ftValue}
                      onChange={(e) => { const v = parseInt(e.target.value, 10); setReelFt(reel.id, isNaN(v) ? 0 : v, reel.lengthFt); }}
                      style={{ width: 70, height: 30, textAlign: "center", fontSize: 13, fontWeight: 700, background: F.surface, border: `1px solid ${F.borderStrong}`, borderRadius: 7, color: F.text, outline: "none", padding: "0 6px" }}
                      data-testid={`reel-ft-input-${reel.id}`}
                    />
                    <span style={{ fontSize: 11, color: F.textDim, whiteSpace: "nowrap" }}>/ {reel.lengthFt} FT</span>
                  </div>
                )}
              </div>
            );
          })}
          {row.errors.quantity && (
            <p style={{ fontSize: 10, color: F.danger, marginTop: 3, marginLeft: 2 }} data-testid={`error-qty-${idx}`}>{row.errors.quantity}</p>
          )}
          {selectedCount > 0 && (
            <div style={{ textAlign: "right", marginTop: 4, fontSize: 12, color: F.textMuted }}>
              {t.movItemReelsCountFt.replace("{n}", String(selectedCount)).replace("{ft}", totalFt.toLocaleString())}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
