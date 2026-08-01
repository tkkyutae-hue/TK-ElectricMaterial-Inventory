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
  name: string;          // normalised display name (fullName ?? name ?? email)
  fullName?: string;     // Jibble live API primary name field (Person.fullName)
  employeeCode?: string; // Jibble live API field name
  employeeNumber?: string; // kept for backwards compat / alias
  email?: string;
  status?: string;
  photoUrl?: string;
}

// TimeEntry is an individual punch event (one record per In/Out/StartBreak action).
// Schema confirmed via time-tracking.prod.jibble.io/v1/$metadata
export interface JibbleTimeEntry {
  id: string;
  personId?: string;           // Guid — matches jibblePersonId in our DB
  type?: "In" | "Out" | "StartBreak" | string;
  localTime?: string;          // ISO timestamp of the event
  time?: string;               // fallback alias
  nextTimeEntryId?: string | null; // null = no subsequent event → person is still on site
  isFaceRecognized?: boolean;
  picture?: { url?: string } | null;
}

// Mirrors DailyTimesheetModel from time-attendance.prod.jibble.io/v1/$metadata
export interface JibbleAttendanceRecord {
  personId?: string;
  date: string;                    // YYYY-MM-DD
  firstInTimestamp?: string;       // ISO DateTimeOffset — first clock-in of the day
  lastOutTimestamp?: string;       // ISO DateTimeOffset — last clock-out of the day
  // Aliases kept so existing WorkerDetail fallback chains keep working
  firstIn?: string;
  lastOut?: string;
  totalDuration?: number;          // seconds, derived from trackedHours duration string
  status?: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

/** Fetch all active team members from the workspace service.
 *  Normalises the person identifier: the workspace service may return `id`
 *  (OData convention) or `uid` (legacy). We expose both fields and always
 *  set `uid = uid ?? id` so that all downstream code using `person.uid`
 *  continues to work regardless of which field the API populates.
 *  Also normalises `employeeCode` → `employeeNumber` so UI code can use
 *  either field name. */
export async function fetchJibbleMembers(token: string): Promise<JibblePerson[]> {
  const data = await jibbleFetch(JIBBLE_WORKSPACE, "/People", token);
  const list = data?.value ?? data?.data ?? (Array.isArray(data) ? data : []);
  return (list as any[]).map((p) => ({
    ...p,
    // Guarantee that `uid` is always the canonical person key
    uid: p.uid ?? p.id ?? "",
    // Live API uses `fullName`; fall back to `name`, then email as last resort
    name: p.fullName ?? p.name ?? p.email ?? "",
    fullName: p.fullName ?? p.name,
    // Normalise employee code — live API uses `code` or `employeeCode`
    employeeCode: p.employeeCode ?? p.code ?? p.employeeNumber,
    employeeNumber: p.employeeNumber ?? p.employeeCode ?? p.code,
  })) as JibblePerson[];
}

/** Parse an ISO 8601 duration string (e.g. "PT8H30M") into total seconds. */
function parseDuration(dur?: string): number | undefined {
  if (!dur) return undefined;
  const m = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!m) return undefined;
  return (parseInt(m[1] || "0") * 3600)
       + (parseInt(m[2] || "0") * 60)
       + Math.round(parseFloat(m[3] || "0"));
}

/** Fetch currently clocked-in people using the time-attendance /TimesheetsSummary endpoint.
 *  Jibble's /TimeEntries endpoint consistently returns 500 regardless of query params,
 *  so we use TimesheetsSummary instead.
 *
 *  DailyTimesheetSummaryModel has `firstIn` (DateTimeOffset) and `lastOut` (DateTimeOffset).
 *  A person with firstIn set and lastOut absent/null for today is currently on site.
 *
 *  Returns lightweight objects with `{ personId }` — compatible with the existing
 *  jibble_active_cache format read by /api/jibble/active (entry.personId lookup). */
export async function fetchActiveTimeEntries(token: string): Promise<{ personId: string; firstIn: string }[]> {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const data = await jibbleFetch(JIBBLE_ATTENDANCE, "/TimesheetsSummary", token, {
    from: today,
    to: today,
  });
  const list: any[] = data?.value ?? data?.data ?? (Array.isArray(data) ? data : []);

  const active: { personId: string; firstIn: string }[] = [];
  for (const summary of list) {
    const personId: string = summary.personId;
    if (!personId) continue;
    // `daily` is an array of DailyTimesheetSummaryModel; filter for today's entry
    const daily: any[] = summary.daily ?? [];
    const todayEntry = daily.find((d: any) => d.date === today);
    if (todayEntry?.firstIn && !todayEntry?.lastOut) {
      active.push({ personId, firstIn: todayEntry.firstIn });
    }
  }
  return active;
}

/** Fetch attendance (timesheet) records for a date range from the time-attendance service.
 *  Uses key-based OData access /Timesheets({personId}) when a personId is given, which
 *  returns a TimesheetModel with a `daily` array of DailyTimesheetModel entries.
 *  Falls back to list-based access when no personId is provided. */
export async function fetchAttendance(
  token: string,
  params?: { from?: string; to?: string; personId?: string },
): Promise<JibbleAttendanceRecord[]> {
  // Query params: Jibble uses `from` / `to` (YYYY-MM-DD) for date range filtering
  const qp: Record<string, string> = {};
  if (params?.from) qp["from"] = params.from;
  if (params?.to)   qp["to"]   = params.to;

  if (params?.personId) {
    // Key-based access returns a single TimesheetModel with a `daily` collection
    const data = await jibbleFetch(JIBBLE_ATTENDANCE, `/Timesheets(${params.personId})`, token, qp);
    const daily: any[] = data?.daily ?? [];
    return daily.map((d) => ({
      personId:          params.personId,
      date:              d.date,
      firstInTimestamp:  d.firstInTimestamp,
      lastOutTimestamp:  d.lastOutTimestamp,
      firstIn:           d.firstInTimestamp,  // alias for legacy UI fallback chains
      lastOut:           d.lastOutTimestamp,
      totalDuration:     parseDuration(d.trackedHours?.total ?? d.trackedHours?.tracked),
      status:            d.status,
    }));
  }

  // No personId: list all timesheets (used for bulk sync)
  const data = await jibbleFetch(JIBBLE_ATTENDANCE, "/Timesheets", token, qp);
  const list = data?.value ?? data?.data ?? (Array.isArray(data) ? data : []);
  return (list as any[]).map((r) => {
    const daily0 = r.daily?.[0];
    return {
      personId:          r.personId,
      date:              daily0?.date ?? r.date,
      firstInTimestamp:  daily0?.firstInTimestamp,
      lastOutTimestamp:  daily0?.lastOutTimestamp,
      firstIn:           daily0?.firstInTimestamp,
      lastOut:           daily0?.lastOutTimestamp,
      totalDuration:     parseDuration(r.total ?? daily0?.trackedHours?.total),
      status:            r.status,
    };
  });
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
