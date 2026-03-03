# VoltStock – Electrical Inventory Management System

## Overview

VoltStock is a production-grade inventory management web application built for U.S. electrical contractors and electrical materials companies. It enables warehouse staff, field supervisors, and managers to track materials across locations and jobsites in real time.

**Core capabilities:**
- Real-time inventory tracking (stock levels, status, location balances)
- Inventory movements: receive, issue, return, adjust, transfer (with validation)
- Project/jobsite material tracking and usage summaries
- Supplier management with preferred vendor support and detail pages
- Reorder recommendations with priority levels (critical/high/medium/low)
- Dashboard with KPIs: total value, active SKUs, low stock, out of stock, pending reorders
- Reports: valuation by category, low-stock, by location, usage by project
- Authentication via Replit Auth (OpenID Connect)

The app is named **VoltStock** and targets a professional B2B SaaS aesthetic — premium, clean, and operational from day one.

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
- **Authentication middleware:** `isAuthenticated` on all protected routes
- **Session storage:** PostgreSQL-backed sessions via `connect-pg-simple`

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
