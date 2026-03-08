# VoltStock – Electrical Inventory Management System

## Overview

VoltStock is a production-grade inventory management web application designed for U.S. electrical contractors and material suppliers. Its primary purpose is to provide real-time tracking of electrical materials across various locations and jobsites, facilitating efficient inventory management for warehouse staff, field supervisors, and managers.

**Key Capabilities:**
- Real-time inventory tracking including stock levels, status, and location balances.
- Comprehensive inventory movement functionalities: receiving, issuing, returning, adjusting, and transferring materials with built-in validation.
- Project and jobsite specific material tracking with usage summaries.
- Supplier management, including preferred vendor designation and detailed supplier information.
- Automated reorder recommendations with priority levels (critical, high, medium, low).
- A dashboard displaying key performance indicators (KPIs) such such as total inventory value, active SKUs, low stock alerts, out-of-stock items, and pending reorders.
- Reporting features covering valuation by category, low-stock items, inventory by location, and project-specific material usage.
- Secure user authentication and authorization via Replit Auth (OpenID Connect) with role-based access control (admin, staff, viewer).
- Category management with family grouping, image overrides, and bulk actions.

The application is branded for TK Electric LLC, utilizing a professional green and white design system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Monorepo Structure
The project is organized as a monorepo, separating client-side (React), server-side (Express), and shared components.
-   **`client/`**: React frontend using Vite, Wouter for routing, TanStack React Query for data fetching, React Hook Form with Zod for forms, and shadcn/ui for UI components. Styling is managed with Tailwind CSS.
-   **`server/`**: Express.js backend handling API routes, data access via Drizzle ORM, and PostgreSQL database connection. Authentication uses Replit Auth with Passport.js.
-   **`shared/`**: Contains common definitions like Drizzle table schemas, Zod schemas, TypeScript types, and API route constants, ensuring consistency between frontend and backend.
-   **`migrations/`**: Drizzle-generated SQL migration scripts for database schema evolution.

### Frontend Architecture
-   **Framework & Libraries**: React 18 with TypeScript, Vite, Wouter for routing, TanStack React Query for state management, React Hook Form + Zod for form handling.
-   **UI/UX**: shadcn/ui components (built on Radix UI primitives and Tailwind CSS) are used for a consistent "new-york" style design. The application features a green-white brand theme (primary brand green: `#0A6B24`, accent green: `#08B028`) with custom CSS variables for scalability.
-   **Pages**: Key pages include Dashboard, Inventory, Transactions, Suppliers, Projects, Reorder, Reports, and Admin sections (User Approvals, Export). A dedicated "Field Mode" provides a simplified interface for on-site operations (Receive, Issue/Ship, Inventory, Transactions).
-   **Styling**: Tailwind CSS with custom properties for branding. Fonts used are Inter and Plus Jakarta Sans. Lucide React provides icons.
-   **PWA**: The application is configured as a Progressive Web App (PWA) with a manifest, service worker for caching, and icons for an installable experience.

### Backend Architecture
-   **Runtime & Framework**: Node.js with Express.js.
-   **API**: RESTful API design with all endpoints under `/api/`. Field-specific endpoints under `/api/field/`:
    -   `GET /api/field/families?categoryId=` — derived families with counts (e.g. EMT, Rigid, Flexible, Single Conductor, Multi Conductor)
    -   `GET /api/field/types?categoryId=&family=` — derived types within a family (e.g. Metal Flexible / Liquidtight Flexible; 2C+G / 3C+G / 4C+G; Horizontal Elbow / Vertical Elbow)
    -   `GET /api/field/subcategories?categoryId=&family=&type=` — derived subcategories (e.g. Set Screw / Compression; Conduit / Connector / Coupling; EMT / Rigid)
    -   `GET /api/field/sizes?categoryId=&family=&type=&subcategory=` — sorted size labels (conduit inch-based or cable AWG order)
    -   `GET /api/field/items?categoryId=&family=&type=&subcategory=&size=&status=&q=&page=&perPage=` — filtered + paginated items
    -   `POST /api/items/classify` — AI-powered auto-classification preview
