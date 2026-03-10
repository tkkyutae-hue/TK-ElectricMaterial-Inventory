import { useState, useMemo } from "react";
import { useItems } from "@/hooks/use-items";
import { useQuery } from "@tanstack/react-query";
import { useCategories, useLocations } from "@/hooks/use-reference-data";
import { Search, ChevronLeft, ChevronRight, Package, X } from "lucide-react";
import { Link } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────
type CategorySummary = {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  skuCount: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
};

// ── Design constants ───────────────────────────────────────────────────────────
const GRID_BG = `
  linear-gradient(rgba(45,219,111,0.03) 1px, transparent 1px),
  linear-gradient(90deg, rgba(45,219,111,0.03) 1px, transparent 1px)
`;

const CATEGORY_EMOJIS: Record<string, string> = {
  CT: "🪜", CF: "🔩", CS: "🔧", CW: "⚡",
  DV: "🔌", FH: "🪛", BC: "📦", DP: "⚙️",
  GT: "🌍", TM: "🔨",
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

// ── Status helpers ─────────────────────────────────────────────────────────────
function getQtyColor(status: string) {
  if (status === "out_of_stock") return "#ff5050";
  if (status === "low_stock")    return "#f5a623";
  return "#2ddb6f";
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
    in_stock:      { label: "In Stock",      bg: "rgba(45,219,111,0.08)",  color: "#2ddb6f", border: "rgba(45,219,111,0.2)"  },
    low_stock:     { label: "Low Stock",     bg: "rgba(245,166,35,0.08)", color: "#f5a623", border: "rgba(245,166,35,0.2)"  },
    out_of_stock:  { label: "Out of Stock",  bg: "rgba(255,80,80,0.10)",  color: "#ff5050", border: "rgba(255,80,80,0.2)"   },
  };
  const s = map[status] ?? map["in_stock"];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
      textTransform: "uppercase",
      fontFamily: "'Barlow Condensed', sans-serif",
      padding: "3px 8px", borderRadius: 5,
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      whiteSpace: "nowrap",
    }}>{s.label}</span>
  );
}

// ── Dark select ────────────────────────────────────────────────────────────────
function DarkSelect({
  value, onChange, testId, children,
}: {
  value: string;
  onChange: (v: string) => void;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      data-testid={testId}
      style={{
        background: "#0f1612", border: "1px solid #203023", borderRadius: 9,
        color: "#c8deca", fontSize: 12, padding: "7px 32px 7px 12px",
        fontFamily: "'Barlow', sans-serif", outline: "none",
        cursor: "pointer", height: 36,
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23527856' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
      }}
    >
      {children}
    </select>
  );
}

// ── Category tile ──────────────────────────────────────────────────────────────
function CategoryTile({
  cat, active, onClick,
}: {
  cat: CategorySummary;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const emoji = CATEGORY_EMOJIS[cat.code ?? ""] ?? "📦";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid={`tile-category-${cat.id}`}
      style={{
        background: active ? "rgba(45,219,111,0.08)" : "#0f1612",
        border: `2px solid ${active ? "#2ddb6f" : hovered ? "#203023" : "#182019"}`,
        borderRadius: 10,
        cursor: "pointer",
        padding: 0,
        overflow: "hidden",
        transition: "border-color 0.15s, background 0.15s",
        aspectRatio: "16/9",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        position: "relative",
      }}
    >
      {/* Image or emoji */}
      {cat.imageUrl ? (
        <>
          <img
            src={cat.imageUrl}
            aria-hidden
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", filter: "blur(16px) brightness(0.4) saturate(1.5)",
              transform: "scale(1.2)", pointerEvents: "none",
            }}
          />
          <img
            src={cat.imageUrl}
            alt={cat.name}
            style={{
              position: "relative", zIndex: 1,
              maxWidth: "60%", maxHeight: "55%",
              objectFit: "contain",
              filter: active ? "brightness(1.1)" : "brightness(0.85)",
              transition: "filter 0.15s",
            }}
          />
        </>
      ) : (
        <span style={{ fontSize: 28, position: "relative", zIndex: 1 }}>{emoji}</span>
      )}

      {/* Name below */}
      <span style={{
        position: "relative", zIndex: 1,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 9, fontWeight: 700,
        letterSpacing: 1.2, textTransform: "uppercase",
        color: active ? "#2ddb6f" : "#527856",
        transition: "color 0.15s",
        paddingBottom: 2,
        maxWidth: "90%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        display: "block",
      }}>{cat.name}</span>
    </button>
  );
}

