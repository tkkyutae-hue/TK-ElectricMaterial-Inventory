import { apiRequest } from "@/lib/queryClient";

export class RequestCommandFailure extends Error {
  constructor(public code: string, public uncertain = false) { super(code); }
}
interface Pending {
  operationId: string;
  body: Record<string, unknown>;
  signature: string;
  method: string;
  url: string;
  inFlight?: Promise<any>;
}
// Memory only. An unresolved operation blocks a different write to that target.
// Explicit retry of identical intent reuses its original operation ID.
const pending = new Map<string, Pending>();
export async function requestCommand(
  method: string, url: string, payload: Record<string, unknown>,
  expectedRevision?: number, sourceOperationId?: string,
): Promise<{ request: any; operationId: string }> {
  const target = url.match(/\/requests\/(\d+)/)?.[1] ?? "new";
  const body = { payload, ...(expectedRevision !== undefined ? { expectedRevision } : {}),
    ...(sourceOperationId ? { sourceOperationId } : {}) };
  const signature = JSON.stringify({ method, url, ...body });
  let operation = pending.get(target);
  if (operation && operation.signature !== signature) throw new RequestCommandFailure("RESULT_UNKNOWN", true);
  if (!operation) {
    operation = { operationId: crypto.randomUUID(), body, signature, method, url };
    pending.set(target, operation);
  }
  if (operation.inFlight) return operation.inFlight;
  const active = operation;
  active.inFlight = (async () => {
    try {
      const response = await apiRequest(active.method, active.url, { ...active.body, operationId: active.operationId });
      const result = await response.json();
      if (result?.operationId !== active.operationId || !Number.isInteger(result?.request?.revision)) {
        throw new RequestCommandFailure("RESULT_UNKNOWN", true);
      }
      pending.delete(target);
      return result;
    } catch (error: any) {
      let code = error?.code;
      if (!code) {
        try { code = JSON.parse(error.message.slice(error.message.indexOf("{"))).code; } catch {}
      }
      const definite = ["FORBIDDEN", "AUTH_REQUIRED", "REVISION_REQUIRED", "OPERATION_ID_REQUIRED",
        "OPERATION_REUSED", "REQUEST_CHANGED", "STATE_CHANGED", "UNDO_UNAVAILABLE", "INVALID_ITEMS",
        "INVALID_ITEM", "INVALID_PROJECT", "INVALID_TEXT", "INVALID_REQUEST_TYPE", "INSUFFICIENT_STOCK",
        "TRANSFER_DESTINATION_REQUIRED", "LOCATION_UNRESOLVED", "LOCATION_BALANCE_MISSING",
        "FULFILLMENT_CHANGED", "COMMAND_ROLLED_BACK", "INVALID_STATUS"].includes(code);
      if (definite) pending.delete(target);
      throw new RequestCommandFailure(code ?? "RESULT_UNKNOWN", !definite);
    } finally { active.inFlight = undefined; }
  })();
  return active.inFlight;
}

export function requestCommandMessage(error: any, t: {
  requestConflict: string; requestResultUnknown: string; requestActionBlocked: string;
}) {
  if (error?.uncertain) return t.requestResultUnknown;
  if (["REQUEST_CHANGED", "STATE_CHANGED", "UNDO_UNAVAILABLE", "FULFILLMENT_CHANGED"].includes(error?.code)) return t.requestConflict;
  return `${t.requestActionBlocked} (${error?.code ?? "UNKNOWN"})`;
}
