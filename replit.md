# VoltStock – Electrical Inventory Management System

## Overview

VoltStock is a production-grade inventory management web application built for U.S. electrical contractors and electrical materials companies. It enables warehouse staff, field supervisors, and managers to track materials across locations and jobsites in real time.

**Core capabilities:**
- Real-time inventory tracking (stock levels, status, location balances)
- Inventory movements: receive, issue, return, adjust, transfer (with validation)
  - Receive → sourceLocationId ("Receive From" = supplier); Issue → destinationLocationId ("Issue To" = jobsite); Return → sourceLocationId ("Return From"); Transfer affects internal location balances
- Project/jobsite material tracking and usage summaries
- Supplier management with preferred vendor support and detail pages
- Reorder recommendations with priority levels (critical/high/medium/low)
- Dashboard with KPIs: total value, active SKUs, low stock, out of stock, pending reorders
- Reports: valuation by category, low-stock, by location, usage by project
- Authentication via Replit Auth (OpenID Connect)
- Category detail page: family grouping with edit dialog (rename family, update image, move items, bulk soft-delete)
- `itemGroups` table: stores family-level representative image overrides per category

The app is named **VoltStock** and is branded for **TK Electric LLC** with a professional green-white design system.

### Brand & Theme
- **Company**: TK Electric LLC — logo at `public/brand/tk-electric-logo.png` (transparent PNG) and imported via `@assets/tk_logo_1772726610288.png`
- **Primary brand green**: `#0A6B24` (deep) / `#08B028` (accent)
- **Page background**: `hsl(132 40% 97%)` — subtle green tint (`--background`)
- **Brand scale in tailwind**: `brand-50` through `brand-900` (via CSS vars in index.css)
- **Primary buttons**: `bg-brand-700 hover:bg-brand-800`
- **Active nav**: `bg-brand-100 text-brand-700`
- **Status badge colors**: in_stock=emerald, low_stock=amber, out_of_stock=rose, ordered=sky
- **Transaction badge colors**: receive=emerald, issue=violet, return=sky, adjust=amber, transfer=slate
- **Chart gradient**: green (`#08B028` fill, `#0A6B24` stroke)

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Full-Stack Monorepo Layout

```
/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── components/   # Reusable UI: AppLayout, MovementForm, StatusBadge, shadcn/ui
│       ├── hooks/        # React Query data-fetching hooks
│       ├── lib/          # Utilities, queryClient
│       └── pages/        # Page-level route components
├── server/          # Express backend
│   ├── routes.ts    # All API route handlers
│   ├── storage.ts   # Data access layer (Drizzle ORM, IStorage interface)
│   ├── db.ts        # PostgreSQL connection
│   └── replit_integrations/auth/  # Replit Auth (OIDC + Passport)
├── shared/          # Shared types, schema, route constants
│   ├── schema.ts    # Drizzle table definitions + Zod schemas + TypeScript types
│   ├── models/auth.ts   # Users + sessions tables
│   └── routes.ts    # API path constants (api.X.Y.path) used frontend + backend
└── migrations/      # Drizzle-generated SQL migrations
```

### Frontend Pages & Routes

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | KPI stat cards, recent activity feed, stock alerts |
| `/inventory` | Inventory | Searchable/filterable item catalog table |
| `/inventory/:id` | ItemDetails | Item detail with movement history |
| `/transactions` | Transactions | Full movement log with type/project filters |
| `/suppliers` | Suppliers | Supplier card grid with create form |
| `/suppliers/:id` | SupplierDetail | Supplier info + linked items table |
| `/projects` | Projects | Project card grid with status filter + create form |
| `/projects/:id` | ProjectDetail | Project detail with tabs (history, usage summary) |
| `/reorder` | Reorder | Auto-generated purchase recommendations |
| `/reports` | Reports | 4-tab analytics: Valuation, Low Stock, By Location, By Project |

### Frontend Architecture

- **Framework:** React 18 with TypeScript
- **Build tool:** Vite with `@vitejs/plugin-react`
- **Routing:** Wouter (lightweight, replaces React Router)
- **State/data fetching:** TanStack React Query v5 — all server state managed via custom hooks in `/hooks/`
- **Forms:** React Hook Form + Zod resolvers
- **UI components:** shadcn/ui (Radix UI primitives + Tailwind CSS), "new-york" style
- **Styling:** Tailwind CSS with CSS custom properties for theming; fonts: Inter (body), Plus Jakarta Sans (display/headings)
- **Icons:** Lucide React

