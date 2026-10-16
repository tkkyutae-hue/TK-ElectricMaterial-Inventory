import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Search, X, ChevronDown, ChevronUp, SlidersHorizontal, ShoppingCart, Plus, Minus,
  ImageOff, ZoomIn, AlertTriangle, Package, HardHat, Sun, Moon, Check, Info,
} from "lucide-react";
import { categories, items, vocabulary } from "./data";
import type { Item, Language } from "./data";
import { translations } from "./translations";
import "./styles.css";

export type Scenario = "normal" | "loading" | "error" | "empty" | "missing-images" | "broken-images" | "long-names" | "many-filters";
export type FieldFilterMockupProps = {
  initialLanguage?: Language;
  initialTheme?: "light" | "dark";
  initialScenario?: Scenario;
  assets?: { logo?: string };
};
type Filters = {
  category: string; family: string; brand: string; type: string;
  subcategory: string; size: string; stock: string; search: string;
};
type FilterKey = keyof Filters;
type Copy = typeof translations.en;
const blank: Filters = { category: "", family: "", brand: "", type: "", subcategory: "", size: "", stock: "", search: "" };
const many: Filters = {
  category: "conduit", family: "EMT", brand: "Allied", type: "Steel",
  subcategory: "Galvanized", size: '1/2"', stock: "in_stock", search: "EMT",
};
const invalidImage = "data:image/png;base64,AA==";
const filterKeys: FilterKey[] = ["category", "family", "brand", "type", "subcategory", "size", "stock", "search"];
const scenarios: Scenario[] = ["normal", "loading", "error", "empty", "missing-images", "broken-images", "long-names", "many-filters"];
const scenarioCopy: Record<Scenario, keyof Copy> = {
  normal: "normal", loading: "loadingScenario", error: "errorScenario", empty: "emptyLabel",
  "missing-images": "missingImages", "broken-images": "brokenImages", "long-names": "longNames", "many-filters": "manyFilters",
};
const statusOf = (item: Item) => item.stock === 0 ? "out_of_stock" : item.stock < 25 ? "low_stock" : "in_stock";
const unique = (list: Item[], key: "family" | "brand" | "type" | "subcategory" | "size") => Array.from(new Set(list.map(i => i[key])));

function SampleImage({ src, name, copy }: { src: string | null; name: string; copy: Copy }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  if (!src || broken) {
    return <div className="image-fallback" role="img" aria-label={`${name}: ${broken ? copy.broken : copy.missing}`}
      data-image-state={broken ? "broken" : "missing"}>
      {broken ? <AlertTriangle aria-hidden="true" /> : <ImageOff aria-hidden="true" />}
      <span>{broken ? copy.broken : copy.missing}</span>
    </div>;
  }
  return <img src={src} alt={`${name} — ${copy.photo}`} onError={() => setBroken(true)} />;
}

function Modal({ children, title, hint, closeLabel, closeTestId, testId, onClose, footer }: {
  children: React.ReactNode; title: string; hint?: string; closeLabel: string; closeTestId: string;
  testId: string; onClose: () => void; footer?: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const hintId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
    ) || []).filter(el => el.getClientRects().length > 0);
    (focusable()[0] || dialog)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key === "Tab") {
        const controls = focusable();
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); dialog?.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      // Parent removes inert during the same React commit; restore after that cleanup.
      queueMicrotask(() => { if (previousFocus?.isConnected) previousFocus.focus(); });
    };
  }, []);
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
      aria-describedby={hint ? hintId : undefined} data-testid={testId} ref={dialogRef} tabIndex={-1}>
      <div className="dialog-header">
        <div><h2 id={titleId}>{title}</h2>{hint && <p id={hintId}>{hint}</p>}</div>
        <button type="button" aria-label={closeLabel} data-testid={closeTestId} onClick={onClose}><X aria-hidden="true" /></button>
      </div>
      <div className="dialog-body">{children}</div>
      {footer && <div className="dialog-footer">{footer}</div>}
    </div>
  </div>;
}

