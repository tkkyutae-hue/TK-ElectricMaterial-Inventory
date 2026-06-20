// Monday.com GraphQL API client
// Uses MONDAY_API_TOKEN (Personal API Token from Monday.com Settings → API)

const MONDAY_API = "https://api.monday.com/v2";

export async function mondayGraphQL(query: string, variables: Record<string, any> = {}): Promise<any> {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) throw new Error("MONDAY_API_TOKEN is not configured");

  const res = await fetch(MONDAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token,
      "API-Version": "2023-10",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Monday API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Monday GraphQL error: ${json.errors.map((e: any) => e.message).join(", ")}`);
  }
  return json.data;
}

export async function fetchBoards(): Promise<{ id: string; name: string }[]> {
  const data = await mondayGraphQL(`
    query {
      boards(limit: 50, order_by: created_at) {
        id
        name
      }
    }
  `);
  return data.boards ?? [];
}

export async function fetchBoardColumns(boardId: string): Promise<{ id: string; title: string; type: string }[]> {
  const data = await mondayGraphQL(`
    query($boardId: [ID!]!) {
      boards(ids: $boardId) {
        columns {
          id
          title
          type
        }
      }
    }
  `, { boardId: [boardId] });
  return data.boards?.[0]?.columns ?? [];
}

export async function fetchBoardItems(boardId: string): Promise<MondayItem[]> {
  const items: MondayItem[] = [];
  let cursor: string | null = null;

  do {
    const data = await mondayGraphQL(`
      query($boardId: [ID!]!, $cursor: String) {
        boards(ids: $boardId) {
          items_page(limit: 100, cursor: $cursor) {
            cursor
            items {
              id
              name
              state
              url
              group {
                id
                title
              }
              column_values {
                id
                type
                text
                value
              }
            }
          }
        }
      }
    `, { boardId: [boardId], cursor });

    const page = data.boards?.[0]?.items_page;
    if (!page) break;
    items.push(...(page.items ?? []));
    cursor = page.cursor ?? null;
  } while (cursor);

  return items;
}

// Fetch a single item by ID — used for complete field sync on webhook events
export async function fetchSingleItem(itemId: string): Promise<MondayItem | null> {
  const data = await mondayGraphQL(`
    query($itemId: [ID!]!) {
      items(ids: $itemId, limit: 1) {
        id
        name
        state
        url
        group {
          id
          title
        }
        column_values {
          id
          type
          text
          value
        }
      }
    }
  `, { itemId: [itemId] });
  return data.items?.[0] ?? null;
}

// Registers webhooks for all required event types.
// Required events: fail-fast if ANY fails (all-or-nothing).
// Optional events: best-effort only, never cause registration to fail.
export async function registerWebhooks(boardId: string, webhookUrl: string): Promise<Array<{ id: string; event: string }>> {
  // Required: all 3 must succeed or the entire connection is rolled back.
  const requiredEvents = ["create_item", "change_column_value", "change_name"] as const;
  // Optional: group-move event — graceful degradation if unsupported by the board/plan.
  const optionalEvents = ["move_pulse_into_board"] as const;

  const results: Array<{ id: string; event: string }> = [];
  const failed: string[] = [];

  const registerOne = async (event: string): Promise<string | null> => {
    // Monday.com's API requires enum values to be inlined in the query string,
    // not passed as typed variables (WebhookEventType is not accepted as a variable type)
    const data = await mondayGraphQL(`
      mutation($boardId: ID!, $url: String!) {
        create_webhook(board_id: $boardId, url: $url, event: ${event}) {
          id
        }
      }
    `, { boardId, url: webhookUrl });
    return data.create_webhook?.id ?? null;
  };

  for (const event of requiredEvents) {
    try {
      const id = await registerOne(event);
      if (id) {
        results.push({ id, event });
      } else {
        failed.push(event);
      }
    } catch (err: any) {
      console.warn(`[monday] webhook registration for ${event} failed:`, err.message);
      failed.push(event);
    }
  }

  if (failed.length > 0) {
    // Roll back any partial registrations before throwing
    await deleteWebhooks(results.map(r => r.id));
    throw new Error(`Monday.com Webhook 등록 실패 (이벤트: ${failed.join(", ")}). API 토큰 권한을 확인하세요.`);
  }

  // Optional events — register if the board/plan supports them; silently skip on error
  for (const event of optionalEvents) {
    try {
      const id = await registerOne(event);
      if (id) {
        results.push({ id, event });
        console.log(`[monday] optional webhook registered: ${event}`);
      }
    } catch (err: any) {
      console.warn(`[monday] optional webhook ${event} not supported (skipping):`, err.message);
    }
  }

  return results;
}

// Deletes all webhook IDs stored for this board
export async function deleteWebhooks(webhookIds: string[]): Promise<void> {
  await Promise.allSettled(
    webhookIds.map(id =>
      mondayGraphQL(`
        mutation($webhookId: ID!) {
          delete_webhook(id: $webhookId) { id }
        }
      `, { webhookId: id })
    )
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type MondayItem = {
  id: string;
  name: string;
  state: string;
  url?: string;
  group?: { id: string; title: string };
  column_values: { id: string; type: string; text: string; value: string }[];
};

export type MondayColumnMapping = {
  projectNameColumnId?: string | null;
  statusColumnId?: string | null;
  contactColumnId?: string | null;
  timelineColumnId?: string | null;
  locationColumnId?: string | null;
  notesColumnId?: string | null;
  depositColumnId?: string | null;
  fileColumnIds?: string[];
};

// Keys that must be present before sync is allowed
export const REQUIRED_MAPPING_KEYS: (keyof MondayColumnMapping)[] = [
  "projectNameColumnId",
  "statusColumnId",
  "contactColumnId",
  "timelineColumnId",
  "locationColumnId",
];

export function isMappingComplete(mapping: MondayColumnMapping | null | undefined): boolean {
  if (!mapping) return false;
  return REQUIRED_MAPPING_KEYS.every(k => !!(mapping as any)[k]);
}

// ── Status mapping ─────────────────────────────────────────────────────────────

// Maps Monday status labels into VoltStock status enum.
// Returns { status, warning } — warning is non-null when an unknown label was received.
export function mapMondayStatus(statusText: string | null | undefined): { status: string; warning: string | null } {
  if (!statusText) return { status: "active", warning: null };
  const s = statusText.trim();

  // Exact / case-insensitive matches first (spec-required labels)
  const lower = s.toLowerCase();
  if (lower === "working on it") return { status: "active", warning: null };
  if (lower === "quote only") return { status: "on_hold", warning: null };
  if (lower === "done") return { status: "completed", warning: null };
  if (lower === "cancelled" || lower === "canceled") return { status: "cancelled", warning: null };

  // Broader fallback heuristics
  if (lower.includes("done") || lower.includes("complet")) return { status: "completed", warning: null };
  if (lower.includes("hold") || lower.includes("pause") || lower.includes("wait") || lower.includes("stuck")) return { status: "on_hold", warning: null };
  if (lower.includes("cancel")) return { status: "cancelled", warning: null };
  if (lower.includes("active") || lower.includes("progress") || lower.includes("working")) return { status: "active", warning: null };

  // Unknown status label — return on_hold + warning
  return { status: "on_hold", warning: `Unknown Monday status label: "${s}"` };
}

// ── Item → Project mapping ─────────────────────────────────────────────────────

export type MappedProject = {
  code: string;
  poNumber: string;
  name: string;
  status: string;
  customerName: string | null;
  mondayGroupId: string | null;
  mondayGroupTitle: string | null;
  mondayUrl: string | null;
  ownerName: string | null;
  startDate: string | null;
  endDate: string | null;
  jobLocation: string | null;
  notes: string | null;
  mondaySyncStatus: string;
  mondaySyncError: string | null;
};

export function mapMondayItemToProject(item: MondayItem, mapping?: MondayColumnMapping | null): MappedProject {
  // PO/CODE always comes from item.name — never from a column
  const code = item.name?.trim() || `MON-${item.id}`;

  // Group info → customer
  const mondayGroupId = item.group?.id ?? null;
  const mondayGroupTitle = item.group?.title ?? null;
  const customerName = mondayGroupTitle;
  const mondayUrl = item.url ?? null;

  let projectName: string | null = null;
  let statusText: string | null = null;
  let ownerName: string | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;
  let jobLocation: string | null = null;
  let notes: string | null = null;

  const colMap = new Map(item.column_values.map(c => [c.id, c]));

  if (mapping && isMappingComplete(mapping)) {
    // ── Use saved column mapping ───────────────────────────────────────────────
    if (mapping.projectNameColumnId) {
      projectName = colMap.get(mapping.projectNameColumnId)?.text?.trim() || null;
    }
    if (mapping.statusColumnId) {
      statusText = colMap.get(mapping.statusColumnId)?.text?.trim() || null;
    }
    if (mapping.contactColumnId) {
      ownerName = colMap.get(mapping.contactColumnId)?.text?.trim() || null;
    }
    if (mapping.timelineColumnId) {
      const timelineCol = colMap.get(mapping.timelineColumnId);
      if (timelineCol) {
        if (timelineCol.type === "timeline") {
          try {
            const parsed = timelineCol.value ? JSON.parse(timelineCol.value) : null;
            if (parsed?.from) startDate = parsed.from;
            if (parsed?.to) endDate = parsed.to;
          } catch {}
        } else {
          // date column
          endDate = timelineCol.text?.trim() || null;
        }
      }
    }
    if (mapping.locationColumnId) {
      jobLocation = colMap.get(mapping.locationColumnId)?.text?.trim() || null;
    }
    if (mapping.notesColumnId) {
      notes = colMap.get(mapping.notesColumnId)?.text?.trim() || null;
    }
  } else {
    // ── Auto-detect fallback (used before mapping is configured) ──────────────
    for (const col of item.column_values) {
      const type = col.type?.toLowerCase();
      const id = col.id?.toLowerCase();
      const text = col.text?.trim() || null;

      if (!projectName && (id.includes("name") || id.includes("remark") || id.includes("project"))) {
        if (text) projectName = text;
      } else if (!statusText && (type === "color" || id === "status" || id.includes("status"))) {
        if (text) statusText = text;
      } else if (!ownerName && (type === "multiple-person" || type === "person" || id.includes("person") || id.includes("owner") || id.includes("assign"))) {
        if (text) ownerName = text;
      } else if (!startDate && id.includes("start")) {
        if (text) startDate = text;
      } else if (!endDate && (id.includes("end") || id.includes("due") || id.includes("deadline"))) {
        if (text) endDate = text;
      } else if (!endDate && (type === "date" || id === "date")) {
        if (text) endDate = text;
      } else if (!startDate && !endDate && type === "timeline") {
        try {
          const parsed = col.value ? JSON.parse(col.value) : null;
          if (parsed?.from) startDate = parsed.from;
          if (parsed?.to) endDate = parsed.to;
        } catch {}
      } else if (!jobLocation && (id.includes("location") || id.includes("address") || id.includes("site"))) {
        if (text) jobLocation = text;
      } else if (!notes && (type === "long-text" || (type === "text" && (id.includes("note") || id.includes("desc"))))) {
        if (text) notes = text;
      }
    }
  }

  // Fallback: if no project name column found, use item.name (same as PO/CODE)
  const name = projectName || code;

  const { status, warning } = item.state === "deleted"
    ? { status: "cancelled", warning: null }
    : mapMondayStatus(statusText);

  return {
    code,
    poNumber: code,
    name,
    status,
    customerName,
    mondayGroupId,
    mondayGroupTitle,
    mondayUrl,
    ownerName,
    startDate,
    endDate,
    jobLocation,
    notes,
    mondaySyncStatus: warning ? "warning" : "ok",
    mondaySyncError: warning,
  };
}

// Auto-suggest column mapping from board columns (fuzzy title matching)
export function autoSuggestMapping(
  columns: { id: string; title: string; type: string }[]
): MondayColumnMapping {
  const mapping: MondayColumnMapping = {};

  for (const col of columns) {
    const title = col.title.toLowerCase();
    const type = col.type.toLowerCase();

    if (!mapping.projectNameColumnId && (title.includes("project name") || title.includes("remark") || (title.includes("name") && !title.includes("person")))) {
      mapping.projectNameColumnId = col.id;
    } else if (!mapping.statusColumnId && (type === "color" || type === "status" || title === "status" || title.includes("status"))) {
      mapping.statusColumnId = col.id;
    } else if (!mapping.contactColumnId && (type === "multiple-person" || type === "person" || title.includes("contact") || title.includes("assign") || title.includes("owner"))) {
      mapping.contactColumnId = col.id;
    } else if (!mapping.timelineColumnId && (type === "timeline" || type === "date" || title.includes("timeline") || title.includes("date") || title.includes("due"))) {
      mapping.timelineColumnId = col.id;
    } else if (!mapping.locationColumnId && (title.includes("location") || title.includes("address") || title.includes("site") || title.includes("city"))) {
      mapping.locationColumnId = col.id;
    } else if (!mapping.notesColumnId && (type === "long-text" || title.includes("note") || title.includes("memo") || title.includes("desc") || title.includes("remark"))) {
      mapping.notesColumnId = col.id;
    }
  }

  return mapping;
}
