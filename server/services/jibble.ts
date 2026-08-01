// Jibble Time & Attendance API client (v2)
// Auth: OAuth2 Client Credentials flow
//   POST https://id.prod.jibble.io/connect/token
//   grant_type=client_credentials&client_id=...&client_secret=...
// The resulting access_token is cached in app_settings with its expiry.

const JIBBLE_API      = "https://api.jibble.io/v2";
const JIBBLE_TOKEN_URL = "https://id.prod.jibble.io/connect/token";

// ─── OAuth2 token exchange ────────────────────────────────────────────────────

export async function exchangeClientCredentials(
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  // Jibble's IdentityServer4 expects credentials as Basic Auth header,
  // not in the request body.
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "client_credentials" });

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
// Pass the storage instance so we can read/write app_settings.

export async function getJibbleToken(storage: {
  getAppSetting: (key: string) => Promise<string | null | undefined>;
  setAppSetting: (key: string, value: string | null) => Promise<void>;
}): Promise<string> {
  // Check cached token
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

export async function jibbleFetch(
  path: string,
  token: string,
  params?: Record<string, string>,
): Promise<any> {
  const url = new URL(JIBBLE_API + path);
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
  uid: string;
  name: string;
  employeeNumber?: string;
  email?: string;
  status?: string;
  photoUrl?: string;
}

export interface JibbleTimeEntry {
  id: string;
  personUid: string;
  startTime: string;       // ISO timestamp
  endTime: string | null;  // null = still clocked in
  duration?: number;       // seconds
  faceVerified?: boolean;
  imageUrl?: string;
  activity?: string;
}

export interface JibbleAttendanceRecord {
  id: string;
  personUid: string;
  date: string;            // YYYY-MM-DD
  firstIn?: string;        // ISO timestamp
  lastOut?: string;        // ISO timestamp
  totalDuration?: number;  // seconds
  status?: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

/** Fetch all active team members */
export async function fetchJibbleMembers(token: string): Promise<JibblePerson[]> {
  const data = await jibbleFetch("/people", token);
  const list = data?.value ?? data?.data ?? (Array.isArray(data) ? data : []);
  return list as JibblePerson[];
}

/** Fetch currently clocked-in time entries */
export async function fetchActiveTimeEntries(token: string): Promise<JibbleTimeEntry[]> {
  const data = await jibbleFetch("/timesheets", token, { status: "active" });
  const list = data?.value ?? data?.data ?? (Array.isArray(data) ? data : []);
  return list as JibbleTimeEntry[];
}

/** Fetch attendance records for a date range */
export async function fetchAttendance(
  token: string,
  params?: { from?: string; to?: string; personUid?: string },
): Promise<JibbleAttendanceRecord[]> {
  const qp: Record<string, string> = {};
  if (params?.from)      qp["from"] = params.from;
  if (params?.to)        qp["to"]   = params.to;
  if (params?.personUid) qp["personUid"] = params.personUid;

  const data = await jibbleFetch("/attendance", token, qp);
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
      const data = await jibbleFetch("/organization", accessToken);
      const orgName = data?.name ?? data?.value?.name ?? data?.data?.name;
      return { ok: true, orgName };
    } catch {
      // Token worked (exchange succeeded) even if /organization endpoint differs
      return { ok: true };
    }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "인증 실패" };
  }
}
