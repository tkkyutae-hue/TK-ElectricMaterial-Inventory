import type { Express, RequestHandler } from "express";
import { MaterialRequestCommands, RequestCommandError, type RequestCommand } from "./materialRequestCommands";
import type { Pool } from "pg";

/** Versioned routes only; this module performs no schema bootstrapping. */
export function registerMaterialRequestCommands(
  app: Express, pool: Pool, authenticate: RequestHandler, loadUser: RequestHandler,
) {
  const service = new MaterialRequestCommands(pool);
  const route = (action: RequestCommand["action"]) => async (req: any, res: any) => {
    try {
      if (!req.user?.id) return res.status(401).json({ code: "AUTH_REQUIRED" });
      const result = await service.execute(req.user.id, {
        action, operationId: req.body?.operationId, expectedRevision: req.body?.expectedRevision,
        sourceOperationId: req.body?.sourceOperationId,
        ...(action !== "create" ? { requestId: Number(req.params.id) } : {}),
        payload: req.body?.payload ?? req.body,
      });
      res.json(result);
    } catch (error: any) {
      if (error instanceof RequestCommandError) return res.status(error.status).json({ code: error.code });
      // Commit may have succeeded before a connection failure. Do not say "failed".
      res.status(503).json({ code: "RESULT_UNKNOWN", operationId: req.body?.operationId });
    }
  };
  app.post("/api/field/requests", authenticate, loadUser, route("create"));
  app.patch("/api/field/requests/:id", authenticate, loadUser, route("edit"));
  app.post("/api/field/requests/:id/undo-edit", authenticate, loadUser, route("undo_edit"));
  app.patch("/api/field/requests/:id/status", authenticate, loadUser, route("status"));
  app.post("/api/field/requests/:id/undo-complete", authenticate, loadUser, route("undo_complete"));
  app.delete("/api/field/requests/:id", authenticate, loadUser, route("delete"));
  app.get("/api/field/request-operations/:operationId", authenticate, loadUser, async (req: any, res) => {
    try {
      if (!req.user?.id) return res.status(401).json({ code: "AUTH_REQUIRED" });
      res.json(await service.receipt(req.user.id, req.params.operationId));
    } catch (error) {
      if (error instanceof RequestCommandError) return res.status(error.status).json({ code: error.code });
      res.status(503).json({ code: "RESULT_UNKNOWN" });
    }
  });
}
