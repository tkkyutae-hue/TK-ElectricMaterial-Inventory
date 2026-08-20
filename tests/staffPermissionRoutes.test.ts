import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { Express } from "express";
import { registerRoutes } from "../server/routes";
import { storage } from "../server/storage";
import { db } from "../server/db";
import { authStorage } from "../server/replit_integrations/auth/storage";
import { dailyWorkerAssignments, workers } from "../shared/schema";
import { canAccessCrewDispatchAssignment } from "../client/src/lib/role-access";

type Handler = (req: TestRequest, res: TestResponse, next: () => void) => unknown;
type Method = "get" | "post" | "put" | "patch" | "delete";

interface TestRequest {
  session: { userId?: string };
  params: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, unknown>;
  currentUser?: TestUser;
}

interface TestUser {
  id: string;
  role: "admin" | "manager" | "staff";
  status: "active";
  name: string;
}

class TestResponse {
  statusCode = 200;
  body: unknown;
  finished = false;

  status(statusCode: number) {
    this.statusCode = statusCode;
    return this;
  }

  json(body: unknown) {
    this.body = body;
    this.finished = true;
    return this;
  }

  send(body?: unknown) {
    this.body = body;
    this.finished = true;
    return this;
  }

  end(body?: unknown) {
    this.body = body;
    this.finished = true;
    return this;
  }

  set() {
    return this;
  }
}

class RouteRecorder {
  private readonly routes = new Map<string, Handler[]>();

  get(path: string, ...handlers: Handler[]) { this.add("get", path, handlers); return this; }
  post(path: string, ...handlers: Handler[]) { this.add("post", path, handlers); return this; }
  put(path: string, ...handlers: Handler[]) { this.add("put", path, handlers); return this; }
  patch(path: string, ...handlers: Handler[]) { this.add("patch", path, handlers); return this; }
  delete(path: string, ...handlers: Handler[]) { this.add("delete", path, handlers); return this; }
  use() { return this; }

  handlers(method: Method, path: string): Handler[] {
    const handlers = this.routes.get(`${method.toUpperCase()} ${path}`);
    assert.ok(handlers, `Expected ${method.toUpperCase()} ${path} to be registered`);
    return handlers;
  }

  private add(method: Method, path: string, handlers: Handler[]) {
    this.routes.set(`${method.toUpperCase()} ${path}`, handlers);
  }
}

async function invoke(handlers: Handler[], req: TestRequest): Promise<TestResponse> {
  const res = new TestResponse();

  async function run(index: number): Promise<void> {
    if (res.finished || index >= handlers.length) return;
    let nextPromise: Promise<void> | undefined;
    const next = () => {
      nextPromise = run(index + 1);
    };
    await handlers[index](req, res, next);
    await nextPromise;
  }

  await run(0);
  return res;
}

const ASSIGNED_PROJECT_ID = 101;
const UNASSIGNED_PROJECT_ID = 202;
const STAFF_USER_ID = "staff-user";
const MANAGER_USER_ID = "manager-user";
const ADMIN_USER_ID = "admin-user";

const usersById = new Map<string, TestUser>([
  [STAFF_USER_ID, { id: STAFF_USER_ID, role: "staff", status: "active", name: "Staff Tester" }],
  [MANAGER_USER_ID, { id: MANAGER_USER_ID, role: "manager", status: "active", name: "Manager Tester" }],
  [ADMIN_USER_ID, { id: ADMIN_USER_ID, role: "admin", status: "active", name: "Admin Tester" }],
]);

