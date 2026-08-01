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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Printed once per process so the deployment log confirms the strategy. */
let syncStrategyLogged = false;

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

/** Like `jibbleFetch` but with automatic retry for 429 / 5xx responses.
 *  - Reads `Retry-After` header when present; otherwise uses exponential backoff.
 *  - 404 errors are NOT retried; thrown Error carries `{ status: 404 }`.
 *  - Other 4xx errors are not retried.
 *  - maxRetries defaults to 4. */
async function jibbleFetchRetry(
  baseUrl: string,
  path: string,
  token: string,
  params?: Record<string, string>,
  maxRetries = 4,
): Promise<any> {
  const url = new URL(baseUrl + path);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (res.ok) return res.json();

    // 404 = invalid resource — do not retry
    if (res.status === 404) {
      const text = await res.text().catch(() => "");
      const err = new Error(`Jibble API 404 (${path}): ${text}`);
      (err as any).status = 404;
      throw err;
    }

    // 429 or 5xx = retryable
    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      const retryAfterHeader = res.headers.get("Retry-After");
      let waitMs: number;
      if (retryAfterHeader) {
        const seconds = parseInt(retryAfterHeader, 10);
        waitMs = isNaN(seconds) ? 1000 : Math.min(seconds * 1000, 10_000);
      } else {
        waitMs = Math.min(500 * Math.pow(2, attempt), 10_000);
      }
      console.warn(`[jibble] attempt ${attempt + 1}/${maxRetries + 1} → ${res.status} (${path}), retrying in ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }

    // Other 4xx, or retries exhausted
    const text = await res.text().catch(() => "");
    const err = new Error(`Jibble API ${res.status} (${path}): ${text}`);
    (err as any).status = res.status;
    throw err;
  }
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

/** Parse an ISO 8601 duration string (e.g. "PT8H30M", "PT8H30M15S") into total seconds.
 *  Also accepts a plain number (treated as seconds) for defensive handling. */
function parseDuration(dur?: string | number | null): number | undefined {
  if (dur === null || dur === undefined) return undefined;
  if (typeof dur === "number") return dur > 0 ? dur : undefined;
  if (typeof dur !== "string" || !dur) return undefined;
  const m = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i);
  if (!m) return undefined;
  const total = (parseInt(m[1] || "0") * 3600)
              + (parseInt(m[2] || "0") * 60)
              + Math.round(parseFloat(m[3] || "0"));
  return total > 0 ? total : undefined;
}

/** Extract a duration string from a trackedHours value that may be:
 *  - an object: { total: "PT8H30M", tracked: "PT8H30M" }
 *  - a flat ISO 8601 string: "PT8H30M"
 *  - a plain number of seconds */
function extractDuration(trackedHours: any): number | undefined {
  if (!trackedHours) return undefined;
  if (typeof trackedHours === "string") return parseDuration(trackedHours);
  if (typeof trackedHours === "number") return parseDuration(trackedHours);
  // object — try known field names
  return parseDuration(
    trackedHours.total ?? trackedHours.tracked ?? trackedHours.duration ?? trackedHours.value,
  );
}

/** Fetch today's clock-in/out status for all mapped workers.
 *
 *  Uses the time-tracking service `/TimeEntries` endpoint with a single bulk call
 *  (`$filter=belongsToDate eq {today}`). This is far more reliable than the
 *  time-attendance `/Timesheets({personId})` endpoint, which consistently returns 404
 *  despite valid personIds.  (Investigation confirmed: the workspace People API `id`
 *  field does NOT key into the time-attendance Timesheets entity — the entity simply
 *  has no accessible key via the workspace id.)
 *
 *  OData `$filter`/`$top`/`$orderby` params must be embedded in the path string
 *  directly — passing them via the `params` argument would encode `$` → `%24`.
 *
 *  Returns:
 *  - `updated`    — workers with activity today; each has firstIn and optional lastOut
 *  - `invalidIds` — always empty (validation happens at mapping time)
 *  - `failed`     — all personIds when the bulk fetch itself errors */
export async function fetchActiveTimeEntries(
  token: string,
  personIds: string[],
): Promise<{
  updated: { personId: string; firstIn: string; lastOut?: string }[];
  invalidIds: string[];
  failed: string[];
}> {
  if (!syncStrategyLogged) {
    console.log("[jibble] active sync strategy: timeentries-bulk-v1");
    syncStrategyLogged = true;
  }

  if (personIds.length === 0) return { updated: [], invalidIds: [], failed: [] };

  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const personIdSet = new Set(personIds);

  try {
    // Single bulk call — OData params embedded in path to avoid '%24' encoding.
    const path = `/TimeEntries?$filter=belongsToDate eq ${today}&$top=500&$orderby=time asc`;
    const data = await jibbleFetchRetry(JIBBLE_TRACKING, path, token);
    const entries: any[] = data?.value ?? [];

    // Group entries by personId, keeping only mapped workers
    const byPerson = new Map<string, any[]>();
    for (const e of entries) {
      if (!personIdSet.has(e.personId)) continue;
      const arr = byPerson.get(e.personId) ?? [];
      arr.push(e);
      byPerson.set(e.personId, arr);
    }

    const updated: { personId: string; firstIn: string; lastOut?: string }[] = [];

    for (const personId of personIds) {
      const arr = byPerson.get(personId);
      if (!arr || arr.length === 0) continue; // no activity today

      // Entries already ordered by time asc from the query
      const firstInEntry = arr.find((e) => e.type === "In");
      const firstIn = firstInEntry?.time ?? firstInEntry?.localTime;
      if (!firstIn) continue;

      // Determine clock-out: last entry of the day is "Out" → person has left
      const lastEntry = arr[arr.length - 1];
      const lastOut =
        lastEntry?.type === "Out"
          ? (lastEntry.time ?? lastEntry.localTime ?? undefined)
          : undefined;

      updated.push({ personId, firstIn, ...(lastOut ? { lastOut } : {}) });
    }

    console.log(
      `[jibble] TimeEntries today: ${entries.length} entries total,` +
      ` ${updated.length} mapped workers with activity`,
    );
    return { updated, invalidIds: [], failed: [] };

  } catch (err: any) {
    console.warn("[jibble] fetchActiveTimeEntries bulk failed:", err.message);
    // Treat all as temporarily failed — caller will preserve existing cache
    return { updated: [], invalidIds: [], failed: personIds };
  }
}

/** Normalise a single DailyTimesheetModel entry into a JibbleAttendanceRecord.
 *  The live Jibble API may use `firstIn`/`lastOut` (like TimesheetsSummary) OR
 *  `firstInTimestamp`/`lastOutTimestamp` — we try both field names so the
 *  attendance card never shows dashes due to a wrong property name. */
function normaliseDailyEntry(d: any, personId?: string): JibbleAttendanceRecord {
  // Clock-in: try both field name conventions
  const clockIn  = d.firstInTimestamp ?? d.firstIn  ?? d.clockIn  ?? d.startTime  ?? undefined;
  // Clock-out: try both field name conventions
  const clockOut = d.lastOutTimestamp  ?? d.lastOut  ?? d.clockOut ?? d.endTime    ?? undefined;

  return {
    personId,
    date:             d.date,
    firstInTimestamp: clockIn,
    lastOutTimestamp: clockOut,
    firstIn:          clockIn,   // alias read by WorkerDetail UI
    lastOut:          clockOut,  // alias read by WorkerDetail UI
    totalDuration:    extractDuration(d.trackedHours ?? d.workedDuration ?? d.trackedTime),
    status:           d.status,
  };
}

/** Fetch attendance (timesheet) records for a date range from the time-attendance service.
 *  Uses key-based OData access /Timesheets({personId}) when a personId is given, which
 *  returns a TimesheetModel with a `daily` array of DailyTimesheetModel entries.
 *  Falls back to list-based access when no personId is provided.
 *
 *  Query params: Jibble uses `from` / `to` (YYYY-MM-DD) for date range filtering.
 *  Confirmed against time-attendance.prod.jibble.io/v1/$metadata — same convention
 *  as /TimesheetsSummary which is known-working. */
export async function fetchAttendance(
  token: string,
  params?: { from?: string; to?: string; personId?: string },
): Promise<JibbleAttendanceRecord[]> {
  const qp: Record<string, string> = {};
  if (params?.from) qp["from"] = params.from;
  if (params?.to)   qp["to"]   = params.to;

  if (params?.personId) {
    // Key-based access returns a single TimesheetModel with a `daily` collection
    const data = await jibbleFetch(JIBBLE_ATTENDANCE, `/Timesheets(${params.personId})`, token, qp);
    const daily: any[] = data?.daily ?? data?.value ?? [];

    // Diagnostic log: on the first record, emit its keys so we can confirm field names
    if (daily.length > 0) {
      const sample = daily[0];
      console.log("[jibble] Timesheets daily record keys:", Object.keys(sample));
      console.log("[jibble] Timesheets daily record sample:", JSON.stringify(sample));
    }

    return daily.map((d) => normaliseDailyEntry(d, params.personId));
  }

  // No personId: list all timesheets (used for bulk sync)
  const data = await jibbleFetch(JIBBLE_ATTENDANCE, "/Timesheets", token, qp);
  const list = data?.value ?? data?.data ?? (Array.isArray(data) ? data : []);
  return (list as any[]).map((r) => {
    // The list endpoint wraps per-person records; each entry may have a `daily` array
    // or may be a flat DailyTimesheetModel directly.
    const daily0 = r.daily?.[0];
    const source = daily0 ?? r;
    const rec    = normaliseDailyEntry(source, r.personId ?? source.personId);
    // personId is on the outer wrapper when using the list endpoint
    return { ...rec, personId: r.personId ?? rec.personId };
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
