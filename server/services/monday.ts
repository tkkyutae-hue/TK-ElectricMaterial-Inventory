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

export async function registerWebhook(boardId: string, webhookUrl: string): Promise<string> {
  const data = await mondayGraphQL(`
    mutation($boardId: ID!, $url: String!, $event: WebhookEventType!) {
      create_webhook(board_id: $boardId, url: $url, event: $event) {
        id
      }
    }
  `, { boardId, url: webhookUrl, event: "change_column_value" });

  const webhookId = data.create_webhook?.id;

  // Also register create/delete events separately
  await mondayGraphQL(`
    mutation($boardId: ID!, $url: String!, $event: WebhookEventType!) {
      create_webhook(board_id: $boardId, url: $url, event: $event) { id }
    }
  `, { boardId, url: webhookUrl, event: "create_pulse" });

  await mondayGraphQL(`
    mutation($boardId: ID!, $url: String!, $event: WebhookEventType!) {
      create_webhook(board_id: $boardId, url: $url, event: $event) { id }
    }
  `, { boardId, url: webhookUrl, event: "delete_pulse" });

  return webhookId;
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  await mondayGraphQL(`
    mutation($webhookId: ID!) {
      delete_webhook(id: $webhookId) { id }
    }
  `, { webhookId }).catch(() => { /* ignore if already deleted */ });
}

// ── Monday item to VoltStock project mapping ──────────────────────────────────

export type MondayItem = {
  id: string;
  name: string;
  state: string;
  column_values: { id: string; type: string; text: string; value: string }[];
};

// Maps Monday status label to VoltStock status enum
export function mapMondayStatus(statusText: string | null | undefined): string {
  if (!statusText) return "active";
  const s = statusText.toLowerCase();
  if (s.includes("done") || s.includes("completed") || s.includes("complete")) return "completed";
  if (s.includes("stuck") || s.includes("hold") || s.includes("paused") || s.includes("waiting")) return "on_hold";
  if (s.includes("cancel")) return "cancelled";
  return "active";
}

export function mapMondayItemToProject(item: MondayItem): {
  name: string;
  status: string;
  ownerName: string | null;
  startDate: string | null;
  endDate: string | null;
  jobLocation: string | null;
  notes: string | null;
} {
  let statusText: string | null = null;
  let ownerName: string | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;
  let jobLocation: string | null = null;
  let notes: string | null = null;

  for (const col of item.column_values) {
    const type = col.type?.toLowerCase();
    const id = col.id?.toLowerCase();
    const text = col.text?.trim() || null;

    if (type === "color" || id === "status" || id.includes("status")) {
      if (text) statusText = text;
    } else if (type === "multiple-person" || type === "person" || id.includes("person") || id.includes("owner") || id.includes("assign")) {
      if (text) ownerName = text;
    } else if (type === "date" || id.includes("start") || id === "date") {
      if (text) startDate = text;
    } else if (id.includes("end") || id.includes("due") || id.includes("deadline")) {
      if (text) endDate = text;
    } else if (type === "timeline") {
      try {
        const parsed = col.value ? JSON.parse(col.value) : null;
        if (parsed?.from) startDate = parsed.from;
        if (parsed?.to) endDate = parsed.to;
      } catch {}
    } else if (id.includes("location") || id.includes("address") || id.includes("site")) {
      if (text) jobLocation = text;
    } else if (type === "long-text" || id.includes("note") || id.includes("desc")) {
      if (text) notes = text;
    }
  }

  return {
    name: item.name,
    status: item.state === "deleted" ? "cancelled" : mapMondayStatus(statusText),
    ownerName,
    startDate,
    endDate,
    jobLocation,
    notes,
  };
}
