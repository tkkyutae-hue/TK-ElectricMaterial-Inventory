import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { ItemStatusBadge } from "@/components/StatusBadge";
import {
  Search, Package, X, ChevronLeft, ChevronRight,
  ImageOff, Home,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onSelect("all")}
          data-testid={`${testIdPrefix}-all`}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            selected === "all"
              ? "bg-[#0A6B24] text-white shadow-sm"
              : "bg-white border border-[#D9E7DD] text-slate-600 hover:border-[#0A6B24]/50 hover:text-[#0A6B24]"
          }`}
        >
          All
        </button>
        {entries.map(f => (
          <button
            key={f.name}
            onClick={() => onSelect(f.name)}
            data-testid={`${testIdPrefix}-${f.name}`}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              selected === f.name
                ? "bg-[#0A6B24] text-white shadow-sm"
                : "bg-white border border-[#D9E7DD] text-slate-600 hover:border-[#0A6B24]/50 hover:text-[#0A6B24]"
            }`}
          >
            {getLabel(f.name)}
            <span className="ml-1 opacity-60">({f.count})</span>
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
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
        <ImageOff className="w-4 h-4 text-slate-300" />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center">
      <img
        src={imageUrl}
        alt={name}
        className="w-full h-full object-cover"
        onError={(e) => {
          const p = e.currentTarget.parentElement;
          if (p) {
            p.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>';
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
            <ItemStatusBadge status={item.status} />
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
            <Package className="w-5 h-5 text-[#0A6B24]" />
            <h1 className="text-2xl font-display font-bold text-slate-900">Inventory</h1>
          </div>
          <p className="text-[#64748B] text-sm">카테고리 선택 후 Family, Type, Subcategory, Size로 세분화합니다.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-500 hover:text-[#0A6B24] hover:bg-[#EAF7EE] gap-1.5 mt-1"
          onClick={() => navigate("/field")}
          data-testid="btn-back-field-home"
        >
          <Home className="w-4 h-4" />
          <span className="text-xs font-medium">Field Home</span>
        </Button>
      </div>

      {/* ── Category Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Browse by Category</h2>
          {selectedCatId !== null && (
            <button
              onClick={() => { setSelectedCatId(null); setSelectedFamily("all"); setSelectedType("all"); setSelectedSubcategory("all"); setSelectedSize("all"); setPage(1); }}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500 transition-colors"
              data-testid="btn-clear-category"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        {!categorySummary ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {[1,2,3,4,5].map(i => <div key={i} className="rounded-xl bg-slate-100 animate-pulse" style={{ aspectRatio: "16/10" }} />)}
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
                  className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 focus:outline-none ${
                    isActive
                      ? "border-[#0A6B24] ring-2 ring-[#0A6B24]/30 shadow-lg"
                      : "border-transparent hover:border-[#D9E7DD] hover:shadow-md"
                  }`}
                  style={{ aspectRatio: "16/10" }}
                >
                  <div className="absolute inset-0">
                    {cat.imageUrl ? (
                      <>
                        <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover object-center"
                          onError={e => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)?.style.removeProperty("display"); }} />
                        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} style={{ display: "none" }} />
                      </>
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
                      <p className="text-white font-semibold text-[10px] sm:text-xs leading-tight line-clamp-2 drop-shadow">
                        {cat.name}
                      </p>
                    </div>
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-[#0A6B24] border-2 border-white shadow" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search name, SKU, size…"
            value={searchInput}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8 h-9 text-sm bg-white border-[#D9E7DD] focus-visible:ring-[#0A6B24]/30"
            data-testid="field-inv-search"
          />
          {searchInput && (
            <button onClick={() => handleSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Size dropdown — dynamic options based on current filters */}
        {selectedCatId !== null && sizes.length > 0 && (
          <Select value={selectedSize} onValueChange={handleSizeChange}>
            <SelectTrigger className="w-32 h-9 text-sm bg-white border-[#D9E7DD]" data-testid="field-inv-size-filter">
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
          <SelectTrigger className="w-32 h-9 text-sm bg-white border-[#D9E7DD]" data-testid="field-inv-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
          <SelectTrigger className="w-24 h-9 text-sm bg-white border-[#D9E7DD]" data-testid="field-inv-page-size">
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
            <Badge className="bg-[#EAF7EE] text-[#0A6B24] border-[#D9E7DD] gap-1 pl-2 pr-1 py-1 text-xs">
              {selectedCat.name}
              <button onClick={() => { setSelectedCatId(null); setSelectedFamily("all"); setSelectedType("all"); setSelectedSubcategory("all"); setSelectedSize("all"); setPage(1); }} className="ml-0.5 hover:text-red-500 rounded-full">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {selectedFamily !== "all" && (
            <Badge variant="outline" className="text-slate-600 gap-1 pl-2 pr-1 py-1 text-xs">
              {getFamilyDisplay(selectedFamily)}
              <button onClick={() => { setSelectedFamily("all"); setSelectedType("all"); setSelectedSubcategory("all"); setSelectedSize("all"); setPage(1); }} className="ml-0.5 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {selectedType !== "all" && (
            <Badge variant="outline" className="text-slate-600 gap-1 pl-2 pr-1 py-1 text-xs">
              {selectedType}
              <button onClick={() => { setSelectedType("all"); setSelectedSubcategory("all"); setSelectedSize("all"); setPage(1); }} className="ml-0.5 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {selectedSubcategory !== "all" && (
            <Badge variant="outline" className="text-slate-600 gap-1 pl-2 pr-1 py-1 text-xs">
              {selectedSubcategory}
              <button onClick={() => { setSelectedSubcategory("all"); setPage(1); }} className="ml-0.5 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {selectedSize !== "all" && (
            <Badge variant="outline" className="text-slate-600 gap-1 pl-2 pr-1 py-1 text-xs">
              {selectedSize}
              <button onClick={() => { setSelectedSize("all"); setPage(1); }} className="ml-0.5 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {selectedStatus !== "all" && (
            <Badge variant="outline" className="text-slate-600 gap-1 pl-2 pr-1 py-1 text-xs">
              {STATUS_OPTIONS.find(o => o.value === selectedStatus)?.label}
              <button onClick={() => { setSelectedStatus("all"); setPage(1); }} className="ml-0.5 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {searchInput && (
            <Badge variant="outline" className="text-slate-600 gap-1 pl-2 pr-1 py-1 text-xs">
              "{searchInput}"
              <button onClick={() => { setSearchInput(""); setPage(1); }} className="ml-0.5 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          <span className="text-xs text-[#64748B]">{totalItems.toLocaleString()} item{totalItems !== 1 ? "s" : ""}</span>
          <button
            onClick={clearAll}
            className="ml-1 text-xs text-slate-400 hover:text-red-500 underline underline-offset-2 transition-colors"
            data-testid="btn-clear-all-filters"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Item Table ── */}
      <div className="bg-white border border-[#D9E7DD] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "108px" }} />  {/* SKU */}
              <col style={{ width: "52px" }} />   {/* Photo */}
              <col style={{ width: "88px" }} />   {/* Size */}
              <col />                              {/* Item — widest */}
              <col style={{ width: "120px" }} />  {/* Category */}
              <col style={{ width: "110px" }} />  {/* Location */}
              <col style={{ width: "56px" }} />   {/* Qty */}
              <col style={{ width: "96px" }} />   {/* Status */}
            </colgroup>
            <thead>
              <tr className="bg-[#F6F7F9] border-b border-[#D9E7DD]">
                {[
                  { label: "SKU",      align: "left"   },
                  { label: "Photo",    align: "center" },
                  { label: "Size",     align: "left"   },
                  { label: "Item",     align: "left"   },
                  { label: "Category", align: "left",  cls: "hidden sm:table-cell" },
                  { label: "Location", align: "left",  cls: "hidden md:table-cell" },
                  { label: "Qty",      align: "center" },
                  { label: "Status",   align: "center" },
                ].map(col => (
                  <th
                    key={col.label}
                    className={`px-3 py-2.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wide align-middle whitespace-nowrap ${col.align === "center" ? "text-center" : "text-left"} ${col.cls || ""}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {[1,2,3,4,5,6,7,8].map(j => (
                      <td key={j} className="px-3 py-3 align-middle">
                        <div className="h-4 bg-slate-100 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-sm text-[#64748B]">
                    {hasFilters ? "No items match your filters." : "No items found."}
                  </td>
                </tr>
              ) : pageItems.map((item: FieldItem) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-[#EAF7EE]/40 transition-colors cursor-pointer"
                  onClick={() => setSelectedItem(item)}
                  data-testid={`field-inv-row-${item.id}`}
                >
                  {/* SKU */}
                  <td className="px-3 py-3 align-middle whitespace-nowrap">
                    <span className="font-mono text-[11px] text-[#64748B]">{item.sku}</span>
                  </td>

                  {/* Photo */}
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center justify-center">
                      <PhotoCell imageUrl={item.imageUrl} name={item.name} />
                    </div>
                  </td>

                  {/* Size */}
                  <td className="px-3 py-3 align-middle">
                    <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
                      {item.sizeLabel ?? "—"}
                    </span>
                  </td>

                  {/* Item — widest, may wrap */}
                  <td className="px-3 py-3 align-middle">
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{item.name}</p>
                    {item.extractedSubcategory && (
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{item.extractedSubcategory}</p>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-3 py-3 align-middle hidden sm:table-cell">
                    <span className="text-xs text-[#64748B] leading-snug">{item.category?.name ?? "—"}</span>
                  </td>

                  {/* Location */}
                  <td className="px-3 py-3 align-middle hidden md:table-cell">
                    <span className="text-xs text-[#64748B]">{item.location?.name ?? "—"}</span>
                  </td>

                  {/* Qty */}
                  <td className="px-3 py-3 align-middle text-center">
                    <span className="font-semibold text-sm text-slate-900 tabular-nums">{item.quantityOnHand.toLocaleString()}</span>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center justify-center">
                      <ItemStatusBadge status={item.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalItems > 0 && (
          <div className="px-4 py-2.5 border-t border-[#D9E7DD] flex items-center justify-between">
            <span className="text-xs text-[#64748B]">
              {`${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalItems)}`} of {totalItems.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-[#EAF7EE] hover:text-[#0A6B24]"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                data-testid="btn-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-2 text-xs text-slate-600 font-medium min-w-[80px] text-center">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-[#EAF7EE] hover:text-[#0A6B24]"
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