// ── Filter pill ────────────────────────────────────────────────────────────────
function FilterPill({
  label, active, onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 1,
        textTransform: "uppercase",
        fontFamily: "'Barlow Condensed', sans-serif",
        padding: "3px 9px", borderRadius: 4,
        cursor: "pointer",
        background: active ? "rgba(45,219,111,0.08)" : "#141e17",
        border: `1px solid ${active ? "rgba(45,219,111,0.3)" : "#182019"}`,
        color: active ? "#2ddb6f" : "#527856",
        transition: "all 0.12s",
        whiteSpace: "nowrap",
      }}
    >{label}</button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Inventory() {
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [detailTypeFilter, setDetailTypeFilter]     = useState("all");
  const [search,           setSearch]               = useState("");
  const [statusFilter,     setStatusFilter]          = useState("all");
  const [locationFilter,   setLocationFilter]        = useState("all");
  const [page,             setPage]                  = useState(1);
  const [pageSize,         setPageSize]              = useState(25);

  const { data: rawItems, isLoading } = useItems({
    search:     search || undefined,
    status:     statusFilter !== "all"   ? statusFilter   : undefined,
    categoryId: selectedCatId            ? String(selectedCatId) : undefined,
    locationId: locationFilter !== "all" ? locationFilter : undefined,
  });

  const { data: categories }      = useCategories();
  const { data: locations }       = useLocations();
  const { data: categorySummary } = useQuery<CategorySummary[]>({ queryKey: ["/api/inventory/categories/summary"] });

  // Derive subcategory / detailType options from raw items
  const subcategories = useMemo(() => {
    if (!rawItems || !selectedCatId) return [];
    return [...new Set(rawItems.map((i: any) => i.subcategory).filter(Boolean))].sort() as string[];
  }, [rawItems, selectedCatId]);

  const detailTypes = useMemo(() => {
    if (!rawItems || !selectedCatId) return [];
    const base = subcategoryFilter !== "all"
      ? rawItems.filter((i: any) => i.subcategory === subcategoryFilter)
      : rawItems;
    return [...new Set(base.map((i: any) => i.detailType).filter(Boolean))].sort() as string[];
  }, [rawItems, selectedCatId, subcategoryFilter]);

  // Client-side sub-filter
  const items = useMemo(() => {
    if (!rawItems) return [];
    return rawItems.filter((item: any) => {
      if (subcategoryFilter !== "all" && item.subcategory !== subcategoryFilter) return false;
      if (detailTypeFilter  !== "all" && item.detailType  !== detailTypeFilter)  return false;
      return true;
    });
  }, [rawItems, subcategoryFilter, detailTypeFilter]);

  const totalItems  = items.length;
  const totalPages  = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage    = Math.min(page, totalPages);
  const pageItems   = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem   = Math.min(safePage * pageSize, totalItems);

  const selectedCat = categorySummary?.find(c => c.id === selectedCatId);

  function handleCatClick(id: number) {
    if (selectedCatId === id) {
      setSelectedCatId(null);
    } else {
      setSelectedCatId(id);
    }
    setSubcategoryFilter("all");
    setDetailTypeFilter("all");
    setPage(1);
  }

  function clearCategory() {
    setSelectedCatId(null);
    setSubcategoryFilter("all");
    setDetailTypeFilter("all");
    setPage(1);
  }

  const hasFilters = selectedCatId || search || statusFilter !== "all" || locationFilter !== "all";

  return (
    <div style={{
      minHeight: "100%",
      background: "#07090a",
      backgroundImage: GRID_BG,
      backgroundSize: "52px 52px",
      fontFamily: "'Barlow', sans-serif",
    }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 24px 48px" }}>

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{
            fontSize: 11, textTransform: "uppercase", letterSpacing: 2,
            color: "#527856", fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700, margin: "0 0 5px",
          }}>⚡ Inventory</p>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 42, lineHeight: 1, margin: "0 0 5px",
            color: "#ffffff", letterSpacing: 1,
          }}>All Stock</h1>
          <p style={{ fontSize: 12, color: "#2b3f2e", margin: 0 }}>
            Browse by category or search for specific materials and equipment.
          </p>
        </div>

        {/* ── Category grid ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
              textTransform: "uppercase", color: "#2b3f2e",
            }}>Browse by Category</span>
            <span style={{ fontSize: 11, color: "#2b3f2e" }}>{categorySummary?.length ?? 0} categories</span>
          </div>

          {!categorySummary ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{
                  background: "#0f1612", border: "2px solid #182019",
                  borderRadius: 10, aspectRatio: "16/9",
                  animation: "pulse 1.5s ease infinite",
                }} />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {categorySummary.map(cat => (
                <CategoryTile
                  key={cat.id}
                  cat={cat}
                  active={selectedCatId === cat.id}
                  onClick={() => handleCatClick(cat.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Filter bar (shown when category selected) ─────────────────── */}
        {selectedCatId && selectedCat && (subcategories.length > 0 || detailTypes.length > 0) && (
          <div style={{
            background: "#0f1612", border: "1px solid #203023",
            borderRadius: 12, padding: "12px 16px",
            marginBottom: 16,
          }}>
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12, fontWeight: 700, textTransform: "uppercase",
              color: "#2ddb6f", margin: "0 0 10px", letterSpacing: 0.5,
            }}>{selectedCat.name}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {subcategories.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                    color: "#2b3f2e", width: 76, flexShrink: 0,
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}>Type</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    <FilterPill
                      label="All"
                      active={subcategoryFilter === "all"}
                      onClick={() => { setSubcategoryFilter("all"); setDetailTypeFilter("all"); setPage(1); }}
                    />
                    {subcategories.map(s => (
                      <FilterPill
                        key={s}
                        label={s}
                        active={subcategoryFilter === s}
                        onClick={() => { setSubcategoryFilter(s); setDetailTypeFilter("all"); setPage(1); }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {detailTypes.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                    color: "#2b3f2e", width: 76, flexShrink: 0,
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}>Detail</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    <FilterPill
                      label="All"
                      active={detailTypeFilter === "all"}
                      onClick={() => { setDetailTypeFilter("all"); setPage(1); }}
                    />
                    {detailTypes.map(d => (
                      <FilterPill
                        key={d}
                        label={d}
                        active={detailTypeFilter === d}
                        onClick={() => { setDetailTypeFilter(d); setPage(1); }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Search + filter row ───────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8,
          marginBottom: 14,
        }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180, maxWidth: 320 }}>
            <Search style={{
              position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
              width: 13, height: 13, color: "#527856", pointerEvents: "none",
            }} />
            <input
              type="text"
              placeholder="Search by name, SKU, size…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              data-testid="input-search"
              style={{
                width: "100%", height: 36,
                paddingLeft: 30, paddingRight: 12, paddingTop: 0, paddingBottom: 0,
                background: "#0f1612", border: "1px solid #203023", borderRadius: 9,
                color: "#c8deca", fontSize: 12, fontFamily: "'Barlow', sans-serif",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#2ddb6f")}
              onBlur={e => (e.currentTarget.style.borderColor = "#203023")}
            />
          </div>

          {/* Status */}
          <DarkSelect value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }} testId="select-status-filter">
            <option value="all">All Statuses</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </DarkSelect>

          {/* Category */}
          <DarkSelect value={selectedCatId ? String(selectedCatId) : "all"} onChange={v => { handleCatClick(Number(v)); }} testId="select-category-filter">
            <option value="all">All Categories</option>
            {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </DarkSelect>

          {/* Location */}
          <DarkSelect value={locationFilter} onChange={v => { setLocationFilter(v); setPage(1); }} testId="select-location-filter">
            <option value="all">All Locations</option>
            {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </DarkSelect>

          {/* Page size */}
          <DarkSelect value={String(pageSize)} onChange={v => { setPageSize(Number(v)); setPage(1); }} testId="select-page-size">
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} per page</option>)}
          </DarkSelect>
        </div>

        {/* ── Active filter chips ────────────────────────────────────────── */}
        {hasFilters && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {selectedCat && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                fontFamily: "'Barlow Condensed', sans-serif",
                padding: "3px 8px", borderRadius: 5,
                background: "rgba(45,219,111,0.08)",
                border: "1px solid rgba(45,219,111,0.25)",
                color: "#2ddb6f",
              }}>
                {selectedCat.name}
                <button
                  onClick={clearCategory}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "#2ddb6f" }}
                >
                  <X style={{ width: 9, height: 9 }} />
                </button>
              </span>
            )}
            <span style={{ fontSize: 11, color: "#2b3f2e" }}>
              {totalItems} item{totalItems !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────── */}
        <div style={{
          background: "#0f1612", border: "1px solid #182019",
          borderRadius: 12, overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 820 }}>
              <colgroup>
                <col style={{ width: 120 }} />
                <col style={{ width: 48  }} />
                <col style={{ width: 90  }} />
                <col />
                <col style={{ width: 130 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 110 }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: "1px solid #182019" }}>
                  {[
                    { label: "SKU",        align: "left"   },
                    { label: "Photo",      align: "left"   },
                    { label: "Size",       align: "left"   },
                    { label: "Item",       align: "left"   },
                    { label: "Category",   align: "left"   },
                    { label: "Qty / Unit", align: "right"  },
                    { label: "Location",   align: "left"   },
                    { label: "Status",     align: "center" },
                  ].map(col => (
                    <th key={col.label} style={{
                      padding: "10px 12px",
                      fontSize: 9, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: 1,
                      color: "#2b3f2e",
                      textAlign: col.align as any,
                      whiteSpace: "nowrap",
                    }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0d1710" }}>
                      {[1,2,3,4,5,6,7,8].map(j => (
                        <td key={j} style={{ padding: "12px", verticalAlign: "middle" }}>
                          <div style={{ height: 12, background: "#141e17", borderRadius: 4 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "60px 0" }}>
                      <Package style={{ width: 40, height: 40, color: "#2b3f2e", margin: "0 auto 12px" }} />
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#527856", margin: 0 }}>No items found</p>
                      <p style={{ fontSize: 12, color: "#2b3f2e", marginTop: 4 }}>Try adjusting your search or filters.</p>
                    </td>
                  </tr>
                ) : (
                  pageItems.map((item: any) => (
                    <tr
                      key={item.id}
                      data-testid={`row-item-${item.id}`}
                      style={{ borderBottom: "1px solid #0d1710" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#141e17")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* SKU */}
                      <td style={{ padding: "11px 12px", verticalAlign: "middle" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#527856", whiteSpace: "nowrap" }}>
                          {item.sku}
                        </span>
                      </td>
                      {/* Photo */}
                      <td style={{ padding: "11px 12px", verticalAlign: "middle" }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 6,
                          overflow: "hidden", border: "1px solid #203023",
                          background: "#141e17",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <Package style={{ width: 14, height: 14, color: "#2b3f2e" }} />
                          )}
                        </div>
                      </td>
                      {/* Size */}
                      <td style={{ padding: "11px 12px", verticalAlign: "middle" }}>
                        <span style={{ fontSize: 11, color: "#527856", whiteSpace: "nowrap" }}>
                          {item.sizeLabel || "—"}
                        </span>
                      </td>
                      {/* Item name */}
                      <td style={{ padding: "11px 12px", verticalAlign: "middle" }}>
                        <Link
                          href={`/inventory/${item.id}`}
                          data-testid={`link-item-name-${item.id}`}
                          style={{
                            fontSize: 12, fontWeight: 600, color: "#ffffff",
                            textDecoration: "none", display: "block",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#2ddb6f")}
                          onMouseLeave={e => (e.currentTarget.style.color = "#ffffff")}
                        >
                          {item.name}
                        </Link>
                      </td>
                      {/* Category */}
                      <td style={{ padding: "11px 12px", verticalAlign: "middle" }}>
                        <span style={{ fontSize: 11, color: "#2b3f2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                          {item.category?.name || "—"}
                        </span>
                      </td>
                      {/* Qty / Unit */}
                      <td style={{ padding: "11px 12px", verticalAlign: "middle", textAlign: "right" }}>
                        <span style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 16, fontWeight: 700,
                          color: getQtyColor(item.status),
                          tabularNums: true,
                        } as any}>
                          {item.quantityOnHand.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 10, color: "#2b3f2e", marginLeft: 4 }}>{item.unitOfMeasure}</span>
                      </td>
                      {/* Location */}
                      <td style={{ padding: "11px 12px", verticalAlign: "middle" }}>
                        <span style={{ fontSize: 11, color: "#2b3f2e", whiteSpace: "nowrap" }}>
                          {item.location?.name || "—"}
                        </span>
                      </td>
                      {/* Status */}
                      <td style={{ padding: "11px 12px", verticalAlign: "middle", textAlign: "center" }}>
                        <StatusChip status={item.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: count + pagination */}
          <div style={{
            padding: "10px 16px",
            borderTop: "1px solid #182019",
            display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          }}>
            <p style={{ fontSize: 11, color: "#2b3f2e", margin: 0 }}>
              {totalItems === 0
                ? "No items"
                : `Showing ${startItem}–${endItem} of ${totalItems} item${totalItems !== 1 ? "s" : ""}`}
            </p>

            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <PagBtn
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  testId="button-prev-page"
                >
                  <ChevronLeft style={{ width: 12, height: 12 }} /> Prev
                </PagBtn>

                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pn: number;
                  if      (totalPages <= 7)           pn = i + 1;
                  else if (safePage <= 4)              pn = i + 1 === 7 ? totalPages : i + 1;
                  else if (safePage >= totalPages - 3) pn = totalPages - 6 + i;
                  else {
                    const mid = [safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2];
                    pn = [1, ...mid, totalPages][i];
                  }
                  return (
                    <PagBtn
                      key={pn}
                      onClick={() => setPage(pn)}
                      active={safePage === pn}
                      testId={`button-page-${pn}`}
                    >{pn}</PagBtn>
                  );
                })}

                <PagBtn
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  testId="button-next-page"
                >
                  Next <ChevronRight style={{ width: 12, height: 12 }} />
                </PagBtn>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Pagination button ──────────────────────────────────────────────────────────
function PagBtn({
  children, onClick, disabled, active, testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      style={{
        height: 26, minWidth: 26, padding: "0 7px",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3,
        fontSize: 11, fontWeight: active ? 700 : 500,
        borderRadius: 5, cursor: disabled ? "not-allowed" : "pointer",
        background: active ? "#2ddb6f" : "#141e17",
        border: `1px solid ${active ? "#2ddb6f" : "#203023"}`,
        color: active ? "#07090a" : disabled ? "#2b3f2e" : "#527856",
        opacity: disabled ? 0.4 : 1,
        fontFamily: "'Barlow Condensed', sans-serif",
        transition: "all 0.1s",
        whiteSpace: "nowrap",
      }}
    >{children}</button>
  );
}
