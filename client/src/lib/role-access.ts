export type ApplicationRole = "admin" | "manager" | "manager_viewer" | "staff" | "viewer";

function hasRole(role: string | null | undefined, allowedRoles: readonly ApplicationRole[]): boolean {
  return allowedRoles.includes(role as ApplicationRole);
}

export function isAdminRole(role: string | null | undefined): boolean {
  return hasRole(role, ["admin"]);
}

export function canAccessAdminMode(role: string | null | undefined): boolean {
  return hasRole(role, ["admin", "manager", "manager_viewer"]);
}

export function canAccessDailyReport(role: string | null | undefined): boolean {
  return hasRole(role, ["admin", "manager", "staff"]);
}

export function canAccessProjectOperations(role: string | null | undefined): boolean {
  return canAccessDailyReport(role);
}

export function isManagerOrAbove(role: string | null | undefined): boolean {
  return hasRole(role, ["admin", "manager"]);
}

export function canAccessCrewDispatchAssignment(role: string | null | undefined): boolean {
  return isManagerOrAbove(role);
}

export function canDoMovements(role: string | null | undefined): boolean {
  return hasRole(role, ["admin", "manager", "staff"]);
}