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
    -   `GET /api/field/families?category=` — returns families (subcategories) with item counts for a category
    -   `GET /api/field/sizes?category=&family=` — returns sorted unique size labels for scope
    -   `GET /api/field/items?category=&family=&size=&status=&q=&page=&perPage=` — server-side filtered + paginated field inventory
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