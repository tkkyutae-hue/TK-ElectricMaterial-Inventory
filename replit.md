# VoltStock - Premium B2B SaaS PWA Inventory System

**Project Goal:** Build inventory management system for TK Electric (electrical contractor) with role-based auth, Field Mode (dark), Admin Mode (light), dashboard, inventory, suppliers, projects, reorder, reports.

## Global Language Switcher (March 11, 2026)

### Feature: Multilingual UI (EN / 한국어 / ES)

**System:**
- `client/src/lib/i18n.ts` — full translation dictionaries (EN, KO, ES) with 70+ keys
- `client/src/hooks/use-language.tsx` — `LanguageContext`, `LanguageProvider`, `useLanguage()` hook, and shared `LanguageSwitcher` component
- Language persists in `localStorage` under key `voltstock_lang`

**Locations with switcher:**
- Login screen (top-right, dark theme)
- Mode Select / Home screen (header right, dark theme)
- Field Mode header (right area, dark theme)
- Admin Mode header (right area, light theme)

**Behavior:**
- One shared global language state — changing it anywhere updates the entire app instantly
- Persists across page changes, mode switches, refreshes, and future visits
- Only translates UI text (labels, buttons, menus, headers, chips) — never data content

**Files modified:** `App.tsx`, `Login.tsx`, `Home.tsx`, `FieldLayout.tsx`, `AppLayout.tsx`, `FieldHome.tsx`

## Recent Fixes (March 11, 2026)

### 1. Quantity Synchronization Fix
**Problem:** Item detail page and inventory list showed different quantities for reel-tracked items (FT items).

**Solution:** 
- Added server-side helper `liveReelQtyMap()` to compute actual quantities from active reels in real-time
- Applied live quantity calculation to all 4 endpoints:
  - `getItems()` - Admin inventory list
  - `getItem()` - Item detail page  
  - `getCategoryGrouped()` - Category grouped view
  - `getFieldItems()` - Field mode inventory
- Synced DB: Updated 4 drifted items (CABLE-023G, CABLE-063G, CABLE-043G, WIRE-04) to match reel totals
- Fixed cache invalidation in ItemDetails: Changed invalid query key pattern from `/api/items/:id` to `/api/items`

**Result:** All quantity displays (detail, list, category totals) stay perfectly synchronized. Source of truth = active reel sums.

### 2. Back-Navigation Refresh Bug Fix
**Problem:** After saving changes on item detail page, clicking Back to inventory list showed stale cached data.

**Solution:**
- Added `useEffect` cleanup in ItemDetails component
- On component unmount, invalidates the `/api/inventory` cache
- Forces fresh data fetch when user returns to the list

**Result:** Inventory list always shows current data when navigating back from detail page - no manual refresh needed.

## Architecture

### Frontend Stack
- React + TypeScript
- TanStack Query v5 for data fetching and caching
- wouter for routing
- Shadcn UI components
- Tailwind CSS (light theme for Admin, dark theme for Field)

### Backend Stack
- Express.js
- PostgreSQL with Drizzle ORM
- Session-based auth (SESSION_SECRET env var)
- Replit Auth integration

### Database
- PostgreSQL available via DATABASE_URL
- Supports reel tracking for FT items
- Inventory movements tracked

### Key Features
- **Role-based Access:** admin, staff, field
- **Field Mode:** Dark-themed mobile inventory interface
- **Admin Mode:** Light-themed desktop management dashboard
- **Reel Tracking:** Sequential R-{n} IDs for wire/cable FT items
- **Inventory Management:** Qty on hand (live from reels for FT items), minimum stock, reorder points
- **Suppliers & Projects:** Full CRUD
- **Transactions & Reports:** Movement tracking

## Testing
- Manual testing only (automated testing disabled in fast mode)
- Login: michael_kim@tkelectricllc.us / tk69956995!! (admin role)

## Recent DB Changes
- CABLE-023G: 1315 FT (from 13150) ✓
- CABLE-063G: 1024 FT (from 10240) ✓
- CABLE-043G: 546 FT (from 5460) ✓
- WIRE-04: 1813 FT (from 18130) ✓

## Deployment
Ready for publishing when user requests.
