import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import {
  Search, Package, X, ChevronLeft, ChevronRight,
  ImageOff, ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { getCategoryGradient } from "@/lib/categoryUtils";
import { FilterChip } from "@/components/shared/FilterChip";
import { useAuth } from "@/hooks/use-auth";
import { isReelEligible } from "@/lib/reelEligibility";

// ─── Types ──────────────────────────────────────────────────────────────────

type CategorySummary = {
  id: number;
  name: string;
  code?: string | null;
  imageUrl?: string | null;
  skuCount: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
};

type FieldItem = {
  id: number;
  sku: string;
  name: string;
  sizeLabel?: string | null;
  quantityOnHand: number;
  unitOfMeasure: string;
  status: string;
  reorderPoint: number;
  categoryId?: number | null;
  subcategory?: string | null;
  detailType?: string | null;
  extractedSubcategory?: string;
  imageUrl?: string | null;
  location?: { name: string } | null;
  category?: { name: string } | null;
  supplier?: { name: string } | null;
};

type FieldItemsResponse = {
  items: FieldItem[];
  total: number;
};

type PillEntry = { name: string; count: number };

type FieldWireReel = {
  id: number;
  reelId: string;
  lengthFt: number;
  brand: string | null;
  status: string | null;
  location: { id: number; name: string } | null;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 15, 20, 25];

function getFamilyDisplay(name: string): string {
  return name;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Field Status Badge ──────────────────────────────────────────────────────

function FieldStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const config: Record<string, { label: string; bg: string; color: string; border: string }> = {
    in_stock:     { label: t.inStock,     bg: "rgba(45,219,111,0.10)",  color: "#2ddb6f", border: "1px solid rgba(45,219,111,0.25)" },
    low_stock:    { label: t.lowStock,    bg: "rgba(245,166,35,0.10)",  color: "#f5a623", border: "1px solid rgba(245,166,35,0.25)" },
    out_of_stock: { label: t.outOfStock,  bg: "rgba(255,80,80,0.10)",   color: "#ff5050", border: "1px solid rgba(255,80,80,0.25)" },
    ordered:      { label: t.ordered,     bg: "rgba(56,189,248,0.10)",  color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)" },
  };
  const { label, bg, color, border } = config[status] || { label: status, bg: "rgba(100,116,139,0.10)", color: "#7aab82", border: "1px solid rgba(100,116,139,0.25)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: bg, color, border, borderRadius: 20,
      fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
      padding: "2px 8px", whiteSpace: "nowrap",
      fontFamily: "'Barlow Condensed', sans-serif",
    }}>
      {label}
    </span>
  );
}

// ─── PillBar ────────────────────────────────────────────────────────────────

