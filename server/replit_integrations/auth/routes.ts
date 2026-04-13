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

  // ─── Bulk Import (one-time data migration, protected by ADMIN_SEED_TOKEN) ────
  const ALLOWED_IMPORT_TABLES = [
    "categories", "locations", "suppliers", "items",
    "projects", "inventory_movements", "inventory_location_balances",
  ];

  app.post("/api/admin/bulk-import", async (req: any, res) => {
    const token = req.headers["x-seed-token"] ?? req.body?.token;
    if (!token || token !== process.env.ADMIN_SEED_TOKEN) {
      return res.status(401).json({ message: "Invalid or missing x-seed-token" });
    }
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED_IN_PROD !== "true") {
      return res.status(403).json({ message: "Import disabled in production." });
    }

    const { table, rows, truncate } = req.body ?? {};
    if (!table || !ALLOWED_IMPORT_TABLES.includes(table)) {
      return res.status(400).json({ message: "Invalid or missing table name" });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "rows must be a non-empty array" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (truncate) {
        await client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
      }
      const cols = Object.keys(rows[0]);
      const colList = cols.map(c => `"${c}"`).join(", ");
      let inserted = 0;
      for (const row of rows) {
        const vals = cols.map(c => row[c] === undefined ? null : row[c]);
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(
          `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          vals
        );
        inserted++;
      }
      await client.query("COMMIT");
      res.json({ ok: true, table, inserted });
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  });
}
