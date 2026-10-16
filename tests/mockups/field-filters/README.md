# TK Electric · isolated field-filter iteration

## Scope / provenance

**Product constraint:** category imagery was deliberately added so staff can recognize materials visually. Preserve actual category/product imagery at any later integration; the representative drawings here are not a proposed replacement for those photographs. No real-app integration is approved by this mockup work.

Derived from the copied `baseline/FieldInventory.tsx.reference` and `baseline/fieldTokens.ts.reference` (left untouched). The supplied FieldHeader / i18n excerpts informed the TK header, three languages, and vocabulary. No real application modules are imported.

The extraction retains image-based category selection, a compact selected-category/change bar, family → brand → type → subcategory hierarchy, size pills, active chips, stock distinctions, image enlargement, and a persistent cart bar. It intentionally removes routing, API queries, auth, real requests, wire-reel data, pagination and persistence. All sample rows are displayed so the filtered count is exact.

**Design direction:** field-workbench layout / practical industrial TK. Deep-green `#0d1410`, `#1c2b1f`, `#162019` and light `#f6faf6` surfaces derive from the token snapshot. A muted sage action accent replaces the original bright green to respect the no-neon requirement. No glow, external assets, decorative gradients or network fonts. The existing Barlow Condensed / Bebas Neue font names are requested only if already available locally; offline Trebuchet/system fallbacks are intentional. Dialog entry uses only opacity/transform and respects reduced motion.

All category/product images are original, representative **SVG illustrations encoded as local data URLs**, explicitly labeled in Korean, English and Spanish. These are not original category photographs, real product photos, or verified product depictions. The DB-backed images are unavailable in this isolated context. `assets.logo` accepts the parent-supplied real TK logo data URL; without it, a TK ELECTRIC wordmark is shown, not an invented logo.

The browser harness additionally reads an already-existing local Nanum font from the Nix store and embeds it **only in memory** for Korean captures. No font installation, font configuration change, download or large font file is added. This avoids misleading Korean square-glyph screenshots. English/Spanish still use offline font fallbacks. Future environments without this local font must supply an approved local equivalent rather than silently accept missing Korean glyphs.

## Files / integration

- `FieldFilterMockup.tsx` — default React component, image fallbacks, accessible local dialogs.
- `styles.css` — scoped theme, workbench and responsive styles. Collect the esbuild CSS output.
- `data.ts` — exported `categories`, `items`, types, vocabulary and inline SVG generator.
- `translations.ts` — Korean / English / Spanish interface copy.
- `README.md` — this document.

Imports only React, lucide-react and these local files. No new config, packages, backend, servers, storage, API calls or external media. Parent owns bundling and Playwright `setContent`; no test execution or server startup was performed.

```tsx
<FieldFilterMockup
  initialLanguage="ko"
  initialTheme="dark"
  initialScenario="normal"
  assets={{ logo: suppliedLogoDataUrl }}
/>
```

Props:
- `initialLanguage?: 'ko' | 'en' | 'es'` (default `ko`)
- `initialTheme?: 'light' | 'dark'` (default `dark`, canonical field-mode identity)
- `initialScenario?: 'normal' | 'loading' | 'error' | 'empty' | 'missing-images' | 'broken-images' | 'long-names' | 'many-filters'`
- `assets?: { logo?: string }`

Initial props seed local state on mount. Language/theme changes preserve filters and cart. Scenario changes reset filters to empty (or the compatible many-filter preset), but keep the local cart. Reload/unmount discards everything.

## Interaction / fixture contract

Fixture identifiers are strings. `categories` has `id`, localized `name` (`ko/en/es`), and `image`. `items` has `id`, `sku`, localized `name`, `categoryId`, `family`, `brand`, `type`, `subcategory`, `size`, numeric `stock`, `unit`, `location`, and `image`. Values are deliberately simple; the fixture does not claim actual stock.

Useful path:
1. Click `category-conduit` → image grid collapses on every screen size, without auto-scroll.
2. Select `EMT` family, optionally `Allied` brand, then `Steel` type and `Galvanized` subcategory.
3. Choose direct `size-1/2"` → item `101` matches.
4. Item `104` is genuinely zero stock in the fixture; its add button is disabled, not an error.
5. The many-filter preset selects all eight condition keys and yields exactly item `101`.

Hierarchy changes clear all descendants in category → family → brand → type → subcategory → size order. Category changes therefore clear brand as well as family/type/subcategory/size. Stock and search survive hierarchy changes. Removing a parent chip uses the same resets. Family requires category; brand/type require family; subcategory requires type. Native controls avoid any external Select dependency. The family/type/subcategory next-step row stays in view after category collapse; no automatic scrolling is performed.