async function main() {
  const recorder = new RouteRecorder();
  const originalSetInterval = globalThis.setInterval;
  const originalAuthGetUser = authStorage.getUser;
  const originalAuthListUsers = authStorage.listUsers;
  const originalDbSelect = (db as any).select;
  const restoreStorage: Array<() => void> = [];
  let mutationCount = 0;

  function stubStorage(name: string, implementation: (...args: any[]) => unknown) {
    const target = storage as any;
    const hadOwnProperty = Object.prototype.hasOwnProperty.call(target, name);
    const previous = target[name];
    target[name] = implementation;
    restoreStorage.push(() => {
      if (hadOwnProperty) target[name] = previous;
      else delete target[name];
    });
  }

  try {
    authStorage.getUser = async (id: string) => usersById.get(id) as any;
    authStorage.listUsers = async () => Array.from(usersById.values()) as any;
    (db as any).select = () => ({
      from: (table: unknown) => {
        if (table === workers) {
          return { where: () => ({ limit: async () => [{ id: 1, linkedUserId: STAFF_USER_ID }] }) };
        }
        if (table === dailyWorkerAssignments) {
          return { where: async () => [{ projectId: ASSIGNED_PROJECT_ID }] };
        }
        throw new Error("Unexpected database read in staff permission test");
      },
    });

    stubStorage("getProject", async (id: number) => ({ id, name: `Project ${id}` }));
    stubStorage("getProjects", async () => [
      { id: ASSIGNED_PROJECT_ID, name: "Assigned project" },
      { id: UNASSIGNED_PROJECT_ID, name: "Unassigned project" },
    ]);
    stubStorage("getProjectProgress", async () => ({ total: 1, complete: 0 }));
    stubStorage("getScopeItems", async () => []);
    stubStorage("getCrewAssignmentsForProject", async () => []);
    stubStorage("getDailyReports", async (projectId: number) => [
      { id: projectId === ASSIGNED_PROJECT_ID ? 1 : 2, projectId, reportDate: "2026-08-19" },
    ]);
    stubStorage("getDailyReport", async (id: number) => ({
      id,
      projectId: id === 1 ? ASSIGNED_PROJECT_ID : UNASSIGNED_PROJECT_ID,
      reportDate: "2026-08-19",
    }));
    stubStorage("getDailyReportSummary", async () => [
      { projectId: ASSIGNED_PROJECT_ID, total: 1, draft: 1, submitted: 0, lastDate: "2026-08-19" },
      { projectId: UNASSIGNED_PROJECT_ID, total: 1, draft: 0, submitted: 1, lastDate: "2026-08-18" },
    ]);
    stubStorage("getAssignmentsByDate", async () => [
      { id: 1, workerId: 1, projectId: ASSIGNED_PROJECT_ID },
      { id: 2, workerId: 2, projectId: UNASSIGNED_PROJECT_ID },
    ]);
    stubStorage("getWorkers", async () => [
      { id: 1, linkedUserId: STAFF_USER_ID, fullName: "Staff Tester", trade: "Foreman", isActive: true },
      { id: 2, linkedUserId: null, fullName: "Other Worker", trade: "Foreman", isActive: true },
    ]);
    stubStorage("upsertAssignment", async () => { mutationCount++; return { id: 1 }; });
    stubStorage("setAppSetting", async () => { mutationCount++; });
    stubStorage("upsertKoreanAttendance", async () => { mutationCount++; return { id: 1 }; });

    // Register the production route handlers without opening a server or scheduling a background job.
    (globalThis as any).setInterval = () => ({ unref() {} });
    await registerRoutes({} as Server, recorder as unknown as Express);
    globalThis.setInterval = originalSetInterval;

    const request = (
      method: Method,
      path: string,
      userId: string,
      params: Record<string, string>,
      query: Record<string, string> = {},
      body: Record<string, unknown> = {},
    ) => invoke(recorder.handlers(method, path), {
      session: { userId },
      params,
      query,
      body,
    });

    const projectReadRoutes: Array<{
      path: string;
      params: (projectId: number) => Record<string, string>;
      query?: Record<string, string>;
    }> = [
      { path: "/api/daily-report-projects/:id", params: (id) => ({ id: String(id) }) },
      { path: "/api/projects/:id/progress", params: (id) => ({ id: String(id) }) },
      { path: "/api/projects/:id/scope-items", params: (id) => ({ id: String(id) }) },
      {
        path: "/api/projects/:id/crew-assignments",
        params: (id) => ({ id: String(id) }),
        query: { date: "2026-08-19" },
      },
    ];

    for (const route of projectReadRoutes) {
      const assigned = await request("get", route.path, STAFF_USER_ID, route.params(ASSIGNED_PROJECT_ID), route.query);
      assert.equal(assigned.statusCode, 200, `STAFF should read an assigned project at ${route.path}`);

      const unassigned = await request("get", route.path, STAFF_USER_ID, route.params(UNASSIGNED_PROJECT_ID), route.query);
      assert.equal(unassigned.statusCode, 403, `STAFF must not read an unassigned project at ${route.path}`);

      for (const userId of [MANAGER_USER_ID, ADMIN_USER_ID]) {
        const managerOrAdmin = await request("get", route.path, userId, route.params(UNASSIGNED_PROJECT_ID), route.query);
        assert.equal(managerOrAdmin.statusCode, 200, `${usersById.get(userId)?.role} should retain access at ${route.path}`);
      }
    }

    const projectList = await request("get", "/api/daily-report-projects", STAFF_USER_ID, {});
    assert.equal(projectList.statusCode, 200, "STAFF should load the Daily Report project list");
    assert.deepEqual((projectList.body as Array<{ id: number }>).map((project) => project.id), [ASSIGNED_PROJECT_ID],
      "STAFF must only receive assigned Daily Report projects");

    for (const userId of [MANAGER_USER_ID, ADMIN_USER_ID]) {
      const managerOrAdmin = await request("get", "/api/daily-report-projects", userId, {});
      assert.deepEqual((managerOrAdmin.body as Array<{ id: number }>).map((project) => project.id),
        [ASSIGNED_PROJECT_ID, UNASSIGNED_PROJECT_ID],
        `${usersById.get(userId)?.role} should retain the full Daily Report project list`);
    }

    const assignedReportList = await request(
      "get", "/api/daily-reports", STAFF_USER_ID, {}, { projectId: String(ASSIGNED_PROJECT_ID) },
    );
    assert.equal(assignedReportList.statusCode, 200, "STAFF should read reports for an assigned project");

    const unassignedReportList = await request(
      "get", "/api/daily-reports", STAFF_USER_ID, {}, { projectId: String(UNASSIGNED_PROJECT_ID) },
    );
    assert.equal(unassignedReportList.statusCode, 403, "STAFF must not read reports for an unassigned project");

    const assignedReport = await request("get", "/api/daily-reports/:id", STAFF_USER_ID, { id: "1" });
    assert.equal(assignedReport.statusCode, 200, "STAFF should read an assigned Daily Report");

    const unassignedReport = await request("get", "/api/daily-reports/:id", STAFF_USER_ID, { id: "2" });
    assert.equal(unassignedReport.statusCode, 403, "STAFF must not read an unassigned Daily Report");

    const staffSummary = await request("get", "/api/daily-reports-summary", STAFF_USER_ID, {});
    assert.equal(staffSummary.statusCode, 200, "STAFF should load their Daily Report summary");
    assert.deepEqual((staffSummary.body as Array<{ projectId: number }>).map((summary) => summary.projectId),
      [ASSIGNED_PROJECT_ID],
      "STAFF summaries must exclude unassigned projects");

    for (const userId of [MANAGER_USER_ID, ADMIN_USER_ID]) {
      const reportList = await request(
        "get", "/api/daily-reports", userId, {}, { projectId: String(UNASSIGNED_PROJECT_ID) },
      );
      assert.equal(reportList.statusCode, 200, `${usersById.get(userId)?.role} should retain unassigned report access`);

      const report = await request("get", "/api/daily-reports/:id", userId, { id: "2" });
      assert.equal(report.statusCode, 200, `${usersById.get(userId)?.role} should retain direct report access`);

      const summary = await request("get", "/api/daily-reports-summary", userId, {});
      assert.deepEqual((summary.body as Array<{ projectId: number }>).map((item) => item.projectId),
        [ASSIGNED_PROJECT_ID, UNASSIGNED_PROJECT_ID],
        `${usersById.get(userId)?.role} should retain the full Daily Report summary`);
    }

    const staffAssignments = await request(
      "get", "/api/crew-dispatch/assignments", STAFF_USER_ID, {}, { date: "2026-08-19" },
    );
    assert.equal(staffAssignments.statusCode, 200, "STAFF should load their crew dispatch assignment");
    assert.deepEqual((staffAssignments.body as Array<{ workerId: number }>).map((assignment) => assignment.workerId), [1],
      "STAFF must only receive their linked worker's crew assignments");

    for (const userId of [MANAGER_USER_ID, ADMIN_USER_ID]) {
      const managerOrAdmin = await request(
        "get", "/api/crew-dispatch/assignments", userId, {}, { date: "2026-08-19" },
      );
      assert.deepEqual((managerOrAdmin.body as Array<{ workerId: number }>).map((assignment) => assignment.workerId), [1, 2],
        `${usersById.get(userId)?.role} should retain the full crew dispatch list`);
    }

    const staffAudit = await request("get", "/api/workers/foreman-link-audit", STAFF_USER_ID, {}, {
      today: "2026-08-19",
      yesterday: "2026-08-18",
    });
    assert.equal(staffAudit.statusCode, 403, "STAFF must not access the foreman account-link audit");

    const managerAudit = await request("get", "/api/workers/foreman-link-audit", MANAGER_USER_ID, {}, {
      today: "2026-08-19",
      yesterday: "2026-08-18",
    });
    assert.equal(managerAudit.statusCode, 200, "Manager should access the foreman account-link audit");
    assert.deepEqual(
      (managerAudit.body as { foremen: Array<{ id: number; linkedUserId: string | null; todayProjectIds: number[] }> }).foremen
        .map((foreman) => ({ id: foreman.id, linkedUserId: foreman.linkedUserId, todayProjectIds: foreman.todayProjectIds })),
      [
        { id: 1, linkedUserId: STAFF_USER_ID, todayProjectIds: [ASSIGNED_PROJECT_ID] },
        { id: 2, linkedUserId: null, todayProjectIds: [UNASSIGNED_PROJECT_ID] },
      ],
      "Manager audit must expose each active foreman's explicit link and recent assignment count",
    );

    const protectedMutations: Array<{
      path: string;
      params: Record<string, string>;
      body: Record<string, unknown>;
    }> = [
      {
        path: "/api/crew-dispatch/assignments/:workerId",
        params: { workerId: "1" },
        body: { date: "2026-08-19", projectId: ASSIGNED_PROJECT_ID },
      },
      {
        path: "/api/crew-dispatch/layout-prefs",
        params: {},
        body: { groupOrder: [], collapsedGroups: [] },
      },
      {
        path: "/api/crew-dispatch/korean-attendance/:workerId",
        params: { workerId: "1" },
        body: { date: "2026-08-19", present: true },
      },
    ];

    for (const mutation of protectedMutations) {
      const before = mutationCount;
      const staff = await request("put", mutation.path, STAFF_USER_ID, mutation.params, {}, mutation.body);
      assert.equal(staff.statusCode, 403, `STAFF must not mutate ${mutation.path}`);
      assert.equal(mutationCount, before, `STAFF must not reach the ${mutation.path} handler`);

      for (const userId of [MANAGER_USER_ID, ADMIN_USER_ID]) {
        const managerOrAdmin = await request("put", mutation.path, userId, mutation.params, {}, mutation.body);
        assert.equal(managerOrAdmin.statusCode, 200, `${usersById.get(userId)?.role} should retain mutation access at ${mutation.path}`);
      }
    }

    assert.equal(canAccessCrewDispatchAssignment("staff"), false, "STAFF must be redirected from /crew-dispatch/assignment");
    assert.equal(canAccessCrewDispatchAssignment("manager"), true, "MANAGER may open /crew-dispatch/assignment");
    assert.equal(canAccessCrewDispatchAssignment("admin"), true, "ADMIN may open /crew-dispatch/assignment");

    console.log("Staff Daily Report and crew-dispatch permission checks passed.");
  } finally {
    globalThis.setInterval = originalSetInterval;
    authStorage.getUser = originalAuthGetUser;
    authStorage.listUsers = originalAuthListUsers;
    (db as any).select = originalDbSelect;
    for (const restore of restoreStorage.reverse()) restore();
  }
}

await main();