function FieldFilterMockup({
  initialLanguage = "ko", initialTheme = "dark", initialScenario = "normal", assets,
}: FieldFilterMockupProps) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [theme, setTheme] = useState(initialTheme);
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [filters, setFilters] = useState<Filters>(() => initialScenario === "many-filters" ? { ...many } : { ...blank });
  const [collapsed, setCollapsed] = useState(initialScenario === "many-filters");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [modal, setModal] = useState<"filters" | "cart" | null>(null);
  const [photoItem, setPhotoItem] = useState<Item | null>(null);
  const [logoBroken, setLogoBroken] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const categoryHeadingRef = useRef<HTMLHeadingElement>(null);
  const categoryToggleRef = useRef<HTMLButtonElement>(null);
  const previousCategoryRef = useRef(filters.category);
  const isModalOpen = modal !== null || photoItem !== null;
  const t = translations[language];
  const label = (value: string) => vocabulary[value]?.[language] || value;
  const itemName = (item: Item) => item.name[language] + (scenario === "long-names" ? t.longSuffix : "");
  const unitName = (unit: string) => unit === "EA" ? t.each : t.feet;
  const imageSrc = (src: string | null) => scenario === "missing-images" ? null : scenario === "broken-images" ? invalidImage : src;
  useEffect(() => {
    const content = contentRef.current;
    if (isModalOpen) content?.setAttribute("inert", "");
    else content?.removeAttribute("inert");
    return () => { content?.removeAttribute("inert"); };
  }, [isModalOpen]);
  useEffect(() => { setLogoBroken(false); }, [assets?.logo]);
  useEffect(() => {
    if (previousCategoryRef.current !== filters.category && !isModalOpen) {
      if (filters.category && collapsed) categoryToggleRef.current?.focus({ preventScroll: true });
      else categoryHeadingRef.current?.focus({ preventScroll: true });
    }
    previousCategoryRef.current = filters.category;
  }, [filters.category, collapsed, isModalOpen]);

  const source = scenario === "empty" ? [] : items;
  const categoryItems = source.filter(i => !filters.category || i.categoryId === filters.category);
  const familyItems = categoryItems.filter(i => !filters.family || i.family === filters.family);
  const brandItems = familyItems.filter(i => !filters.brand || i.brand === filters.brand);
  const typeItems = brandItems.filter(i => !filters.type || i.type === filters.type);
  const subItems = typeItems.filter(i => !filters.subcategory || i.subcategory === filters.subcategory);
  const sizes = unique(subItems, "size");
  const results = useMemo(() => source.filter(item => {
    const query = filters.search.trim().toLocaleLowerCase();
    const searchable = [
      ...Object.values(item.name), item.sku, item.size, item.family, item.type, item.subcategory, item.brand,
    ].join(" ").toLocaleLowerCase();
    return (!filters.category || item.categoryId === filters.category)
      && (!filters.family || item.family === filters.family)
      && (!filters.brand || item.brand === filters.brand)
      && (!filters.type || item.type === filters.type)
      && (!filters.subcategory || item.subcategory === filters.subcategory)
      && (!filters.size || item.size === filters.size)
      && (!filters.stock || statusOf(item) === filters.stock)
      && (!query || searchable.includes(query));
  }), [source, filters]);
  const selectedCategory = categories.find(c => c.id === filters.category);
  const activeKeys = filterKeys.filter(key => filters[key] !== "");
  const cartItems = items.filter(item => cart[item.id] > 0);
  const countIsKnown = scenario !== "error" && scenario !== "loading";
  const resultText = countIsKnown ? `${results.length} ${t.results}` : scenario === "loading" ? t.loading : t.error;

  function changeFilter(key: FilterKey, value: string) {
    setFilters(previous => {
      const next = { ...previous, [key]: value };
      const chain: FilterKey[] = ["category", "family", "brand", "type", "subcategory", "size"];
      const index = chain.indexOf(key);
      if (index >= 0) chain.slice(index + 1).forEach(descendant => { next[descendant] = ""; });
      return next;
    });
    if (key === "category") setCollapsed(Boolean(value));
  }
  function resetFilters() { setFilters({ ...blank }); setCollapsed(false); }
  function changeScenario(next: Scenario) {
    setScenario(next); setFilters(next === "many-filters" ? { ...many } : { ...blank });
    setCollapsed(next === "many-filters");
  }
  function toggleCategories() {
    setCollapsed(current => !current);
    // Collapsing the image grid never scrolls past the next-step controls.
    // Focus stays on this persistent toggle.
  }
  function cartQuantity(item: Item, difference: number) {
    setCart(previous => {
      const next = { ...previous };
      const quantity = Math.max(0, Math.min(item.stock, (next[item.id] || 0) + difference));
      if (quantity === 0) delete next[item.id];
      else next[item.id] = quantity;
      return next;
    });
  }
  function removeCartItem(id: string) {
    setCart(previous => { const next = { ...previous }; delete next[id]; return next; });
  }
  function filterLabel(key: FilterKey) {
    if (key === "search") return t.search;
    return t[key];
  }
  function filterValue(key: FilterKey) {
    if (key === "category") return selectedCategory?.name[language] || "";
    if (key === "stock") return filters.stock === "in_stock" ? t.available : filters.stock === "low_stock" ? t.low : t.out;
    return label(filters[key]);
  }
  function selectField(key: "family" | "brand" | "type" | "subcategory" | "stock", detailed: boolean) {
    const choices: string[] = key === "family" ? unique(categoryItems, "family")
      : key === "brand" ? unique(familyItems, "brand")
      : key === "type" ? unique(brandItems, "type")
      : key === "subcategory" ? unique(typeItems, "subcategory")
      : ["in_stock", "low_stock", "out_of_stock"];
    const disabled = key === "family" ? !filters.category
      : key === "brand" || key === "type" ? !filters.family
      : key === "subcategory" ? !filters.type : false;
    const prompt = key === "family" ? t.chooseCategory : key === "brand" || key === "type" ? t.chooseFamily : t.chooseType;
    const step = key === "family" ? "1" : key === "type" ? "2" : "3";
    return <label className="field" key={`${detailed ? "detail" : "quick"}-${key}`}>
      <span>{!detailed && <b className="step" aria-hidden="true">{step}</b>}{t[key]}</span>
      <select data-testid={detailed ? `${key}-filter` : `${key}-quick-filter`} value={filters[key]}
        disabled={disabled} onChange={event => changeFilter(key, event.target.value)}>
        <option value="">{disabled ? prompt : t.all}</option>
        {choices.map(value => <option key={value} value={value}>
          {key === "stock" ? value === "in_stock" ? t.available : value === "low_stock" ? t.low : t.out : label(value)}
        </option>)}
      </select>
    </label>;
  }
  const resetButton = (testId?: string) => <button type="button" className="text-button"
    data-testid={testId} onClick={resetFilters}>{t.reset}</button>;

  return <div className="tk-field" data-theme={theme} data-testid="mock-root" data-scenario={scenario} lang={language}>
    <div ref={contentRef}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            {assets?.logo && !logoBroken && <img src={assets.logo} alt="TK Electric" onError={() => setLogoBroken(true)} />}
            <div><strong>TK ELECTRIC</strong><small><HardHat aria-hidden="true" />{t.mode}</small></div>
          </div>
          <div className="header-controls">
            <button type="button" data-testid="theme-toggle" aria-label={`${t.theme}: ${theme === "dark" ? t.dark : t.light}`}
              aria-pressed={theme === "dark"} onClick={() => setTheme(current => current === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
              <span className="theme-text">{theme === "dark" ? t.dark : t.light}</span>
            </button>
            <select aria-label={t.language} data-testid="language-select" value={language} onChange={e => setLanguage(e.target.value as Language)}>
              <option value="ko">한국어</option><option value="en">English</option><option value="es">Español</option>
            </select>
          </div>
        </div>
      </header>
      <main>
        <div className="page-intro">
          <div><div className="eyebrow">TK / {t.mode}</div><h1>{t.inventory}</h1><p>{t.subtitle}</p></div>
          <div className="demo-label">{t.demo}</div>
        </div>
        <div className="searchbox" role="search">
          <Search aria-hidden="true" />
          <input type="search" data-testid="search-input" aria-label={t.search}
            placeholder={t.searchPlaceholder} value={filters.search} onChange={e => changeFilter("search", e.target.value)} />
          {filters.search && <button type="button" onClick={() => changeFilter("search", "")} aria-label={t.clearSearch}><X aria-hidden="true" /></button>}
        </div>

        <section data-testid="category-panel" aria-labelledby="tk-category-heading">
          <div className="section-heading">
            <h2 id="tk-category-heading" ref={categoryHeadingRef} tabIndex={-1}>{t.browse}</h2>
            {!selectedCategory && <small>{categories.length} {t.category}</small>}
          </div>
          {selectedCategory && <div className="selected-category">
            <div className="category-art"><SampleImage key={`${scenario}-${selectedCategory.id}`}
              src={imageSrc(selectedCategory.image)} name={selectedCategory.name[language]} copy={t} /></div>
            <div className="selection-copy"><strong>{selectedCategory.name[language]}</strong>
              <small>{categoryItems.length} {t.results}</small></div>
            <button type="button" data-testid="category-toggle" ref={categoryToggleRef} onClick={toggleCategories}
              aria-expanded={!collapsed} aria-controls="tk-category-grid">
              {collapsed ? t.change : t.collapse}{collapsed ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
            </button>
          </div>}
          <div id="tk-category-grid" hidden={Boolean(selectedCategory && collapsed)}>
            <div className="categories" style={selectedCategory ? { marginTop: 12 } : undefined}>
              {categories.map(category => <button type="button" className="category"
                key={category.id} data-testid={`category-${category.id}`}
                aria-pressed={filters.category === category.id}
                onClick={() => changeFilter("category", category.id === filters.category ? "" : category.id)}>
                <div className="category-art"><SampleImage key={`${scenario}-${category.id}`}
                  src={imageSrc(category.image)} name={category.name[language]} copy={t} /></div>
                <div className="category-copy"><strong>{category.name[language]}</strong>
                  <small>{source.filter(item => item.categoryId === category.id).length} {t.results}</small></div>
              </button>)}
            </div>
          </div>
          <p className="sample-note"><Info aria-hidden="true" />{t.sample}</p>
        </section>

        <section className="filter-panel" aria-label={t.detail}>
          <div className="hierarchy" data-testid="family-controls">
            {selectField("family", false)}
            {selectField("type", false)}
            {selectField("subcategory", false)}
          </div>
          <div className="quick-filters">
            <div><p className="size-title">{t.commonSizes}</p>
              <div className="sizes" role="group" aria-label={t.commonSizes}>
                <button type="button" data-testid="size-all" aria-pressed={!filters.size} onClick={() => changeFilter("size", "")}>{t.all}</button>
                {sizes.map(size => <button type="button" key={size} data-testid={`size-${size}`}
                  aria-pressed={filters.size === size} onClick={() => changeFilter("size", filters.size === size ? "" : size)}>{size}</button>)}
              </div>
            </div>
            <button type="button" className="detail-trigger" data-testid="detail-filters-trigger"
              aria-haspopup="dialog" onClick={() => setModal("filters")}>
              <SlidersHorizontal aria-hidden="true" />{t.detail}{activeKeys.filter(k => !["search", "category", "size"].includes(k)).length > 0
                && <span>({activeKeys.filter(k => !["search", "category", "size"].includes(k)).length})</span>}
            </button>
          </div>
          <div className="conditions" role="group" aria-label={t.active}>
            {activeKeys.length === 0 ? <small>{t.noFilters}</small> : activeKeys.map(key => <button
              type="button" className="chip" key={key} data-testid={`remove-${key}`}
              aria-label={`${t.remove}: ${filterLabel(key)} ${filterValue(key)}`}
              onClick={() => changeFilter(key, "")}>
              <span>{filterLabel(key)}: {filterValue(key)}</span><X aria-hidden="true" />
            </button>)}
            {resetButton("reset-filters")}
          </div>
        </section>

        <div className="results-heading">
          <h2>{t.matching}</h2>
          <strong data-testid="results-count" role="status" aria-live="polite"
            data-count={countIsKnown ? results.length : undefined}>{resultText}</strong>
        </div>
        {scenario === "loading" ? <div data-testid="state-loading" role="status" aria-label={t.loading} aria-busy="true">
          <p className="muted">{t.loading}</p>{[1, 2, 3, 4].map(i => <div key={i} className="skeleton" aria-hidden="true" />)}
        </div> : scenario === "error" ? <div data-testid="state-error" className="state-panel error-state" role="alert">
          <AlertTriangle aria-hidden="true" /><h2>{t.error}</h2><p>{t.errorHint}</p>
          <button type="button" className="primary" data-testid="retry" onClick={() => setScenario("normal")}>{t.retry}</button>
        </div> : results.length === 0 ? <div data-testid="state-empty" className="state-panel" role="status">
          <Package aria-hidden="true" /><h2>{scenario === "empty" ? t.emptyScenario : t.empty}</h2>
          <p>{scenario === "empty" ? t.emptyScenarioHint : t.emptyHint}</p>
          {scenario !== "empty" && resetButton()}
        </div> : <div className="result-table" role="table" aria-label={t.inventory}>
          <div className="table-head" role="row">
            <span role="columnheader">{t.item}</span><span role="columnheader">{t.size}</span>
            <span role="columnheader">{t.stock} / {t.units}</span><span role="columnheader" className="location-head">{t.location}</span>
            <span role="columnheader">{t.cart}</span>
          </div>
          {results.map(item => <div key={item.id} className="result-row" role="row" data-testid={`result-row-${item.id}`}>
            <div className="material-cell" role="cell">
              <button type="button" className="photo" aria-label={`${t.enlarge}: ${itemName(item)}`}
                data-testid={`photo-${item.id}`} onClick={() => setPhotoItem(item)}>
                <SampleImage key={`${scenario}-${item.id}`} src={imageSrc(item.image)} name={item.name[language]} copy={t} />
              </button>
              <div className="item-copy"><strong>{itemName(item)}</strong><small>{item.sku} · {item.brand}</small></div>
            </div>
            <div className="size-cell" role="cell"><span className="mobile-label">{t.size}</span>{item.size}</div>
            <div className={`stock-cell ${item.stock === 0 ? "out" : item.stock < 25 ? "low" : ""}`} role="cell">
              <span className="stock-number">{item.stock.toLocaleString(language)} <small>{unitName(item.unit)}</small></span>
              <span className="stock-status">{item.stock === 0 ? t.out : item.stock < 25 ? t.low : t.available}</span>
            </div>
            <div className="location-cell" role="cell"><span className="mobile-label">{t.location}</span>{item.location}</div>
            <div role="cell" className="add-button">
              <button type="button" className="add-button" data-testid={`add-cart-${item.id}`}
                disabled={item.stock === 0 || (cart[item.id] || 0) >= item.stock}
                aria-label={`${t.add}: ${itemName(item)}`} onClick={() => cartQuantity(item, 1)}>
                {cart[item.id] ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                {cart[item.id] ? `${t.added} ${cart[item.id]}` : t.add}
              </button>
            </div>
          </div>)}
        </div>}
        <div className="demo-controls">
          <small>{t.preview}</small>
          <label>{t.scenario}
            <select data-testid="scenario-select" value={scenario} onChange={e => changeScenario(e.target.value as Scenario)}>
              {scenarios.map(state => <option value={state} key={state}>{t[scenarioCopy[state]]}</option>)}
            </select>
          </label>
        </div>
      </main>
      <footer className="cart-bar" data-testid="cart-bar">
        <div className="cart-inner">
          <div className="cart-summary"><ShoppingCart aria-hidden="true" /><div>
            <strong aria-live="polite">{t.cart} · {cartItems.length} {t.lines}</strong><small>{t.localOnly}</small>
          </div></div>
          <button type="button" className="primary" data-testid="cart-review-trigger" onClick={() => setModal("cart")}>
            {t.review}<ChevronUp aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>

    {modal === "filters" && <Modal title={t.detail} hint={t.detailHint} closeLabel={t.close}
      testId="detail-filters-dialog" closeTestId="detail-filters-close" onClose={() => setModal(null)}
      footer={<>{resetButton()}<button type="button" className="primary" onClick={() => setModal(null)}>{t.done} · {resultText}</button></>}>
      <div className="detail-grid">{selectField("family", true)}{selectField("brand", true)}{selectField("type", true)}
        {selectField("subcategory", true)}
        <label className="field"><span>{t.size}</span><select value={filters.size} data-testid="size-filter"
          onChange={e => changeFilter("size", e.target.value)}>
          <option value="">{t.all}</option>{sizes.map(size => <option key={size} value={size}>{size}</option>)}
        </select></label>
        {selectField("stock", true)}
      </div>
      <p className="sample-note" style={{ marginTop: 20 }}>{t.demo}</p>
    </Modal>}

    {photoItem && <Modal title={itemName(photoItem)} hint={`${photoItem.sku} · ${t.sample}`} closeLabel={t.close}
      testId="image-lightbox" closeTestId="lightbox-close" onClose={() => setPhotoItem(null)}>
      {imageSrc(photoItem.image) === null
        ? <div className="state-panel"><ImageOff aria-hidden="true" /><h3>{t.missing}</h3><p>{t.missingHint}</p></div>
        : <div className="lightbox-art">
          <EnlargedSample src={imageSrc(photoItem.image)!} name={photoItem.name[language]} copy={t} />
        </div>}
      <p className="sample-note"><ZoomIn aria-hidden="true" />{t.sample}</p>
    </Modal>}

    {modal === "cart" && <Modal title={`${t.cart} · ${cartItems.length}`} hint={t.demo} closeLabel={t.close}
      testId="cart-review-dialog" closeTestId="cart-review-close" onClose={() => setModal(null)}
      footer={<><button type="button" className="text-button" disabled={!cartItems.length} onClick={() => setCart({})}>{t.clearCart}</button>
        <button type="button" className="primary" onClick={() => setModal(null)}>{t.done}</button></>}>
      {cartItems.length === 0 ? <div className="state-panel"><ShoppingCart aria-hidden="true" />
        <h3>{t.cartEmpty}</h3><p>{t.cartHint}</p></div> : cartItems.map(item => <div className="cart-item" key={item.id}>
        <strong>{itemName(item)}</strong><small>{item.size} · {item.sku} · {unitName(item.unit)}</small>
        <div className="quantity-controls" role="group" aria-label={`${t.quantity}: ${item.name[language]}`}>
          <button type="button" data-testid={`cart-minus-${item.id}`} aria-label={t.decrease} onClick={() => cartQuantity(item, -1)}><Minus aria-hidden="true" /></button>
          <output aria-live="polite" data-testid={`cart-quantity-${item.id}`}>{cart[item.id]}</output>
          <button type="button" data-testid={`cart-plus-${item.id}`} aria-label={t.increase} disabled={cart[item.id] >= item.stock}
            onClick={() => cartQuantity(item, 1)}><Plus aria-hidden="true" /></button>
          <button type="button" className="text-button" data-testid={`cart-remove-${item.id}`} onClick={() => removeCartItem(item.id)}>{t.remove}</button>
        </div>
      </div>)}
    </Modal>}
  </div>;
}

function EnlargedSample({ src, name, copy }: { src: string; name: string; copy: Copy }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="state-panel"><AlertTriangle aria-hidden="true" /><h3>{copy.broken}</h3><p>{copy.brokenHint}</p></div>;
  return <img className="enlarged-image" src={src} alt={`${name} — ${copy.photo}`} onError={() => setFailed(true)} />;
}

export default FieldFilterMockup;
