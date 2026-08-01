// Jibble Time & Attendance API client
// Auth: OAuth2 Client Credentials flow
//   POST https://identity.prod.jibble.io/connect/token
//   Authorization: Basic base64(clientId:clientSecret)
//   grant_type=client_credentials&scope=api1
//
// Jibble uses a microservice architecture — each domain has its own base URL:
//   workspace   → https://workspace.prod.jibble.io/v1   (People, Organizations)
//   time-tracking → https://time-tracking.prod.jibble.io/v1  (TimeEntries, HourEntries)
//   time-attendance → https://time-attendance.prod.jibble.io/v1 (Timesheets)
//
// Endpoints return OData envelopes: { value: [...] }

const JIBBLE_TOKEN_URL  = "https://identity.prod.jibble.io/connect/token";
const JIBBLE_WORKSPACE  = "https://workspace.prod.jibble.io/v1";
const JIBBLE_TRACKING   = "https://time-tracking.prod.jibble.io/v1";
const JIBBLE_ATTENDANCE = "https://time-attendance.prod.jibble.io/v1";

// ─── OAuth2 token exchange ────────────────────────────────────────────────────

export async function exchangeClientCredentials(
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  // Jibble's IdentityServer4 expects credentials as Basic Auth header,
  // not in the request body.
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "client_credentials", scope: "api1" });

  const res = await fetch(JIBBLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jibble token exchange failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const accessToken = json.access_token as string;
  const expiresIn   = (json.expires_in as number) ?? 3600;
  // Subtract 60 s buffer so we refresh a bit before actual expiry
  const expiresAt = Date.now() + (expiresIn - 60) * 1000;

  return { accessToken, expiresAt };
}

// ─── Cached token helper (requires storage) ───────────────────────────────────

export async function getJibbleToken(storage: {
  getAppSetting: (key: string) => Promise<string | null | undefined>;
  setAppSetting: (key: string, value: string | null) => Promise<void>;
}): Promise<string> {
  const [cachedToken, expiresAtRaw, clientId, clientSecret] = await Promise.all([
    storage.getAppSetting("jibble_access_token"),
    storage.getAppSetting("jibble_token_expires_at"),
    storage.getAppSetting("jibble_client_id"),
    storage.getAppSetting("jibble_client_secret"),
  ]);

  if (!clientId || !clientSecret) {
    throw new Error("Jibble이 연결되지 않았습니다. Client ID와 Secret을 먼저 입력해주세요.");
  }

  const expiresAt = expiresAtRaw ? parseInt(expiresAtRaw, 10) : 0;
  if (cachedToken && Date.now() < expiresAt) {
    return cachedToken;
  }

  // Token missing or expired — refresh
  const { accessToken, expiresAt: newExpiresAt } = await exchangeClientCredentials(clientId, clientSecret);
  await Promise.all([
    storage.setAppSetting("jibble_access_token",    accessToken),
    storage.setAppSetting("jibble_token_expires_at", String(newExpiresAt)),
  ]);
  return accessToken;
}

// ─── Low-level fetch ──────────────────────────────────────────────────────────
// `baseUrl` is one of the JIBBLE_* constants; `path` is the entity segment.

export async function jibbleFetch(
  baseUrl: string,
  path: string,
  token: string,
  params?: Record<string, string>,
): Promise<any> {
  const url = new URL(baseUrl + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jibble API ${res.status} (${path}): ${text}`);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JibblePerson {
  id?: string;
  uid?: string;          // some versions expose uid
  name: string;
  employeeNumber?: string;
  email?: string;
  status?: string;
  photoUrl?: string;
}

export interface JibbleTimeEntry {
  id: string;
  personId?: string;
  personUid?: string;
  startTime?: string;    // ISO timestamp
  endTime?: string | null;
  duration?: number;     // seconds
  faceVerified?: boolean;
  imageUrl?: string;
  activity?: string;
}

export interface JibbleAttendanceRecord {
  id: string;
  personId?: string;
  personUid?: string;
  date: string;          // YYYY-MM-DD
  firstIn?: string;      // ISO timestamp
  lastOut?: string;      // ISO timestamp
  totalDuration?: number; // seconds
  status?: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

/** Fetch all active team members from the workspace service.
 *  Normalises the person identifier: the workspace service may return `id`
 *  (OData convention) or `uid` (legacy). We expose both fields and always
 *  set `uid = uid ?? id` so that all downstream code using `person.uid`
 *  continues to work regardless of which field the API populates. */
export async function fetchJibbleMembers(token: string): Promise<JibblePerson[]> {
  const data = await jibbleFetch(JIBBLE_WORKSPACE, "/People", token);
  const list = data?.value ?? data?.data ?? (Array.isArray(data) ? data : []);
  return (list as any[]).map((p) => ({
    ...p,
    // Guarantee that `uid` is always the canonical person key
    uid: p.uid ?? p.id ?? "",
  })) as JibblePerson[];
}

/** Fetch currently clocked-in time entries from the time-tracking service */
export async function fetchActiveTimeEntries(token: string): Promise<JibbleTimeEntry[]> {
  // OData filter: entries with no end time are still active (clocked in)
  const data = await jibbleFetch(JIBBLE_TRACKING, "/TimeEntries", token, {
    "$filter": "endTime eq null",
  });
  const list = data?.value ?? data?.data ?? (Array.isArray(data) ? data : []);
  return list as JibbleTimeEntry[];
}

/** Fetch attendance (timesheet) records for a date range from the time-attendance service */
export async function fetchAttendance(
  token: string,
  params?: { from?: string; to?: string; personId?: string },
): Promise<JibbleAttendanceRecord[]> {
  const filters: string[] = [];
  if (params?.from)     filters.push(`date ge '${params.from}'`);
  if (params?.to)       filters.push(`date le '${params.to}'`);
  if (params?.personId) filters.push(`personId eq '${params.personId}'`);

  const qp: Record<string, string> = {};
  if (filters.length) qp["$filter"] = filters.join(" and ");

  const data = await jibbleFetch(JIBBLE_ATTENDANCE, "/Timesheets", token, qp);
  const list = data?.value ?? data?.data ?? (Array.isArray(data) ? data : []);
  return list as JibbleAttendanceRecord[];
}

/** Test a client-id/secret pair — returns org name on success */
export async function testJibbleCredentials(
  clientId: string,
  clientSecret: string,
): Promise<{ ok: boolean; orgName?: string; error?: string }> {
  try {
    const { accessToken } = await exchangeClientCredentials(clientId, clientSecret);
    // Try fetching org info with the fresh token
    try {
      const data = await jibbleFetch(JIBBLE_WORKSPACE, "/Organizations", accessToken);
      // OData response: { value: [{ name: '...' }] }
      const orgs = data?.value ?? data?.data ?? (Array.isArray(data) ? data : []);
      const orgName = orgs[0]?.name ?? orgs[0]?.displayName;
      return { ok: true, orgName };
    } catch {
      // Token worked (exchange succeeded) even if /Organizations endpoint differs
      return { ok: true };
    }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "인증 실패" };
  }
}
