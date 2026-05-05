# Threat Model

## Project Overview

VoltStock is a React + TypeScript progressive web app with an Express backend and PostgreSQL/Drizzle storage for inventory, suppliers, projects, workers, daily reports, reorder planning, and field material workflows. Users authenticate with a custom session-based login flow backed by the `users` table and role-based access control with four roles: `viewer`, `staff`, `manager`, and `admin`.

Production entry points are the Express server in `server/index.ts`, the main API surface in `server/routes.ts`, and the custom auth routes in `server/replit_integrations/auth/routes.ts`. In production, `NODE_ENV=production`; the Replit platform terminates TLS. Mockup sandboxes and dev-only Vite paths are out of scope unless production reachability is demonstrated.

## Assets

- **User accounts and sessions** — session cookies, user IDs, roles, approval status, and password hashes in `users` / `sessions`. Compromise enables impersonation and privilege abuse.
- **Inventory and procurement data** — item quantities, locations, pricing (`unitCost`), supplier mappings, reorder recommendations, and wire reel data. Exposure affects operations and purchasing.
- **Project and operations data** — projects, scope items, daily reports, movement drafts, material requests, and movement history. This includes job-site details and operational workflows.
- **Personnel data** — worker records, attendance, and evaluations. Exposure affects employee privacy and internal HR-sensitive information.
- **Uploaded content** — files under `uploads/` and image URLs stored in `item_images` / `item_groups`. These cross the browser/server/filesystem boundary.
- **Application secrets** — `SESSION_SECRET`, `DATABASE_URL`, and optional admin seed secrets. Loss compromises authentication or administrative bootstrap paths.

## Trust Boundaries

- **Browser to API** — every client request to `/api/*` crosses from an untrusted client to trusted server code. The frontend UI is not an authorization boundary.
- **Server to PostgreSQL** — `server/storage.ts` and auth storage have broad database access. Query scoping and authorization failures here expose or modify all tenant data.
- **Authenticated user to privileged role boundary** — `viewer`/`staff` users must not gain `manager`/`admin` capabilities or visibility by calling hidden endpoints directly.
- **Server to filesystem** — uploads are written to and served from `uploads/`; export paths also read from local files.
- **Server to external URL boundary** — export code may fetch externally hosted images. User-controlled URLs here can turn into server-side requests.
- **Production vs dev-only boundary** — `server/vite.ts`, build scripts, local seed helpers, and manual testing artifacts are normally out of scope unless reachable in production.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/replit_integrations/auth/routes.ts`, `server/storage.ts`
- **Highest-risk code areas:** RBAC middleware and route guards in `server/routes.ts`; upload/export logic in `server/routes.ts`; database access and object scoping in `server/storage.ts`
- **Public/authenticated/admin surfaces:** `/api/auth/*` is public; most `/api/*` is authenticated; `/api/admin/*` and manager workflows require server-side role enforcement
- **Dev-only areas usually ignored:** `server/vite.ts`, scripts under `script/` and `scripts/`, local seed/testing notes in `replit.md`, frontend-only rendering helpers unless they consume production-controlled data

## Threat Categories

### Spoofing

The application relies on session cookies and a custom login flow in `server/replit_integrations/auth/routes.ts`. Protected endpoints must require a valid active session and must not trust client-side route guards as proof of privilege. Administrative bootstrap helpers such as `/api/admin/seed-initial-admin` must stay disabled in production unless explicitly enabled and protected by strong secrets.

### Tampering

Inventory movements, drafts, reorder actions, worker records, daily reports, and material requests are all business-critical state transitions. The server must enforce ownership and role checks before allowing a user to confirm drafts, edit workflow objects, or change approval/status fields. Uploaded files and stored image URLs must be validated before being written or later consumed by exports.

### Information Disclosure

This app stores supplier contacts, project/job-site data, worker attendance and evaluations, inventory valuation, pricing, and operational reports. Read APIs must be scoped by role and ownership server-side; a logged-in low-privilege user must not be able to enumerate manager/admin data simply by calling hidden endpoints. Password hashes and secrets must never be returned to the client or exposed through exports and logs.

### Denial of Service

The server accepts JSON bodies up to 50 MB and supports file upload and export generation. Public/auth endpoints need rate limiting, and authenticated endpoints that trigger expensive exports, large queries, or remote fetches must not allow unbounded work from low-trust inputs.

### Elevation of Privilege

The main risk is broken access control between `viewer`/`staff` and `manager`/`admin`, plus content or URL handling that lets a less-privileged user execute code in a privileged user’s browser or force the server to access resources on its behalf. All manager/admin-only data and actions must be protected by backend RBAC, uploads must not become executable same-origin content, and user-controlled URLs must not become unrestricted server-side fetches.