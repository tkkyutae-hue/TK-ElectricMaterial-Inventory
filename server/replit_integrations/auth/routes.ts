import type { Express } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { pool } from "../../db";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in 15 minutes." },
});

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await authStorage.getUser(req.session.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _ph, ...safe } = user as any;
      res.json(safe);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/signup", authLimiter, async (req, res) => {
    const { email, password, name } = req.body ?? {};
    if (!email || !password || !name) {
      return res.status(400).json({ message: "email, password and name are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    try {
      const existing = await authStorage.findUserByEmail(email.toLowerCase());
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      await authStorage.createUser({ email: email.toLowerCase(), passwordHash, name });
      res.status(201).json({ message: "Request submitted. Await admin approval." });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req: any, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }
    try {
      const user = await authStorage.findUserByEmail(email.toLowerCase());
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (user.status === "pending") {
        return res.status(403).json({ message: "Your account is awaiting admin approval." });
      }
      if (user.status === "rejected") {
        return res.status(403).json({ message: "Your account access has been rejected. Contact an administrator." });
      }
      req.session.userId = user.id;
      await authStorage.updateLastLogin(user.id);
      const { passwordHash: _ph, ...safe } = user as any;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // ─── Seed Initial Admin (one-time setup, protected by ADMIN_SEED_TOKEN) ──────
  app.post("/api/admin/seed-initial-admin", authLimiter, async (req: any, res) => {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED_IN_PROD !== "true") {
      return res.status(403).json({ message: "Seed route is disabled in production." });
    }

    const token = req.headers["x-seed-token"] ?? req.body?.token;
    const expectedToken = process.env.ADMIN_SEED_TOKEN;

    if (!expectedToken) {
      return res.status(500).json({ message: "ADMIN_SEED_TOKEN env var is not set on this server" });
    }
    if (!token || token !== expectedToken) {
      return res.status(401).json({ message: "Invalid or missing x-seed-token header" });
    }

    const seedPassword = process.env.ADMIN_SEED_PASSWORD;
    if (!seedPassword) {
      return res.status(500).json({ message: "ADMIN_SEED_PASSWORD env var is not set on this server" });
    }

    const seedEmail = process.env.ADMIN_SEED_EMAIL;
    const seedName  = process.env.ADMIN_SEED_NAME;
    if (!seedEmail) {
      return res.status(500).json({ message: "ADMIN_SEED_EMAIL env var is not set on this server" });
    }
    if (!seedName) {
      return res.status(500).json({ message: "ADMIN_SEED_NAME env var is not set on this server" });
    }

    try {
      const existing = await authStorage.findUserByEmail(seedEmail.toLowerCase());
      const passwordHash = await bcrypt.hash(seedPassword, 12);

      if (existing) {
        await authStorage.updateUser(existing.id, { role: "admin", status: "active" });
        console.log("[seed] Existing admin promoted to active admin");
        return res.json({ ok: true, message: "Existing user updated to admin/active" });
      }

      await authStorage.upsertUser({
        email: seedEmail.toLowerCase(),
        passwordHash,
        name: seedName,
        role: "admin",
        status: "active",
      });

      console.log("[seed] Initial admin seeded");
      res.json({ ok: true, message: "Initial admin seeded" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Temporary bulk-import endpoint for item_groups ──────────────────────
  app.post("/api/admin/bulk-import-item-groups", async (req, res) => {
    if (process.env.ALLOW_SEED_IN_PROD !== "true") return res.status(403).json({ message: "Not allowed" });
    if (req.headers["x-seed-token"] !== process.env.ADMIN_SEED_TOKEN) return res.status(401).json({ message: "Unauthorized" });
    const rows: any[] = req.body.rows;
    if (!rows?.length) return res.status(400).json({ message: "No rows" });
    let inserted = 0;
    for (const r of rows) {
      await pool.query(
        `INSERT INTO item_groups (id, category_id, base_item_name, image_url, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           category_id=EXCLUDED.category_id, base_item_name=EXCLUDED.base_item_name,
           image_url=EXCLUDED.image_url, updated_at=EXCLUDED.updated_at`,
        [r.id, r.category_id, r.base_item_name, r.image_url, r.created_at, r.updated_at]
      );
      inserted++;
    }
    res.json({ ok: true, inserted });
  });

  // ── Temporary bulk-import endpoint for project_material_transactions ─────
  app.post("/api/admin/bulk-import-pmt", async (req, res) => {
    if (process.env.ALLOW_SEED_IN_PROD !== "true") return res.status(403).json({ message: "Not allowed" });
    if (req.headers["x-seed-token"] !== process.env.ADMIN_SEED_TOKEN) return res.status(401).json({ message: "Unauthorized" });
    const rows: any[] = req.body.rows;
    if (!rows?.length) return res.status(400).json({ message: "No rows" });
    let inserted = 0;
    for (const r of rows) {
      await pool.query(
        `INSERT INTO project_material_transactions (id, project_id, item_id, movement_id, transaction_type, quantity, note, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET
           project_id=EXCLUDED.project_id, item_id=EXCLUDED.item_id, movement_id=EXCLUDED.movement_id,
           transaction_type=EXCLUDED.transaction_type, quantity=EXCLUDED.quantity,
           note=EXCLUDED.note`,
        [r.id, r.project_id, r.item_id, r.movement_id, r.transaction_type, r.quantity, r.note, r.created_at]
      );
      inserted++;
    }
    res.json({ ok: true, inserted });
  });

  // ── Temporary endpoint to fix sequences ──────────────────────────────────
  app.post("/api/admin/fix-sequences", async (req, res) => {
    if (process.env.ALLOW_SEED_IN_PROD !== "true") return res.status(403).json({ message: "Not allowed" });
    if (req.headers["x-seed-token"] !== process.env.ADMIN_SEED_TOKEN) return res.status(401).json({ message: "Unauthorized" });
    const tables = [
      'categories', 'daily_reports', 'equipment', 'inventory_location_balances',
      'inventory_movements', 'item_groups', 'item_images', 'items',
      'locations', 'material_requests', 'project_material_transactions',
      'project_scope_items', 'projects', 'purchase_recommendations',
      'suppliers', 'wire_reels', 'worker_attendance', 'workers'
    ];
    const results: any[] = [];
    for (const t of tables) {
      const r = await pool.query(`SELECT MAX(id) as max_id FROM ${t}`);
      const maxId = r.rows[0].max_id;
      if (maxId) {
        await pool.query(`SELECT setval('${t}_id_seq', $1)`, [maxId]);
        results.push({ table: t, set_to: maxId });
      }
    }
    res.json({ ok: true, results });
  });

  // ── Temporary bulk-import endpoint for wire_reels ────────────────────────
  app.post("/api/admin/bulk-import-wire-reels", async (req, res) => {
    if (process.env.ALLOW_SEED_IN_PROD !== "true") {
      return res.status(403).json({ message: "Not allowed" });
    }
    const token = req.headers["x-seed-token"];
    if (token !== process.env.ADMIN_SEED_TOKEN) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const rows: any[] = req.body.rows;
    if (!rows || !rows.length) return res.status(400).json({ message: "No rows" });
    let inserted = 0;
    for (const r of rows) {
      await pool.query(
        `INSERT INTO wire_reels (id, item_id, reel_id, length_ft, brand, supplier_id, location_id, status, notes, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE SET
           item_id=EXCLUDED.item_id, reel_id=EXCLUDED.reel_id, length_ft=EXCLUDED.length_ft,
           brand=EXCLUDED.brand, supplier_id=EXCLUDED.supplier_id, location_id=EXCLUDED.location_id,
           status=EXCLUDED.status, notes=EXCLUDED.notes, is_active=EXCLUDED.is_active,
           updated_at=EXCLUDED.updated_at`,
        [r.id, r.item_id, r.reel_id, r.length_ft, r.brand, r.supplier_id, r.location_id,
         r.status, r.notes, r.is_active, r.created_at, r.updated_at]
      );
      inserted++;
    }
    res.json({ ok: true, inserted });
  });

}