function PillBar({
  label,
  entries,
  selected,
  onSelect,
  testIdPrefix,
  displayFn,
  allLabel,
}: {
  label: string;
  entries: PillEntry[];
  selected: string;
  onSelect: (v: string) => void;
  testIdPrefix: string;
  displayFn?: (name: string) => string;
  allLabel: string;
}) {
  const getLabel = displayFn ?? ((n: string) => n);

  return (
    <div>
      <p style={{ fontSize: 9, fontWeight: 700, color: "#4a7052", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onSelect("all")}
          data-testid={`${testIdPrefix}-all`}
          style={selected === "all" ? {
            padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: "#2ddb6f", color: "#0d1410", border: "1px solid #2ddb6f", cursor: "pointer",
          } : {
            padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
            background: "#1c2b1f", color: "#7aab82", border: "1px solid #2a4030", cursor: "pointer",
          }}
        >
          {allLabel}
        </button>
        {entries.map(f => (
          <button
            key={f.name}
            onClick={() => onSelect(f.name)}
            data-testid={`${testIdPrefix}-${f.name}`}
            style={selected === f.name ? {
              padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: "#2ddb6f", color: "#0d1410", border: "1px solid #2ddb6f", cursor: "pointer",
            } : {
              padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
              background: "#1c2b1f", color: "#7aab82", border: "1px solid #2a4030", cursor: "pointer",
            }}
          >
            {getLabel(f.name)}
            <span style={{ marginLeft: 4, opacity: 0.6 }}>({f.count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Photo Cell ─────────────────────────────────────────────────────────────

function PhotoCell({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  if (!imageUrl) {
    return (
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "#162019", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ImageOff style={{ width: 16, height: 16, color: "#4a7052" }} />
      </div>
    );
  }
  return (
    <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", border: "1px solid #2a4030", background: "#162019", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img
        src={imageUrl}
        alt={name}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onError={(e) => {
          const p = e.currentTarget.parentElement;
          if (p) {
            p.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><svg style="width:16px;height:16px;color:#4a7052" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>';
          }
        }}
      />
    </div>
  );
}

// ─── Reel Row ────────────────────────────────────────────────────────────────

const REEL_STATUS_DOT: Record<string, { color: string }> = {
  new:      { color: "#2ddb6f" },
  used:     { color: "#f5a623" },
  depleted: { color: "#ff5050" },
};

function ReelRow({ reel }: { reel: FieldWireReel }) {
  const dot = REEL_STATUS_DOT[reel.status || ""] || { color: "#7aab82" };
  return (
    <div style={{
      background: "#162019", border: "1px solid #1e2e21", borderRadius: 9,
      padding: "9px 12px", display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot.color, flexShrink: 0, boxShadow: `0 0 5px ${dot.color}80` }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: "#e2f0e5", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, flex: "0 0 auto", minWidth: 64 }}>
        {reel.reelId}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color: "#2ddb6f", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
        {reel.lengthFt.toLocaleString()} FT
      </span>
      <div style={{ flex: 1 }} />
      {reel.location && (
        <span style={{ fontSize: 11, color: "#7aab82", fontFamily: "'Barlow Condensed', sans-serif", maxWidth: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          {reel.location.name}
        </span>
      )}
      {reel.brand && (
        <span style={{ fontSize: 10, color: "#4a7052", fontFamily: "'Barlow Condensed', sans-serif", flexShrink: 0 }}>
          {reel.brand}
        </span>
      )}
    </div>
  );
}

// ─── Field Item Detail Panel ─────────────────────────────────────────────────

function FieldItemDetailPanel({ item, onClose }: { item: FieldItem; onClose: () => void }) {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const { isManagerOrAbove } = useAuth();
  const isReelItem = isReelEligible(item);
  const [imgEnlarged, setImgEnlarged] = useState(false);

  const { data: reels, isLoading: reelsLoading } = useQuery<FieldWireReel[]>({
    queryKey: ["/api/wire-reels", item.id],
    queryFn: async () => {
      const r = await fetch(`/api/wire-reels/${item.id}`, { credentials: "include" });
      return r.json();
    },
    enabled: isReelItem,
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const totalFt = reels?.reduce((sum, r) => sum + (r.lengthFt || 0), 0) ?? 0;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex" }}>
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)" }}
        onClick={onClose}
      />

      {/* Panel — right-side drawer */}
      <div
        data-testid="field-item-detail-panel"
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          width: "min(420px, 100vw)",
          background: "#0d1410",
          borderLeft: "1px solid #2a4030",
          display: "flex", flexDirection: "column",
          boxShadow: "-8px 0 48px rgba(0,0,0,0.65)",
          overflowY: "auto",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "15px 16px 12px",
          borderBottom: "1px solid #1e2e21",
          position: "sticky", top: 0, background: "#0d1410", zIndex: 2,
          gap: 10,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 8, fontWeight: 700, color: "#4a7052", textTransform: "uppercase" as const, letterSpacing: "1.8px", marginBottom: 4, fontFamily: "'Barlow Condensed', sans-serif" }}>
              {isReelItem ? t.cableWireDetail : t.materialDetail}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2f0e5", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.1, margin: 0, wordBreak: "break-word" as const }}>
                {item.name}
              </h2>
              <FieldStatusBadge status={item.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="btn-close-detail"
            style={{
              background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 8,
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#7aab82", flexShrink: 0,
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* ── Content ── */}
        <div style={{ padding: "14px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Photo */}
          {item.imageUrl ? (
            <div
              onClick={() => setImgEnlarged(true)}
              data-testid="img-item-photo"
              style={{
                borderRadius: 12, overflow: "hidden", border: "1px solid #2a4030",
                background: "#162019", cursor: "zoom-in", position: "relative",
                height: 172, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <img
                src={item.imageUrl}
                alt={item.name}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", padding: 10 }}
                onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
              />
              <div style={{
                position: "absolute", bottom: 6, right: 8, display: "flex", alignItems: "center", gap: 4,
                fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1,
              }}>
                <ZoomIn style={{ width: 10, height: 10 }} />
                {t.tapToEnlarge}
              </div>
            </div>
          ) : (
            <div style={{
              borderRadius: 12, border: "1px dashed #2a4030", background: "#162019",
              height: 80, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ImageOff style={{ width: 22, height: 22, color: "#2a4030" }} />
            </div>
          )}

          {/* ── Hero qty / total FT ── */}
          <div style={{
            background: "#162019", border: "1px solid #1e2e21", borderRadius: 12,
            padding: "14px 16px", display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#4a7052", textTransform: "uppercase" as const, letterSpacing: "1.2px", marginBottom: 4, fontFamily: "'Barlow Condensed', sans-serif" }}>
                {isReelItem ? t.totalFt : t.colQtyOnHand}
              </p>
              <p style={{ fontSize: 32, fontWeight: 700, color: "#e2f0e5", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1, margin: 0 }}>
                {isReelItem
                  ? `${totalFt.toLocaleString()} FT`
                  : `${item.quantityOnHand.toLocaleString()} ${item.unitOfMeasure}`}
              </p>
            </div>
            {isReelItem && reels && (
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: "#4a7052", textTransform: "uppercase" as const, letterSpacing: "1.2px", marginBottom: 4, fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {t.reelCount}
                </p>
                <p style={{ fontSize: 32, fontWeight: 700, color: "#7aab82", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1, margin: 0 }}>
                  {reels.filter(r => r.status !== "depleted").length}
                </p>
              </div>
            )}
          </div>

          {/* ── Stat grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: t.colSize,     value: item.sizeLabel        || "—", mono: false },
              { label: t.colLocation, value: item.location?.name   || "—", mono: false },
              { label: "SKU",         value: item.sku,                     mono: true  },
              { label: t.colCategory, value: item.category?.name   || "—", mono: false },
            ].map(({ label, value, mono }) => (
              <div key={label} style={{ background: "#162019", border: "1px solid #1e2e21", borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: "#4a7052", textTransform: "uppercase" as const, letterSpacing: "1.2px", marginBottom: 4, fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {label}
                </p>
                <p style={{
                  fontSize: 13, fontWeight: 600, color: "#e2f0e5",
                  fontFamily: mono ? "monospace" : "'Barlow Condensed', sans-serif",
                  letterSpacing: mono ? 0.3 : 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
                  margin: 0,
                }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* ── Reel inventory section (reel items only) ── */}
          {isReelItem && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 4 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: "#4a7052", textTransform: "uppercase" as const, letterSpacing: "1.5px", fontFamily: "'Barlow Condensed', sans-serif", whiteSpace: "nowrap" as const }}>
                  {t.reelInventory}
                </p>
                <div style={{ flex: 1, height: 1, background: "#1e2e21" }} />
              </div>
              {reelsLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ height: 42, borderRadius: 8, background: "#162019", opacity: 0.6 }} />
                  ))}
                </div>
              ) : !reels || reels.length === 0 ? (
                <div style={{
                  background: "#162019", border: "1px dashed #2a4030", borderRadius: 10,
                  padding: "20px 16px", textAlign: "center",
                  color: "#4a7052", fontSize: 13, fontFamily: "'Barlow Condensed', sans-serif",
                }}>
                  {t.noReelsRecorded}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {reels.map(reel => <ReelRow key={reel.id} reel={reel} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Action Footer — manager/admin only ── */}
        {isManagerOrAbove && (
          <div style={{
            position: "sticky", bottom: 0, background: "#0d1410",
            borderTop: "1px solid #1e2e21", padding: "12px 16px",
            display: "flex", gap: 10, zIndex: 2,
          }}>
            <button
              data-testid="btn-log-movement"
              onClick={() => navigate(`/field/movement?itemId=${item.id}`)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10, fontWeight: 700, fontSize: 14,
                background: "#2ddb6f", color: "#0d1410", border: "none", cursor: "pointer",
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
              }}
            >
              Log Movement
            </button>
            <button
              data-testid="btn-full-detail"
              onClick={() => navigate(`/inventory/${item.id}`)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10, fontWeight: 700, fontSize: 14,
                background: "#1c2b1f", color: "#7aab82", border: "1px solid #2a4030", cursor: "pointer",
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
              }}
            >
              Full Detail
            </button>
          </div>
        )}
      </div>

      {/* Enlarged image overlay */}
      {imgEnlarged && item.imageUrl && (
        <div
          style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 3, cursor: "zoom-out",
          }}
          onClick={() => setImgEnlarged(false)}
          data-testid="img-enlarged-overlay"
        >
          <img
            src={item.imageUrl}
            alt={item.name}
            style={{ maxWidth: "92vw", maxHeight: "92vh", objectFit: "contain", borderRadius: 10 }}
          />
        </div>
      )}
    </div>,
    document.body
  );
}

// ─── Qty color helper ────────────────────────────────────────────────────────

function qtyColor(status: string): string {
  if (status === "out_of_stock") return "#ff5050";
  if (status === "low_stock") return "#f5a623";
  return "#2ddb6f";
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FieldInventory() {
  const { t } = useLanguage();
  const rawSearch = useSearch();
  const [, navigate] = useLocation();

  const urlParams = useMemo(() => new URLSearchParams(rawSearch), [rawSearch]);

  const [selectedCatId, setSelectedCatId] = useState<number | null>(
    () => urlParams.get("category") ? Number(urlParams.get("category")) : null
  );
  const [selectedFamily, setSelectedFamily] = useState(() => urlParams.get("family") || "all");
  const [selectedType, setSelectedType] = useState(() => urlParams.get("type") || "all");
  const [selectedSubcategory, setSelectedSubcategory] = useState(() => urlParams.get("subcategory") || "all");
  const [selectedSize, setSelectedSize] = useState(() => urlParams.get("size") || "all");
  const [selectedStatus, setSelectedStatus] = useState(() => urlParams.get("status") || "all");
  const [searchInput, setSearchInput] = useState(() => urlParams.get("q") || "");
  const [page, setPage] = useState(() => urlParams.get("page") ? Number(urlParams.get("page")) : 1);
  const [pageSize, setPageSize] = useState(() => urlParams.get("perPage") ? Number(urlParams.get("perPage")) : 10);
  const [selectedItem, setSelectedItem] = useState<FieldItem | null>(null);

  const debouncedSearch = useDebounce(searchInput, 300);

  // Status options (translated)
  const STATUS_OPTIONS = useMemo(() => [
    { value: "all",          label: t.allStatus  },
    { value: "in_stock",     label: t.inStock    },
    { value: "low_stock",    label: t.lowStock   },
    { value: "out_of_stock", label: t.outOfStock },
  ], [t]);

  // Sync state → URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (selectedCatId) next.set("category", String(selectedCatId));
    if (selectedFamily !== "all") next.set("family", selectedFamily);
    if (selectedType !== "all") next.set("type", selectedType);
    if (selectedSubcategory !== "all") next.set("subcategory", selectedSubcategory);
    if (selectedSize !== "all") next.set("size", selectedSize);
    if (selectedStatus !== "all") next.set("status", selectedStatus);
    if (debouncedSearch) next.set("q", debouncedSearch);
    if (page !== 1) next.set("page", String(page));
    if (pageSize !== 10) next.set("perPage", String(pageSize));
    const qs = next.toString();
    navigate("/field/inventory" + (qs ? "?" + qs : ""), { replace: true });
  }, [selectedCatId, selectedFamily, selectedType, selectedSubcategory, selectedSize, selectedStatus, debouncedSearch, page, pageSize, navigate]);

  // ── Queries ──

  const { data: categorySummary } = useQuery<CategorySummary[]>({
    queryKey: ["/api/inventory/categories/summary"],
  });

  const selectedCat = useMemo(
    () => categorySummary?.find(c => c.id === selectedCatId) || null,
    [categorySummary, selectedCatId]
  );

  const { data: families = [] } = useQuery<PillEntry[]>({
    queryKey: ["/api/field/families", selectedCatId],
    queryFn: async () => {
      const qs = selectedCatId ? `?category=${selectedCatId}` : "";
      const r = await fetch("/api/field/families" + qs, { credentials: "include" });
      return r.json();
    },
  });

  const { data: types = [] } = useQuery<PillEntry[]>({
    queryKey: ["/api/field/types", selectedCatId, selectedFamily],
    queryFn: async () => {
      if (!selectedCatId || selectedFamily === "all") return [];
      const p = new URLSearchParams();
      p.set("category", String(selectedCatId));
      p.set("family", selectedFamily);
      const r = await fetch("/api/field/types?" + p, { credentials: "include" });
      return r.json();
    },
    enabled: selectedCatId !== null && selectedFamily !== "all",
  });

  const { data: subcategories = [], isFetching: subcatFetching } = useQuery<PillEntry[]>({
    queryKey: ["/api/field/subcategories", selectedCatId, selectedFamily, selectedType],
    queryFn: async () => {
      if (!selectedCatId || selectedType === "all") return [];
      const p = new URLSearchParams();
      p.set("category", String(selectedCatId));
      if (selectedFamily !== "all") p.set("family", selectedFamily);
      p.set("type", selectedType);
      const r = await fetch("/api/field/subcategories?" + p, { credentials: "include" });
      return r.json();
    },
    enabled: selectedCatId !== null && selectedType !== "all",
    staleTime: 0,
  });

  const { data: sizes = [] } = useQuery<string[]>({
    queryKey: ["/api/field/sizes", selectedCatId, selectedFamily, selectedType, selectedSubcategory, selectedStatus, debouncedSearch],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedCatId) p.set("category", String(selectedCatId));
      if (selectedFamily !== "all") p.set("family", selectedFamily);
      if (selectedType !== "all") p.set("type", selectedType);
      if (selectedSubcategory !== "all") p.set("subcategory", selectedSubcategory);
      if (selectedStatus !== "all") p.set("status", selectedStatus);
      if (debouncedSearch) p.set("q", debouncedSearch);
      const r = await fetch("/api/field/sizes?" + p, { credentials: "include" });
      return r.json();
    },
  });

  useEffect(() => {
    if (selectedSize !== "all" && sizes.length > 0 && !sizes.includes(selectedSize)) {
      setSelectedSize("all");
    }
  }, [sizes, selectedSize]);

  const { data: fieldData, isLoading } = useQuery<FieldItemsResponse>({
    queryKey: ["/api/field/items", selectedCatId, selectedFamily, selectedType, selectedSubcategory, selectedSize, selectedStatus, debouncedSearch, page, pageSize],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedCatId) p.set("category", String(selectedCatId));
      if (selectedFamily !== "all") p.set("family", selectedFamily);
      if (selectedType !== "all") p.set("type", selectedType);
      if (selectedSubcategory !== "all") p.set("subcategory", selectedSubcategory);
      if (selectedSize !== "all") p.set("size", selectedSize);
      if (selectedStatus !== "all") p.set("status", selectedStatus);
      if (debouncedSearch) p.set("q", debouncedSearch);
      p.set("page", String(page));
      p.set("perPage", String(pageSize));
      const r = await fetch("/api/field/items?" + p, { credentials: "include" });
      return r.json();
    },
  });

  const pageItems = fieldData?.items || [];
  const totalItems = fieldData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const showTypePills = selectedFamily !== "all" && types.length >= 1;
  const showSubcategoryPills = selectedType !== "all" && !subcatFetching && subcategories.length >= 1;

  function handleCategoryClick(cat: CategorySummary) {
    if (selectedCatId === cat.id) {
      setSelectedCatId(null);
    } else {
      setSelectedCatId(cat.id);
    }
    setSelectedFamily("all");
    setSelectedType("all");
    setSelectedSubcategory("all");
    setSelectedSize("all");
    setPage(1);
  }

  function handleFamilyChange(v: string) {
    setSelectedFamily(v);
    setSelectedType("all");
    setSelectedSubcategory("all");
    setSelectedSize("all");
    setPage(1);
  }

  function handleTypeChange(v: string) {
    setSelectedType(v);
    setSelectedSubcategory("all");
    setSelectedSize("all");
    setPage(1);
  }

  function handleSubcategoryChange(v: string) {
    setSelectedSubcategory(v);
    setPage(1);
  }

  function handleSizeChange(v: string) {
    setSelectedSize(v);
    setPage(1);
  }

  function handleStatusChange(v: string) {
    setSelectedStatus(v);
    setPage(1);
  }

  function handleSearch(v: string) {
    setSearchInput(v);
    setPage(1);
  }

  function clearAll() {
    setSelectedCatId(null);
    setSelectedFamily("all");
    setSelectedType("all");
    setSelectedSubcategory("all");
    setSelectedSize("all");
    setSelectedStatus("all");
    setSearchInput("");
    setPage(1);
  }

  const hasFilters = selectedCatId !== null || selectedFamily !== "all" || selectedType !== "all" || selectedSubcategory !== "all" || selectedSize !== "all" || selectedStatus !== "all" || searchInput !== "";

  // Table column definitions (translated)
  const TABLE_COLS = useMemo(() => [
    { label: t.colSku,      align: "left"   },
    { label: t.colPhoto,    align: "left"   },
    { label: t.colSize,     align: "left"   },
    { label: t.colItem,     align: "left"   },
    { label: t.colCategory, align: "left",  cls: "hidden sm:table-cell" },
    { label: t.colQtyUnit,  align: "right"  },
    { label: t.colLocation, align: "left",  cls: "hidden md:table-cell" },
    { label: t.colStatus,   align: "center" },
  ], [t]);

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Package className="w-5 h-5" style={{ color: "#2ddb6f" }} />
            <h1 className="text-2xl font-display font-bold" style={{ color: "#e2f0e5" }}>{t.inventory}</h1>
          </div>
          <p className="text-sm" style={{ color: "#7aab82" }}>{t.inventorySubtitle}</p>
        </div>
      </div>

      {/* ── Category Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 style={{ fontSize: 11, fontWeight: 700, color: "#7aab82", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.browseByCategory}</h2>
          {selectedCatId !== null && (
            <button
              onClick={() => { setSelectedCatId(null); setSelectedFamily("all"); setSelectedType("all"); setSelectedSubcategory("all"); setSelectedSize("all"); setPage(1); }}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#7aab82", background: "none", border: "none", cursor: "pointer" }}
              data-testid="btn-clear-category"
            >
              <X style={{ width: 12, height: 12 }} /> {t.clear}
            </button>
          )}
        </div>
        {!categorySummary ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {[1,2,3,4,5].map(i => <div key={i} className="rounded-xl animate-pulse" style={{ aspectRatio: "16/10", background: "#162019" }} />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {categorySummary.map(cat => {
              const gradient = getCategoryGradient(cat.code);
              const isActive = selectedCatId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  data-testid={`card-category-${cat.id}`}
                  className="relative overflow-hidden transition-all duration-200 focus:outline-none"
                  style={{
                    aspectRatio: "16/8",
                    background: isActive ? "rgba(45,219,111,0.10)" : "#16202e",
                    border: isActive ? "2px solid #2ddb6f" : "2px solid #1e2e21",
                    borderRadius: 10,
                  }}
                >
                  <div className="absolute inset-0">
                    {cat.imageUrl ? (
                      <>
                        <img src={cat.imageUrl} aria-hidden className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-80 brightness-75 saturate-200 pointer-events-none" />
                        <img src={cat.imageUrl} alt={cat.name} className="absolute inset-0 w-full h-full object-contain object-center z-10"
                          onError={e => { e.currentTarget.style.display = "none"; (e.currentTarget.previousElementSibling as HTMLElement)?.style.setProperty("display","none"); (e.currentTarget.nextElementSibling as HTMLElement)?.style.removeProperty("display"); }} />
                        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} style={{ display: "none" }} />
                      </>
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
                    )}
                    <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                    <div className="absolute bottom-0 left-0 right-0 z-30 px-2 pb-1.5">
                      <p style={{ color: "#e2f0e5", fontWeight: 700, fontSize: 10, lineHeight: 1.3, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }} className="sm:text-xs line-clamp-2">
                        {cat.name}
                      </p>
                    </div>
                    {isActive && (
                      <div style={{ position: "absolute", top: 6, right: 6, zIndex: 30, width: 12, height: 12, borderRadius: "50%", background: "#2ddb6f", border: "2px solid #0d1410" }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Selected category heading ── */}
      {selectedCat && (
        <div className="flex items-center gap-2 px-1">
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2ddb6f", textTransform: "uppercase", letterSpacing: "0.1em" }}>{selectedCat.name}</span>
          <div style={{ flex: 1, height: 1, background: "rgba(45,219,111,0.3)" }} />
        </div>
      )}

      {/* ── Level 2: Family ── */}
      {selectedCatId !== null && families.length > 0 && (
        <PillBar
          label={t.family}
          entries={families}
          selected={selectedFamily}
          onSelect={handleFamilyChange}
          testIdPrefix="chip-family"
          displayFn={getFamilyDisplay}
          allLabel={t.allFilter}
        />
      )}

      {/* ── Level 3: Type ── */}
      {showTypePills && (
        <PillBar
          label={t.type}
          entries={types}
          selected={selectedType}
          onSelect={handleTypeChange}
          testIdPrefix="chip-type"
          allLabel={t.allFilter}
        />
      )}

      {/* ── Level 4: Subcategory ── */}
      {showSubcategoryPills && (
        <PillBar
          label={t.subcategory}
          entries={subcategories}
          selected={selectedSubcategory}
          onSelect={handleSubcategoryChange}
          testIdPrefix="chip-subcategory"
          allLabel={t.allFilter}
        />
      )}

      {/* ── Quick Preset Filters ── */}
      <div className="flex items-center gap-2">
        {[
          { label: "⚠ Low Stock",    value: "low_stock"    },
          { label: "✗ Out of Stock", value: "out_of_stock" },
        ].map(preset => {
          const isActive = selectedStatus === preset.value;
          return (
            <button
              key={preset.value}
              data-testid={`btn-preset-${preset.value}`}
              onClick={() => { setSelectedStatus(isActive ? "all" : preset.value); setPage(1); }}
              style={{
                fontSize: 12, fontWeight: 600, borderRadius: 20, padding: "5px 13px",
                border: `1px solid ${isActive ? "#2ddb6f" : "#2a4030"}`,
                background: isActive ? "#2ddb6f" : "#1c2b1f",
                color: isActive ? "#0d1410" : "#7aab82",
                cursor: "pointer", whiteSpace: "nowrap" as const,
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* ── Filter Row ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#4a7052" }} />
          <Input
            placeholder={t.searchPlaceholder}
            value={searchInput}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            style={{ background: "#162019", border: "1px solid #2a4030", color: "#e2f0e5", borderRadius: 9 }}
            data-testid="field-inv-search"
          />
          {searchInput && (
            <button onClick={() => handleSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "#4a7052", background: "none", border: "none", cursor: "pointer" }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {selectedCatId !== null && sizes.length > 0 && (
          <Select value={selectedSize} onValueChange={handleSizeChange}>
            <SelectTrigger className="w-32 h-9 text-sm" style={{ background: "#162019", border: "1px solid #2a4030", color: "#7aab82" }} data-testid="field-inv-size-filter">
              <SelectValue placeholder={t.allSizes} />
            </SelectTrigger>
            <SelectContent className="max-h-[264px] overflow-y-auto">
              <SelectItem value="all">{t.allSizes}</SelectItem>
              {sizes.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-32 h-9 text-sm" style={{ background: "#162019", border: "1px solid #2a4030", color: "#7aab82" }} data-testid="field-inv-status-filter">
            <SelectValue placeholder={t.allStatus} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
          <SelectTrigger className="w-24 h-9 text-sm" style={{ background: "#162019", border: "1px solid #2a4030", color: "#7aab82" }} data-testid="field-inv-page-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(n => (
              <SelectItem key={n} value={String(n)}>{n} {t.perPage}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Active Filter Chips ── */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedCat && (
            <FilterChip label={selectedCat.name} onRemove={() => { setSelectedCatId(null); setSelectedFamily("all"); setSelectedType("all"); setSelectedSubcategory("all"); setSelectedSize("all"); setPage(1); }} />
          )}
          {selectedFamily !== "all" && (
            <FilterChip label={getFamilyDisplay(selectedFamily)} onRemove={() => { setSelectedFamily("all"); setSelectedType("all"); setSelectedSubcategory("all"); setSelectedSize("all"); setPage(1); }} />
          )}
          {selectedType !== "all" && (
            <FilterChip label={selectedType} onRemove={() => { setSelectedType("all"); setSelectedSubcategory("all"); setSelectedSize("all"); setPage(1); }} />
          )}
          {selectedSubcategory !== "all" && (
            <FilterChip label={selectedSubcategory} onRemove={() => { setSelectedSubcategory("all"); setPage(1); }} />
          )}
          {selectedSize !== "all" && (
            <FilterChip label={selectedSize} onRemove={() => { setSelectedSize("all"); setPage(1); }} />
          )}
          {selectedStatus !== "all" && (
            <FilterChip label={STATUS_OPTIONS.find(o => o.value === selectedStatus)?.label ?? selectedStatus} onRemove={() => { setSelectedStatus("all"); setPage(1); }} />
          )}
          {searchInput && (
            <FilterChip label={`"${searchInput}"`} onRemove={() => { setSearchInput(""); setPage(1); }} />
          )}
          <span style={{ fontSize: 12, color: "#4a7052" }}>{totalItems.toLocaleString()} item{totalItems !== 1 ? "s" : ""}</span>
          <button
            onClick={clearAll}
            style={{ marginLeft: 4, fontSize: 12, color: "#2ddb6f", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
            data-testid="btn-clear-all-filters"
          >
            {t.clearAll}
          </button>
        </div>
      )}

      {/* ── Item Table ── */}
      <div style={{ background: "#162019", border: "1px solid #1e2e21", borderRadius: 12, overflow: "hidden" }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "120px" }} />
              <col style={{ width: "52px" }} />
              <col style={{ width: "80px" }} />
              <col />
              <col style={{ width: "140px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "110px" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "#162019", borderBottom: "1px solid #1e2e21" }}>
                {TABLE_COLS.map(col => (
                  <th
                    key={col.label}
                    className={`px-3 py-2.5 align-middle whitespace-nowrap ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"} ${(col as any).cls || ""}`}
                    style={{ fontSize: 9, fontWeight: 700, color: "#7aab82", textTransform: "uppercase", letterSpacing: "1px" }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1e2e21" }}>
                    {[1,2,3,4,5,6,7,8].map(j => (
                      <td key={j} className="px-3 py-3 align-middle">
                        <div className="h-4 rounded animate-pulse" style={{ background: "#1c2b1f" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-sm" style={{ color: "#7aab82" }}>
                    {hasFilters ? t.noItemsMatch : t.noItemsFound}
                  </td>
                </tr>
              ) : pageItems.map((item: FieldItem) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: "1px solid #1e2e21", cursor: "pointer" }}
                  className="transition-colors last:border-0"
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#1c2b1f"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  onClick={() => setSelectedItem(item)}
                  data-testid={`field-inv-row-${item.id}`}
                >
                  <td className="px-3 py-3 align-middle whitespace-nowrap">
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#7aab82" }}>{item.sku}</span>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center justify-center">
                      <PhotoCell imageUrl={item.imageUrl} name={item.name} />
                    </div>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#7aab82", whiteSpace: "nowrap" }}>
                      {item.sizeLabel ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#e2f0e5", lineHeight: 1.3 }}>{item.name}</p>
                    {item.extractedSubcategory && (
                      <p style={{ fontSize: 10, color: "#4a7052", lineHeight: 1.3, marginTop: 2 }}>{item.extractedSubcategory}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 align-middle hidden sm:table-cell">
                    <span style={{ fontSize: 11, color: "#7aab82", lineHeight: 1.3 }}>{item.category?.name ?? "—"}</span>
                  </td>
                  <td className="px-3 py-3 align-middle text-right whitespace-nowrap">
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: qtyColor(item.status), tabularNums: true } as any}>{item.quantityOnHand.toLocaleString()}</span>
                    <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 400, color: "#7aab82" }}>{item.unitOfMeasure}</span>
                  </td>
                  <td className="px-3 py-3 align-middle hidden md:table-cell">
                    <span style={{ fontSize: 12, color: "#7aab82" }}>{item.location?.name ?? "—"}</span>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center justify-center">
                      <FieldStatusBadge status={item.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalItems > 0 && (
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: "1px solid #1e2e21" }}>
            <span style={{ fontSize: 12, color: "#4a7052" }}>
              {`${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalItems)}`} of {totalItems.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                style={{ color: "#4a7052" }}
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                data-testid="btn-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span style={{ padding: "0 8px", fontSize: 12, color: "#7aab82", fontWeight: 500, minWidth: 80, textAlign: "center" }}>
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                style={{ color: "#4a7052" }}
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                data-testid="btn-next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Field item detail panel */}
      {selectedItem && (
        <FieldItemDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
