import type { Express } from "express";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";

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

  app.post("/api/auth/signup", async (req, res) => {
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

  app.post("/api/auth/login", async (req: any, res) => {
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
  app.post("/api/admin/seed-initial-admin", async (req: any, res) => {
    const token = req.headers["x-seed-token"] ?? req.body?.token;
    const expectedToken = process.env.ADMIN_SEED_TOKEN;

    if (!expectedToken) {
      return res.status(500).json({ message: "ADMIN_SEED_TOKEN env var is not set on this server" });
    }
    if (!token || token !== expectedToken) {
      return res.status(401).json({ message: "Invalid or missing x-seed-token header" });
    }

    try {
      const ADMIN_EMAIL = "michael_kim@tkelectricllc.us";
      const existing = await authStorage.findUserByEmail(ADMIN_EMAIL);
      if (existing) {
        return res.status(409).json({ message: "Initial admin already exists — no changes made", email: existing.email });
      }

      const passwordHash = await bcrypt.hash("tk69956995!!", 12);
      await authStorage.upsertUser({
        email: ADMIN_EMAIL,
        passwordHash,
        name: "Michael Kim",
        role: "admin",
        status: "active",
      });

      console.log("[seed] Initial admin seeded:", ADMIN_EMAIL);
      res.json({ ok: true, message: "Initial admin seeded", email: ADMIN_EMAIL });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
