import type { NextFunction, Request, Response } from "express";

type Account = { id: string; role?: string | null; status?: string | null };

/** Inject identity lookup; importing this middleware never opens a DB/session. */
export function createRoleAuthorization(getUser: (id: string) => Promise<Account | null | undefined>) {
  return async (roles: string | string[], req: Request, res: Response, next: NextFunction) => {
    const request = req as Request & { currentUser?: Account };
    delete request.currentUser;
    const userId = (req.session as { userId?: string } | undefined)?.userId;
    if (!userId) return res.status(401).json({ message: "Authentication required" });
    try {
      const user = await getUser(userId);
      if (!user || user.status !== "active") {
        return res.status(401).json({ message: "Authentication required" });
      }
      const allowed = Array.isArray(roles) ? roles : [roles];
      if (!allowed.includes(user.role ?? "")) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      request.currentUser = user;
      next();
    } catch {
      return res.status(500).json({ message: "Authorization check failed" });
    }
  };
}
