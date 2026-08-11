import { OAuth2Client } from "google-auth-library";
import type { Express } from "express";
import { authStorage } from "./storage";

function getClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL ??
      `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : ""}/api/auth/google/callback`,
  );
}

export function registerGoogleAuthRoutes(app: Express): void {
  // ── Step 1: Redirect to Google ──────────────────────────────────────────
  app.get("/api/auth/google", (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.warn("[google-auth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set");
      return res.redirect("/login?error=google_not_configured");
    }
    const client = getClient();
    const url = client.generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
    });
    res.redirect(url);
  });

  // ── Step 2: Handle Google callback ──────────────────────────────────────
  app.get("/api/auth/google/callback", async (req: any, res) => {
    const { code, error } = req.query as Record<string, string>;

    if (error || !code) {
      console.warn("[google-auth] OAuth error or missing code:", error);
      return res.redirect("/login?error=google");
    }

    try {
      const client = getClient();
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);

      // Decode the ID token to get profile info (no extra HTTP call needed)
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload) throw new Error("Empty token payload");

      const googleId        = payload.sub;
      const email           = (payload.email ?? "").toLowerCase();
      const name            = payload.name ?? null;
      const profileImageUrl = payload.picture ?? null;

      if (!email) throw new Error("Google did not return an email address");

      // ── Find or create user ─────────────────────────────────────────────
      let user = await authStorage.findUserByGoogleId(googleId);

      if (!user) {
        // Try matching by email (existing email/password account)
        user = await authStorage.findUserByEmail(email);
        if (user) {
          // Link Google ID to existing account
          if (!user.googleId) {
            await authStorage.linkGoogleId(user.id, googleId);
          }
        } else {
          // Brand-new user via Google — create as pending viewer
          user = await authStorage.createGoogleUser({ googleId, email, name, profileImageUrl });
        }
      }

      // ── Enforce account status ──────────────────────────────────────────
      if (user.status === "pending") {
        return res.redirect("/login?error=pending");
      }
      if (user.status === "rejected") {
        return res.redirect("/login?error=rejected");
      }

      // ── Start session ───────────────────────────────────────────────────
      req.session.userId = user.id;
      await authStorage.updateLastLogin(user.id);
      res.redirect("/home");
    } catch (err: any) {
      console.error("[google-auth] callback error:", err?.message ?? err);
      res.redirect("/login?error=google");
    }
  });
}