-   **Auto-Classification** (`server/storage.ts` exported helpers + `shared/classifyItem.ts`):
    -   `derivedFamily()` — maps DB subcategory → display family. THHN/THWN Single → "Single Conductor"; Flex Conduit → "Flexible"; CS families in CS_FAMILY_ORDER
    -   `derivedType()` — maps DB fields → type. Flex Conduit → "Metal Flexible" / "Liquidtight Flexible" (from baseItemName); Multi Conductor → "2C+G"/"3C+G"/"4C+G" (from base_item_name pattern); CT Fittings dt=Elbow → "Horizontal Elbow", dt=Vertical → "Vertical Elbow"; CS sub=Conduit Support → One Hole Strap / Two Hole Strap / Unistrut Pipe Clamp
    -   `extractSubcategory()` — derives display subcategory (fallback). One Hole Strap / Two Hole Strap / Unistrut Pipe Clamp → EMT or Rigid (from baseItemName); Metal/Liquidtight Flexible → Conduit / Connector / Coupling; EMT Connector/Coupling → Set Screw / Compression / Rain Tight / Threaded / 90° / Straight / Standard; CS Strut Channel → Slotted/Solid, 2-Hole/4-Hole, Straight/Elbow/Tee Joiner
    -   **Stored `sub_type` column**: items now have a `subType` DB field (nullable). `getFieldSubcategories` and `getFieldItems` use it when set, falling back to `extractSubcategory()` for legacy items. Editable per-item in FamilyEditDialog Settings (Subcategory column). API: `GET /api/inventory/category/:id/classification-options` returns `{ subcategories, detailTypes, subTypes }` for autocomplete datalists. Filter order: **Category → Family → Type → Subcategory** (4 levels).
    -   `parseSizeLabelForSort()` — smart size sorting: conduit inches (1/2"=500, 3/4"=750…) or cable AWG (14→12→10→8→6→4→2→1→1/0→2/0→3/0→4/0→250→350 kcmil)
    -   Ordering constants: CT_FITTINGS_TYPE_ORDER, CF_FLEXIBLE_TYPE_ORDER, CF_SUBCAT_ORDER, CW_MULTI_CONDUCTOR_TYPE_ORDER, CS_SUPPORT_SUBCAT_ORDER, CF_FLEX_SUBCAT_ORDER
-   **Data Access**: A dedicated storage layer (`IStorage` interface) abstracts database interactions using Drizzle ORM.
-   **Authentication & Authorization**: Session-based authentication with PostgreSQL-backed sessions. Role-Based Access Control (RBAC) is implemented with `isAuthenticated`, `requireAdmin`, and `requireStaff` middleware to protect routes. New user sign-ups require admin approval.
-   **Database**: PostgreSQL is used as the primary database, managed by Drizzle ORM.
    -   **Core Tables**: `users`, `sessions`, `categories`, `locations`, `suppliers`, `projects`, `items`, `inventory_movements`, `inventory_location_balances`, `project_material_transactions`, `supplier_items`, `purchase_recommendations`, `item_images`.
    -   **Business Logic**: Item status (out_of_stock, low_stock, in_stock) is derived from `quantityOnHand` and `reorderPoint`. Movement types (`receive`, `issue`, `return`, `adjust`, `transfer`) are enforced with specific business rules and validations (e.g., stock validation for `issue` and `transfer`).

## External Dependencies

-   **Replit Auth**: Utilized as the OpenID Connect identity provider for user authentication. The `users` and `sessions` tables are managed by this integration.
-   **Google Fonts**: Inter and Plus Jakarta Sans fonts are loaded via CDN.
-   **Environment Variables**:
    -   `DATABASE_URL`: PostgreSQL connection string.
    -   `SESSION_SECRET`: Secret for Express session signing.
    -   `REPL_ID`: Replit deployment ID for OIDC client identification.
    -   `ISSUER_URL`: OIDC issuer URL (defaults to `https://replit.com/oidc`).
-   **Key npm Packages**:
    -   **Database/ORM**: `drizzle-orm`, `drizzle-kit`, `drizzle-zod`, `pg`, `connect-pg-simple`.
    -   **Authentication**: `express-session`, `passport`, `openid-client`, `bcryptjs`.
    -   **Frontend**: `@tanstack/react-query`, `wouter`, `react-hook-form`, `zod`, `@radix-ui/*`, `lucide-react`, `date-fns`, `tailwind-merge`, `clsx`.