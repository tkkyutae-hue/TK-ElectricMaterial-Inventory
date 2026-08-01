// Jibble Time & Attendance API client (v2)
// Docs: https://api.jibble.io/v2
// Auth: Personal Access Token stored in app_settings under key "jibble_pat"

const JIBBLE_API = "https://api.jibble.io/v2";

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
  // API may return { value: [...] } or { data: [...] } or bare array
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

/** Test if a token is valid — returns basic organisation info */
export async function testJibbleToken(token: string): Promise<{ ok: boolean; orgName?: string }> {
  try {
    const data = await jibbleFetch("/organization", token);
    const orgName = data?.name ?? data?.value?.name ?? data?.data?.name;
    return { ok: true, orgName };
  } catch {
    return { ok: false };
  }
}
