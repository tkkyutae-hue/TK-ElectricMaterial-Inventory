import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import {
  Search, Package, X, ChevronLeft, ChevronRight,
  ImageOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_GRADIENTS: Record<string, string> = {
  "CT": "from-sky-700 to-sky-900",
  "CF": "from-slate-600 to-slate-800",
  "CS": "from-zinc-600 to-zinc-800",
  "CW": "from-orange-600 to-orange-900",
  "DV": "from-violet-600 to-violet-900",
  "FH": "from-stone-600 to-stone-800",
  "BC": "from-brand-600 to-brand-900",
  "DP": "from-indigo-700 to-indigo-900",
  "GT": "from-teal-600 to-teal-900",
  "TM": "from-amber-600 to-amber-900",
};

const PAGE_SIZE_OPTIONS = [10, 15, 20, 25];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
];

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
  const config: Record<string, { label: string; bg: string; color: string; border: string }> = {
    in_stock:     { label: "In Stock",     bg: "rgba(45,219,111,0.10)",  color: "#2ddb6f", border: "1px solid rgba(45,219,111,0.25)" },
    low_stock:    { label: "Low Stock",    bg: "rgba(245,166,35,0.10)",  color: "#f5a623", border: "1px solid rgba(245,166,35,0.25)" },
    out_of_stock: { label: "Out of Stock", bg: "rgba(255,80,80,0.10)",   color: "#ff5050", border: "1px solid rgba(255,80,80,0.25)" },
    ordered:      { label: "Ordered",      bg: "rgba(56,189,248,0.10)",  color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)" },
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
}: {
  label: string;
  entries: PillEntry[];
  selected: string;
  onSelect: (v: string) => void;
  testIdPrefix: string;
  displayFn?: (name: string) => string;
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
          All
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

// ─── Item Detail Dialog ──────────────────────────────────────────────────────

function ItemDetailDialog({ item, onClose }: { item: FieldItem; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{item.name}</DialogTitle>
        </DialogHeader>
        {item.imageUrl && (
          <img src={item.imageUrl} alt={item.name} className="w-full h-36 object-cover rounded-xl mb-2" />
        )}
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">SKU</span>
            <span className="font-mono font-medium">{item.sku}</span>
          </div>
          {item.sizeLabel && (
            <div className="flex justify-between">
              <span className="text-slate-500">Size</span>
              <span>{item.sizeLabel}</span>
            </div>
          )}
          {item.subcategory && (
            <div className="flex justify-between">
              <span className="text-slate-500">Family</span>
              <span>{getFamilyDisplay(item.subcategory)}</span>
            </div>
          )}
          {item.detailType && (
            <div className="flex justify-between">
              <span className="text-slate-500">Type</span>
              <span>{item.detailType}</span>
            </div>
          )}
          {item.extractedSubcategory && (
            <div className="flex justify-between">
              <span className="text-slate-500">Subcategory</span>
              <span>{item.extractedSubcategory}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Status</span>
            <FieldStatusBadge status={item.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Qty on Hand</span>
            <span className="font-bold text-slate-900">{item.quantityOnHand.toLocaleString()} {item.unitOfMeasure}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Reorder Point</span>
            <span>{item.reorderPoint.toLocaleString()}</span>
          </div>
          {item.location && (
            <div className="flex justify-between">
              <span className="text-slate-500">Location</span>
              <span>{item.location.name}</span>
            </div>
          )}
          {item.category && (
            <div className="flex justify-between">
              <span className="text-slate-500">Category</span>
              <span>{item.category.name}</span>
            </div>
          )}
          {item.supplier && (
            <div className="flex justify-between">
              <span className="text-slate-500">Supplier</span>
              <span>{item.supplier.name}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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

  // Dynamic sizes: recalculate from current filtered result (excluding size filter)
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

  // Auto-reset size if it no longer exists in new sizes list
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

  // ── Computed flags ──
  const showTypePills = selectedFamily !== "all" && types.length >= 1;
  const showSubcategoryPills = selectedType !== "all" && !subcatFetching && subcategories.length >= 1;

  // ── Handlers with cascade resets ──

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

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Package className="w-5 h-5" style={{ color: "#2ddb6f" }} />
            <h1 className="text-2xl font-display font-bold" style={{ color: "#e2f0e5" }}>Inventory</h1>
          </div>
          <p className="text-sm" style={{ color: "#7aab82" }}>Select a category, then filter by Family, Type, Subcategory, and Size.</p>
        </div>
      </div>

      {/* ── Category Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 style={{ fontSize: 11, fontWeight: 700, color: "#7aab82", textTransform: "uppercase", letterSpacing: "0.08em" }}>Browse by Category</h2>
          {selectedCatId !== null && (
            <button
              onClick={() => { setSelectedCatId(null); setSelectedFamily("all"); setSelectedType("all"); setSelectedSubcategory("all"); setSelectedSize("all"); setPage(1); }}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#7aab82", background: "none", border: "none", cursor: "pointer" }}
              data-testid="btn-clear-category"
            >
              <X style={{ width: 12, height: 12 }} /> Clear
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
              const gradient = CATEGORY_GRADIENTS[cat.code || ""] || "from-slate-600 to-slate-800";
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
          label="Family"
          entries={families}
          selected={selectedFamily}
          onSelect={handleFamilyChange}
          testIdPrefix="chip-family"
          displayFn={getFamilyDisplay}
        />
      )}

      {/* ── Level 3: Type (shows when family selected + ≥2 types) ── */}
      {showTypePills && (
        <PillBar
          label="Type"
          entries={types}
          selected={selectedType}
          onSelect={handleTypeChange}
          testIdPrefix="chip-type"
        />
      )}

      {/* ── Level 4: Subcategory (shows when type selected + ≥1 subcategory exists) ── */}
      {showSubcategoryPills && (
        <PillBar
          label="Subcategory"
          entries={subcategories}
          selected={selectedSubcategory}
          onSelect={handleSubcategoryChange}
          testIdPrefix="chip-subcategory"
        />
      )}

      {/* ── Filter Row ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#4a7052" }} />
          <Input
            placeholder="Search name, SKU, size…"
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

        {/* Size dropdown — dynamic options based on current filters */}
        {selectedCatId !== null && sizes.length > 0 && (
          <Select value={selectedSize} onValueChange={handleSizeChange}>
            <SelectTrigger className="w-32 h-9 text-sm" style={{ background: "#162019", border: "1px solid #2a4030", color: "#7aab82" }} data-testid="field-inv-size-filter">
              <SelectValue placeholder="All Sizes" />
            </SelectTrigger>
            <SelectContent className="max-h-[264px] overflow-y-auto">
              <SelectItem value="all">All Sizes</SelectItem>
              {sizes.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-32 h-9 text-sm" style={{ background: "#162019", border: "1px solid #2a4030", color: "#7aab82" }} data-testid="field-inv-status-filter">
            <SelectValue placeholder="All Status" />
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
              <SelectItem key={n} value={String(n)}>{n} / pg</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Active Filter Chips ── */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedCat && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(45,219,111,0.10)", border: "1px solid rgba(45,219,111,0.3)", color: "#2ddb6f", borderRadius: 20, fontSize: 12, padding: "3px 8px 3px 10px" }}>
              {selectedCat.name}
              <button onClick={() => { setSelectedCatId(null); setSelectedFamily("all"); setSelectedType("all"); setSelectedSubcategory("all"); setSelectedSize("all"); setPage(1); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#2ddb6f", padding: 0, marginLeft: 2, display: "flex", alignItems: "center" }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </span>
          )}
          {selectedFamily !== "all" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(45,219,111,0.10)", border: "1px solid rgba(45,219,111,0.3)", color: "#2ddb6f", borderRadius: 20, fontSize: 12, padding: "3px 8px 3px 10px" }}>
              {getFamilyDisplay(selectedFamily)}
              <button onClick={() => { setSelectedFamily("all"); setSelectedType("all"); setSelectedSubcategory("all"); setSelectedSize("all"); setPage(1); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#2ddb6f", padding: 0, marginLeft: 2, display: "flex", alignItems: "center" }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </span>
          )}
          {selectedType !== "all" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(45,219,111,0.10)", border: "1px solid rgba(45,219,111,0.3)", color: "#2ddb6f", borderRadius: 20, fontSize: 12, padding: "3px 8px 3px 10px" }}>
              {selectedType}
              <button onClick={() => { setSelectedType("all"); setSelectedSubcategory("all"); setSelectedSize("all"); setPage(1); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#2ddb6f", padding: 0, marginLeft: 2, display: "flex", alignItems: "center" }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </span>
          )}
          {selectedSubcategory !== "all" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(45,219,111,0.10)", border: "1px solid rgba(45,219,111,0.3)", color: "#2ddb6f", borderRadius: 20, fontSize: 12, padding: "3px 8px 3px 10px" }}>
              {selectedSubcategory}
              <button onClick={() => { setSelectedSubcategory("all"); setPage(1); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#2ddb6f", padding: 0, marginLeft: 2, display: "flex", alignItems: "center" }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </span>
          )}
          {selectedSize !== "all" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(45,219,111,0.10)", border: "1px solid rgba(45,219,111,0.3)", color: "#2ddb6f", borderRadius: 20, fontSize: 12, padding: "3px 8px 3px 10px" }}>
              {selectedSize}
              <button onClick={() => { setSelectedSize("all"); setPage(1); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#2ddb6f", padding: 0, marginLeft: 2, display: "flex", alignItems: "center" }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </span>
          )}
          {selectedStatus !== "all" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(45,219,111,0.10)", border: "1px solid rgba(45,219,111,0.3)", color: "#2ddb6f", borderRadius: 20, fontSize: 12, padding: "3px 8px 3px 10px" }}>
              {STATUS_OPTIONS.find(o => o.value === selectedStatus)?.label}
              <button onClick={() => { setSelectedStatus("all"); setPage(1); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#2ddb6f", padding: 0, marginLeft: 2, display: "flex", alignItems: "center" }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </span>
          )}
          {searchInput && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(45,219,111,0.10)", border: "1px solid rgba(45,219,111,0.3)", color: "#2ddb6f", borderRadius: 20, fontSize: 12, padding: "3px 8px 3px 10px" }}>
              "{searchInput}"
              <button onClick={() => { setSearchInput(""); setPage(1); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#2ddb6f", padding: 0, marginLeft: 2, display: "flex", alignItems: "center" }}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </span>
          )}
          <span style={{ fontSize: 12, color: "#4a7052" }}>{totalItems.toLocaleString()} item{totalItems !== 1 ? "s" : ""}</span>
          <button
            onClick={clearAll}
            style={{ marginLeft: 4, fontSize: 12, color: "#2ddb6f", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
            data-testid="btn-clear-all-filters"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Item Table ── */}
      <div style={{ background: "#162019", border: "1px solid #1e2e21", borderRadius: 12, overflow: "hidden" }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "120px" }} />  {/* SKU */}
              <col style={{ width: "52px" }} />   {/* Photo */}
              <col style={{ width: "80px" }} />   {/* Size */}
              <col />                              {/* Item — widest */}
              <col style={{ width: "140px" }} />  {/* Category */}
              <col style={{ width: "110px" }} />  {/* Qty/Unit */}
              <col style={{ width: "130px" }} />  {/* Location */}
              <col style={{ width: "110px" }} />  {/* Status */}
            </colgroup>
            <thead>
              <tr style={{ background: "#162019", borderBottom: "1px solid #1e2e21" }}>
                {[
                  { label: "SKU",        align: "left"   },
                  { label: "Photo",      align: "left"   },
                  { label: "Size",       align: "left"   },
                  { label: "Item",       align: "left"   },
                  { label: "Category",   align: "left",  cls: "hidden sm:table-cell" },
                  { label: "Qty / Unit", align: "right"  },
                  { label: "Location",   align: "left",  cls: "hidden md:table-cell" },
                  { label: "Status",     align: "center" },
                ].map(col => (
                  <th
                    key={col.label}
                    className={`px-3 py-2.5 align-middle whitespace-nowrap ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"} ${col.cls || ""}`}
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
                    {hasFilters ? "No items match your filters." : "No items found."}
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
                  {/* SKU */}
                  <td className="px-3 py-3 align-middle whitespace-nowrap">
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#7aab82" }}>{item.sku}</span>
                  </td>

                  {/* Photo */}
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center justify-center">
                      <PhotoCell imageUrl={item.imageUrl} name={item.name} />
                    </div>
                  </td>

                  {/* Size */}
                  <td className="px-3 py-3 align-middle">
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#7aab82", whiteSpace: "nowrap" }}>
                      {item.sizeLabel ?? "—"}
                    </span>
                  </td>

                  {/* Item — widest, may wrap */}
                  <td className="px-3 py-3 align-middle">
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#e2f0e5", lineHeight: 1.3 }}>{item.name}</p>
                    {item.extractedSubcategory && (
                      <p style={{ fontSize: 10, color: "#4a7052", lineHeight: 1.3, marginTop: 2 }}>{item.extractedSubcategory}</p>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-3 py-3 align-middle hidden sm:table-cell">
                    <span style={{ fontSize: 11, color: "#7aab82", lineHeight: 1.3 }}>{item.category?.name ?? "—"}</span>
                  </td>

                  {/* Qty / Unit */}
                  <td className="px-3 py-3 align-middle text-right whitespace-nowrap">
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: qtyColor(item.status), tabularNums: true } as any}>{item.quantityOnHand.toLocaleString()}</span>
                    <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 400, color: "#7aab82" }}>{item.unitOfMeasure}</span>
                  </td>

                  {/* Location */}
                  <td className="px-3 py-3 align-middle hidden md:table-cell">
                    <span style={{ fontSize: 12, color: "#7aab82" }}>{item.location?.name ?? "—"}</span>
                  </td>

                  {/* Status */}
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

      {/* Item detail dialog */}
      {selectedItem && (
        <ItemDetailDialog item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
