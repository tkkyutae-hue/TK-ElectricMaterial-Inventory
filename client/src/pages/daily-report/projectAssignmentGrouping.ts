export interface DailyReportProjectLike {
  id: number;
  status?: string | null;
  name: string;
}

interface DailyReportProjectFilter<T extends DailyReportProjectLike> {
  staffProjectIds: Set<number> | null;
  hiddenStatuses: Set<string>;
  search: string;
  matchesSearch?: (project: T, normalizedSearch: string) => boolean;
}

export function filterVisibleDailyReportProjects<T extends DailyReportProjectLike>(
  projects: T[],
  { staffProjectIds, hiddenStatuses, search, matchesSearch }: DailyReportProjectFilter<T>,
): T[] {
  const query = search.trim().toLowerCase();

  return projects.filter((project) => {
    if (staffProjectIds && !staffProjectIds.has(project.id)) return false;
    if (hiddenStatuses.has((project.status ?? "").toLowerCase())) return false;
    if (!query) return true;

    return matchesSearch
      ? matchesSearch(project, query)
      : project.name.toLowerCase().includes(query);
  });
}

export function groupRecentAssignedProjects<T extends { id: number }>(
  projects: T[],
  todayProjectIds: Set<number>,
  yesterdayProjectIds: Set<number>,
): { todayAssignedProjects: T[]; yesterdayAssignedProjects: T[]; otherProjects: T[] } {
  const todayAssignedProjects: T[] = [];
  const yesterdayAssignedProjects: T[] = [];
  const otherProjects: T[] = [];

  projects.forEach((project) => {
    if (todayProjectIds.has(project.id)) todayAssignedProjects.push(project);
    else if (yesterdayProjectIds.has(project.id)) yesterdayAssignedProjects.push(project);
    else otherProjects.push(project);
  });

  return { todayAssignedProjects, yesterdayAssignedProjects, otherProjects };
}