import type { RequestHandler } from "express";

/** Same session guard used by the app; no session store or DB imports. */
export const isSessionAuthenticated: RequestHandler = (req, res, next) => {
  if (!(req.session as any)?.userId) return res.status(401).json({ message: "Unauthorized" });
  next();
};

/** Production supplies its existing user store; isolated tests supply a fresh DB. */
export function loadRequestUser(getUser: (id: string) => Promise<any>): RequestHandler {
  return async (req: any, _res, next) => {
    delete req.user;
    try {
      const id = req.session?.userId;
      if (id) {
        const user = await getUser(id);
        if (user?.status === "active") req.user = user;
      }
    } catch {
      // Fail closed: versioned handlers reject the absent identity.
    }
    next();
  };
}