Common sizes are all shown directly and wrap, avoiding hidden common choices. Detailed panel duplicates the hierarchy controls for a complete context, and includes brand, size and stock. Changes apply immediately; closing is not canceling. Search is immediate and case-insensitive across three localized names, SKU, size, brand and hierarchy fixture values.

Required selectors:

| Area | Test IDs |
| --- | --- |
| Root | `mock-root` with `data-scenario`, `data-theme`, and `lang` |
| Preview | `scenario-select`, `language-select`, `theme-toggle` |
| Search | `search-input` |
| Categories | `category-panel`, `category-{id}`, `category-toggle` |
| Direct hierarchy | `family-controls`, `family-quick-filter`, `type-quick-filter`, `subcategory-quick-filter` |
| Detailed filters | `detail-filters-trigger`, `detail-filters-dialog`, `detail-filters-close` |
| Detailed native selects | `family-filter`, `brand-filter`, `type-filter`, `subcategory-filter`, `stock-filter`, `size-filter` |
| Direct sizes | `size-all`, `size-{value}` (raw size string, including inch quotes) |
| Active chips | `remove-category`, `remove-family`, `remove-brand`, `remove-type`, `remove-subcategory`, `remove-size`, `remove-stock`, `remove-search` |
| Reset/results | `reset-filters`, `results-count`, `result-row-{id}`, `add-cart-{id}` |
| States | `state-loading`, `state-error`, `state-empty`, `retry` |
| Image enlargement | `photo-{id}`, `image-lightbox`, `lightbox-close` |
| Cart | `cart-bar`, `cart-review-trigger`, `cart-review-dialog`, `cart-review-close` |
| Cart quantities | `cart-minus-{id}`, `cart-plus-{id}`, `cart-quantity-{id}`, `cart-remove-{id}` |

`category-toggle` appears after choosing a category and persists when expanding/collapsing. The expanded grid remains in the DOM with `hidden` when collapsed. `results-count` includes a numeric `data-count` when the data is known. Loading/error omit numeric counts rather than asserting zero stock. Do not sum cart units across FT and EA: the bar reports distinct material lines; review shows per-item quantities and units.

Use test-id lookup rather than CSS identifiers for size values containing `/` and `"`. Raw fixture strings are retained as select values in every language; displayed taxonomy labels translate where appropriate. Product names, interface labels, states and sample/no-save notices translate. SKU, brand, standard abbreviations, sizes and storage locations remain technical identifiers.

## States / accessibility / responsive behavior

- Normal: 18 synthetic records, six illustrated category tiles, every filter available.
- Loading: persistent skeleton state, accessible loading text; controls retained. Change scenario to leave loading.
- Error: distinct simulated load error, not out-of-stock. Retry switches to normal and restores data using the current conditions.
- Empty: zero records, separate empty-inventory explanation. Filters remain visible; changing scenario restores records.
- Missing images: explicitly absent sources (`null`), separate “No image” fallback.
- Broken images: invalid `data:image/png;base64,AA==` (never HTTP); actual `onError` triggers a distinct “Image failed” fallback. Categories and products both exercise this path.
- Long names: localized long suffixes wrap instead of truncating material names.
- Many filters: compatible eight-condition preset; each removable, plus reset all.

Photo buttons open a lightbox even for missing/broken images so the specific absence/failure explanation is accessible. Dialogs share a focus trap, Escape, close button, backdrop close, body scroll lock and trigger-focus restoration. Background content becomes `inert` while open. Detailed filter controls and result count update immediately. Cart add increases local quantity by one; review supports increment/decrement/remove/clear; quantities cannot exceed the sample stock. There is no submit/save action.

At <=850px, rows change to a readable material list with labeled size, stock/unit, location and full-width add action. At <=650px the hierarchy becomes single-column; categories remain a two-column picture grid. Desktop gets aligned comparison columns; the intermediate desktop layout removes only the location column. Fixed bottom cart padding reserves 132px plus normal content spacing.

## Limitations / verification

This is a standalone functional design mock, not a destructive integration or production inventory implementation. No live images, warehouse requests, stock reservations, item detail API, reel tracking, server-side search, persistence or submit are implemented. Missing original photos are not replaced by fabricated “real” photography. Parent-provided logo is the only external injection point and should be a local data URL.

No tests, screenshots, installs, network requests, database access, servers or workflows were run by this implementation. Parent should bundle and render with its existing offline harness, including the esbuild CSS output, and assess the 320px/mobile/tablet/desktop views.
