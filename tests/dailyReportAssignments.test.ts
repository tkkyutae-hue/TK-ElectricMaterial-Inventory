import assert from "node:assert/strict";
import {
  filterVisibleDailyReportProjects,
  groupRecentAssignedProjects,
  type DailyReportProjectLike,
} from "../client/src/pages/daily-report/projectAssignmentGrouping";

const projects: DailyReportProjectLike[] = [
  { id: 1, name: "Today only", status: "active" },
  { id: 2, name: "Yesterday only", status: "active" },
  { id: 3, name: "Both days", status: "active" },
  { id: 4, name: "Hidden completed assignment", status: "completed" },
  { id: 5, name: "Another worker's project", status: "active" },
];

const visibleProjects = filterVisibleDailyReportProjects(projects, {
  staffProjectIds: new Set([1, 2, 3, 4]),
  hiddenStatuses: new Set(["completed"]),
  search: "",
});

assert.deepEqual(
  visibleProjects.map((project) => project.id),
  [1, 2, 3],
  "staff visibility must exclude another worker's project and keep hidden statuses hidden",
);

const grouped = groupRecentAssignedProjects(
  visibleProjects,
  new Set([1, 3]),
  new Set([2, 3]),
);

assert.deepEqual(
  grouped.todayAssignedProjects.map((project) => project.id),
  [1, 3],
  "today assignments must appear first",
);
assert.deepEqual(
  grouped.yesterdayAssignedProjects.map((project) => project.id),
  [2],
  "a project assigned on both days must appear only in today's section",
);
assert.deepEqual(
  grouped.otherProjects.map((project) => project.id),
  [],
  "only accessible, non-hidden staff projects may be grouped",
);

console.log("PASS Daily Report: status filtering, staff scoping, and today/yesterday grouping");