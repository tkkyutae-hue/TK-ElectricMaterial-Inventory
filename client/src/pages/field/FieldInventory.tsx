import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { ItemStatusBadge } from "@/components/StatusBadge";
import {
  Search, Package, X, ChevronLeft, ChevronRight,
  ImageOff, ChevronDown, Home,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Types ─────────────────────────────────────────────────────────────────

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
  imageUrl?: string | null;
  location?: { name: string } | null;
  category?: { name: string } | null;
  supplier?: { name: string } | null;
};

type FieldItemsResponse = {
  items: FieldItem[];
  total: number;
};

type FamilyEntry = { name: string; count: number };
type TypeEntry = { name: string; count: number };

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

// Family display name mapping (DB value → UI label)
const FAMILY_DISPLAY_NAMES: Record<string, string> = {
  "Flex Conduit": "Flexible",
  "EMT Conduit": "EMT",
  "RMC/IMC Conduit": "Rigid",
  "PVC Conduit": "PVC",
};

function getFamilyDisplay(name: string): string {
  return FAMILY_DISPLAY_NAMES[name] ?? name;
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

function PhotoCell({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  if (!imageUrl) {
    return (
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <ImageOff className="w-4 h-4 text-slate-300" />
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={name}
      className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-slate-100"
      onError={(e) => {
        const t = e.currentTarget;
        t.style.display = "none";
        const sib = t.nextElementSibling as HTMLElement | null;
        if (sib) sib.style.display = "flex";
      }}
    />
  );
}

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

// ─── Pill Row ────────────────────────────────────────────────────────────────

function PillBar({
  label,
  entries,
  selected,
  onSelect,
  testIdPrefix,
  displayFn,
}: {
  label: string;
  entries: { name: string; count: number }[];
  selected: string;
  onSelect: (v: string) => void;
  testIdPrefix: string;
  displayFn?: (name: string) => string;
}) {
  const top = entries.slice(0, 6);
  const rest = entries.slice(6);
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
        {top.map(f => (
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
        {rest.length > 0 && (
          <Select value={selected} onValueChange={onSelect}>
            <SelectTrigger
              className="h-[28px] px-2.5 text-xs rounded-full border-[#D9E7DD] bg-white gap-1 w-auto"
              data-testid={`${testIdPrefix}-more`}
            >
              <ChevronDown className="w-3 h-3 text-slate-400" />
              <span className="text-slate-500">More…</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {rest.map(f => (
                <SelectItem key={f.name} value={f.name}>{getLabel(f.name)} ({f.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FieldInventory() {
  const rawSearch = useSearch();
  const [, navigate] = useLocation();

  const urlParams = useMemo(() => new URLSearchParams(rawSearch), [rawSearch]);

  const getCatId = () => urlParams.get("category") ? Number(urlParams.get("category")) : null;
  const getFamily = () => urlParams.get("family") || "all";
  const getType = () => urlParams.get("type") || "all";
  const getSize = () => urlParams.get("size") || "all";
  const getStatus = () => urlParams.get("status") || "all";
  const getSearch = () => urlParams.get("q") || "";
  const getPage = () => urlParams.get("page") ? Number(urlParams.get("page")) : 1;
  const getPerPage = () => urlParams.get("perPage") ? Number(urlParams.get("perPage")) : 10;

  const [selectedCatId, setSelectedCatId] = useState<number | null>(getCatId);
  const [selectedFamily, setSelectedFamily] = useState(getFamily);
  const [selectedType, setSelectedType] = useState(getType);
  const [selectedSize, setSelectedSize] = useState(getSize);
  const [selectedStatus, setSelectedStatus] = useState(getStatus);
  const [searchInput, setSearchInput] = useState(getSearch);
  const [page, setPage] = useState(getPage);
  const [pageSize, setPageSize] = useState(getPerPage);
  const [selectedItem, setSelectedItem] = useState<FieldItem | null>(null);

  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    const next = new URLSearchParams();
    if (selectedCatId) next.set("category", String(selectedCatId));
    if (selectedFamily !== "all") next.set("family", selectedFamily);
    if (selectedType !== "all") next.set("type", selectedType);
    if (selectedSize !== "all") next.set("size", selectedSize);
    if (selectedStatus !== "all") next.set("status", selectedStatus);
    if (debouncedSearch) next.set("q", debouncedSearch);
    if (page !== 1) next.set("page", String(page));
    if (pageSize !== 10) next.set("perPage", String(pageSize));
    const qs = next.toString();
    navigate("/field/inventory" + (qs ? "?" + qs : ""), { replace: true });
  }, [selectedCatId, selectedFamily, selectedType, selectedSize, selectedStatus, debouncedSearch, page, pageSize, navigate]);

  const { data: categorySummary } = useQuery<CategorySummary[]>({
    queryKey: ["/api/inventory/categories/summary"],
  });

  const selectedCat = useMemo(
    () => categorySummary?.find(c => c.id === selectedCatId) || null,
    [categorySummary, selectedCatId]
  );

  const { data: families = [] } = useQuery<FamilyEntry[]>({
    queryKey: ["/api/field/families", selectedCatId],
    queryFn: async () => {
      const qs = selectedCatId ? `?category=${selectedCatId}` : "";
      const r = await fetch("/api/field/families" + qs, { credentials: "include" });
      return r.json();
    },
  });

  const { data: types = [] } = useQuery<TypeEntry[]>({
    queryKey: ["/api/field/types", selectedCatId, selectedFamily],
    queryFn: async () => {
      if (!selectedCatId || selectedFamily === "all") return [];
      const p = new URLSearchParams();
      p.set("category", String(selectedCatId));
      p.set("family", selectedFamily);
      const r = await fetch("/api/field/types?" + p.toString(), { credentials: "include" });
      return r.json();
    },
    enabled: selectedCatId !== null && selectedFamily !== "all",
  });

  const showTypePills = selectedFamily !== "all" && types.length >= 2;

  const { data: sizes = [] } = useQuery<string[]>({
    queryKey: ["/api/field/sizes", selectedCatId, selectedFamily],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedCatId) p.set("category", String(selectedCatId));
      if (selectedFamily !== "all") p.set("family", selectedFamily);
      const qs = p.toString();
      const r = await fetch("/api/field/sizes" + (qs ? "?" + qs : ""), { credentials: "include" });
      return r.json();
    },
  });

  const { data: fieldData, isLoading } = useQuery<FieldItemsResponse>({
    queryKey: ["/api/field/items", selectedCatId, selectedFamily, selectedType, selectedSize, selectedStatus, debouncedSearch, page, pageSize],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedCatId) p.set("category", String(selectedCatId));
      if (selectedFamily !== "all") p.set("family", selectedFamily);
      if (selectedType !== "all") p.set("type", selectedType);
      if (selectedSize !== "all") p.set("size", selectedSize);
      if (selectedStatus !== "all") p.set("status", selectedStatus);
      if (debouncedSearch) p.set("q", debouncedSearch);
      p.set("page", String(page));
      p.set("perPage", String(pageSize));
      const r = await fetch("/api/field/items?" + p.toString(), { credentials: "include" });
      return r.json();
    },
  });

  const pageItems = fieldData?.items || [];
  const totalItems = fieldData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  function handleCategoryClick(cat: CategorySummary) {
    if (selectedCatId === cat.id) {
      setSelectedCatId(null);
    } else {
      setSelectedCatId(cat.id);
    }
    setSelectedFamily("all");
    setSelectedType("all");
    setSelectedSize("all");
    setPage(1);
  }

  function handleFamilyChange(v: string) {
    setSelectedFamily(v);
    setSelectedType("all");
    setSelectedSize("all");
    setPage(1);
  }

  function handleTypeChange(v: string) {
    setSelectedType(v);
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
    setSelectedSize("all");
    setSelectedStatus("all");
    setSearchInput("");
    setPage(1);
  }

  const hasFilters = selectedCatId !== null || selectedFamily !== "all" || selectedType !== "all" || selectedSize !== "all" || selectedStatus !== "all" || searchInput !== "";

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Package className="w-5 h-5 text-[#0A6B24]" />
            <h1 className="text-2xl font-display font-bold text-slate-900">Inventory</h1>
          </div>
          <p className="text-[#64748B] text-sm">Tap a category, then filter by family, type, size, or status.</p>
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
              onClick={() => { setSelectedCatId(null); setSelectedFamily("all"); setSelectedType("all"); setSelectedSize("all"); setPage(1); }}
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
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget.parentElement?.querySelector(".cat-fallback") as HTMLElement;
                            if (fallback) fallback.style.display = "block";
                          }}
                        />
                        <div className={`cat-fallback hidden absolute inset-0 bg-gradient-to-br ${gradient}`} />
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

      {/* ── Level 2: Family Quick-Bar ── */}
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

      {/* ── Level 3: Type Pills (only when 2+ types exist for selected cat+family) ── */}
      {showTypePills && (
        <PillBar
          label="Type"
          entries={types}
          selected={selectedType}
          onSelect={handleTypeChange}
          testIdPrefix="chip-type"
        />
      )}

      {/* ── Filter Row: Search + Size + Status + Page size ── */}
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
            <button
              onClick={() => handleSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

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
              <button onClick={() => { setSelectedCatId(null); setSelectedFamily("all"); setSelectedType("all"); setSelectedSize("all"); setPage(1); }} className="ml-0.5 hover:text-red-500 rounded-full">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {selectedFamily !== "all" && (
            <Badge variant="outline" className="text-slate-600 gap-1 pl-2 pr-1 py-1 text-xs">
              {getFamilyDisplay(selectedFamily)}
              <button onClick={() => { setSelectedFamily("all"); setSelectedType("all"); setSelectedSize("all"); setPage(1); }} className="ml-0.5 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {selectedType !== "all" && (
            <Badge variant="outline" className="text-slate-600 gap-1 pl-2 pr-1 py-1 text-xs">
              {selectedType}
              <button onClick={() => { setSelectedType("all"); setPage(1); }} className="ml-0.5 hover:text-red-500">
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
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F6F7F9] border-b border-[#D9E7DD]">
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 pl-4 w-[120px] whitespace-nowrap">SKU</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 w-10 text-center">Photo</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 w-[90px] whitespace-nowrap hidden sm:table-cell">Size</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5">Item</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 hidden sm:table-cell w-[100px]">Category</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 hidden md:table-cell w-[120px]">Location</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 text-center w-[60px]">Qty</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 text-center pr-4 w-[90px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-50">
                    {[120, 40, 90, 200, 100, 120, 60, 90].map((w, j) => (
                      <TableCell key={j} className="py-2.5">
                        <div className="h-4 bg-slate-100 animate-pulse rounded" style={{ width: `${w * 0.6}px` }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-[#64748B]">
                    {hasFilters ? "No items match your filters." : "No items found."}
                  </TableCell>
                </TableRow>
              ) : pageItems.map((item: FieldItem) => (
                <TableRow
                  key={item.id}
                  className="hover:bg-[#EAF7EE]/40 transition-colors cursor-pointer border-b border-slate-50 last:border-0"
                  onClick={() => setSelectedItem(item)}
                  data-testid={`field-inv-row-${item.id}`}
                >
                  <TableCell className="py-2.5 pl-4 whitespace-nowrap">
                    <span className="font-mono text-[11px] text-[#64748B]">{item.sku}</span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex items-center justify-center">
                      <PhotoCell imageUrl={item.imageUrl} name={item.name} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 hidden sm:table-cell">
                    <span className="text-xs text-slate-700 whitespace-nowrap font-medium">
                      {item.sizeLabel ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <p className="text-sm font-medium text-slate-800 leading-snug">{item.name}</p>
                  </TableCell>
                  <TableCell className="py-2.5 hidden sm:table-cell text-xs text-[#64748B]">
                    {item.category?.name ?? "—"}
                  </TableCell>
                  <TableCell className="py-2.5 hidden md:table-cell text-xs text-[#64748B]">
                    {item.location?.name ?? "—"}
                  </TableCell>
                  <TableCell className="py-2.5 text-center">
                    <span className="font-semibold text-slate-900 tabular-nums text-sm">
                      {item.quantityOnHand.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 pr-4">
                    <div className="flex justify-center items-center">
                      <ItemStatusBadge status={item.status} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination footer */}
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