**Key hooks:**
- `use-items.ts` — `useItems`, `useItem`, `useCreateItem`, `useUpdateItem`, `useDeleteItem`
- `use-transactions.ts` — `useMovements`, `useCreateMovement`, `useTransactions` (alias)
- `use-reference-data.ts` — `useCategories`, `useLocations`, `useSuppliers`, `useSupplier`, `useCreateSupplier`, `useUpdateSupplier`, `useProjects`, `useProject`, `useCreateProject`, `useUpdateProject`
- `use-dashboard.ts` — `useDashboardStats`

**Key components:**
- `MovementForm` — Reusable form for all 5 movement types with dynamic field visibility
- `ItemStatusBadge` / `TransactionTypeBadge` — Colored badges from `@/components/StatusBadge`
- `AppLayout` — Sidebar (grouped nav) + header wrapper

### Backend Architecture

- **Runtime:** Node.js with `tsx` for TypeScript in dev; esbuild bundle for production
- **Framework:** Express.js
- **API style:** REST, all routes under `/api/`
- **Data access:** Storage layer behind `IStorage` interface in `server/storage.ts` — all DB through this
- **Authentication middleware:** `isAuthenticated` on all protected routes; `requireAdmin` / `requireStaff` RBAC middleware
- **Session storage:** PostgreSQL-backed sessions via `connect-pg-simple`

### Authentication System

- **Strategy:** Email + password (bcryptjs), session-based
- **Users table:** `users` in `shared/models/auth.ts` — fields: id, email, passwordHash, name, role (admin/staff/viewer), status (pending/active/rejected), lastLoginAt
- **Roles:** `admin` (full access), `staff` (moderate access), `viewer` (read-only, default for new signups)
- **Approval workflow:** New users sign up with status=pending; admin must approve via User Approvals page
- **Initial admin:** `michael_kim@tkelectricllc.us` — seeded via `POST /api/admin/seed-initial-admin` with ADMIN_SEED_TOKEN
- **Auth routes:** in `server/replit_integrations/auth/routes.ts` — login, signup, logout, seed-initial-admin
- **Admin routes:** `GET /api/admin/users`, `PATCH /api/admin/users/:id`, `POST /api/admin/users/:id/approve`, `POST /api/admin/users/:id/reject`
- **Frontend guard:** `AdminGuard` in `client/src/App.tsx` — redirects non-admin users to `/home`
- **Home mode selector:** `/home` page lets users choose Field Mode (`/field/movement`) or Admin Mode (`/`) based on role

### PWA Configuration

- **Manifest:** `client/public/manifest.json` — name "VoltStock — TK Electric", display: standalone, theme: #0A6B24
- **Icons:** `icon-192.png` (192×192), `icon-512.png` (512×512), `apple-touch-icon.png` (180×180) in `client/public/`
- **Service worker:** `client/public/sw.js` — Cache-First for static assets, Network-First for API + HTML
- **Registration:** `client/src/main.tsx` — `navigator.serviceWorker.register('/sw.js')`
- **iOS support:** apple-mobile-web-app-capable meta tag in `client/index.html`

### Routing Architecture (Wouter v3 Notes)

- **IMPORTANT:** In wouter v3 with `regexparam`, `/:rest*` only matches single-segment paths (e.g., `/home`) — it does NOT match `/` or multi-segment paths like `/admin/users`
- **Correct catch-all:** Use empty `<Route component={AdminRouter} />` (no path) as the last route in a Switch
- **Outer Switch:** login → signup → /home → /field/:rest* → /field → [catch-all AdminRouter]
- **Inner admin Switch:** uses absolute paths e.g. `<Route path="/admin/users" component={UserApprovals} />`

### API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard/stats` | Dashboard KPI stats + recent activity |
| GET | `/api/categories` | All categories |
| GET | `/api/locations` | All active locations |
| GET | `/api/suppliers` | All suppliers |
| GET | `/api/suppliers/:id` | Supplier detail with item stats |
| POST | `/api/suppliers` | Create supplier |
| PUT | `/api/suppliers/:id` | Update supplier |
| GET | `/api/projects` | All projects |
| GET | `/api/projects/:id` | Project detail with movement history |
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/:id` | Update project |
| GET | `/api/items` | Items (filterable: search, categoryId, locationId, status) |
| GET | `/api/items/:id` | Item detail with movements |
| POST | `/api/items` | Create item |
| PUT | `/api/items/:id` | Update item |
| DELETE | `/api/items/:id` | Soft-delete item |
| GET | `/api/movements` | Movement history (filterable) |
| POST | `/api/movements` | Log any movement type |
| POST | `/api/movements/receive\|issue\|return\|adjust\|transfer` | Typed endpoints |
| GET | `/api/location-balances` | Per-location stock levels |
| GET | `/api/reorder/recommendations` | Pending purchase recommendations |
| POST | `/api/reorder/generate` | Generate fresh recommendations |
| PUT | `/api/reorder/recommendations/:id/status` | Mark ordered/dismissed |
| GET | `/api/reports/low-stock` | Out-of-stock and below-reorder items |
| GET | `/api/reports/by-location` | Stock levels grouped by location |
| GET | `/api/reports/valuation` | Inventory value by category |
| GET | `/api/reports/usage-by-project` | Material usage grouped by project |

### Database

- **Database:** PostgreSQL (via `DATABASE_URL` environment variable)
- **ORM:** Drizzle ORM with `drizzle-orm/node-postgres`
- **Schema defined in:** `shared/schema.ts` (inventory tables) and `shared/models/auth.ts`
- **Schema sync:** `npm run db:push`

**Core tables:**
| Table | Purpose |
|---|---|
| `users` | Replit Auth user records |
| `sessions` | PostgreSQL session store |
| `categories` | Item categories (conduit, wire, breakers, etc.) |
| `locations` | Warehouse bins, trucks, jobsite storage |
| `suppliers` | Vendor records with contact info, lead times, preferred status |
| `projects` | Jobsite records with customer, address, status, dates |
| `items` | Inventory SKUs: quantity, cost, reorder thresholds, supplier, location |
| `inventory_movements` | Full audit log of all stock changes with business logic applied |
| `inventory_location_balances` | Per-location quantity tracking (maintained by movement triggers) |
| `project_material_transactions` | Project-level usage tracking (issue/return) |
| `supplier_items` | Many-to-many: items ↔ suppliers |
| `purchase_recommendations` | Auto-generated reorder suggestions with priority levels |
| `item_images` | Optional item photos |

**Item status logic (derived):**
- `out_of_stock` — quantityOnHand === 0
- `low_stock` — 0 < quantityOnHand ≤ reorderPoint
- `in_stock` — quantityOnHand > reorderPoint

**Movement business rules:**
- `receive` / `return` — increase quantity
- `issue` — decrease quantity (validates sufficient stock before proceeding)
- `transfer` — moves quantity between locations (total unchanged, validates source stock)
- `adjust` — sets absolute quantity (cycle count correction)

**Seed data (pre-loaded):**
- 9 categories, 5 locations, 5 suppliers, 37 items, 6 projects, 5 seed movements

### Authentication & Authorization

- **Provider:** Replit Auth via OpenID Connect (OIDC)
- **Library:** `openid-client` + Passport.js strategy
- **Session:** PostgreSQL-backed, 7-day TTL, secure/httpOnly cookies
- **Flow:** `/api/login` → Replit OIDC → callback → upsert user → session
- **Protection:** All `/api/*` routes (except `/api/login`, `/api/logout`, `/api/auth/callback`) require `isAuthenticated`
- **Frontend auth state:** `useAuth()` hook that calls `/api/auth/user`; unauthenticated users see a sign-in landing screen

---

## External Dependencies

### Required Environment Variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing secret |
| `REPL_ID` | Replit deployment ID (used for OIDC client ID) |
| `ISSUER_URL` | OIDC issuer (defaults to `https://replit.com/oidc`) |

### Third-Party Services
- **Replit Auth** — OpenID Connect identity provider. The `sessions` and `users` tables in `shared/models/auth.ts` are mandatory and must not be dropped.
- **Google Fonts** — Inter + Plus Jakarta Sans loaded via CDN in `client/index.html`

### Key npm Dependencies
| Package | Role |
|---|---|
| `drizzle-orm` + `drizzle-kit` | ORM + schema migrations |
| `drizzle-zod` | Auto-generates Zod schemas from Drizzle tables |
| `pg` + `connect-pg-simple` | PostgreSQL driver + session store |
| `express-session` + `passport` | Session management + auth strategies |
| `openid-client` | OIDC authentication |
| `@tanstack/react-query` | Server state management |
| `wouter` | Client-side routing |
| `react-hook-form` + `zod` | Form validation |
| `@radix-ui/*` | Accessible UI primitives (via shadcn/ui) |
| `lucide-react` | Icon set |
| `date-fns` | Date formatting |
| `tailwind-merge` + `clsx` | Conditional class merging |
