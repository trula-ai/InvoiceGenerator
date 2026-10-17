/**
 * Role-based permissions.
 *
 * Pure module, safe to import from client and server code: no database, no
 * Next.js. The only place roles are translated into what a user may do is
 * `ROLE_PERMISSIONS` below; everything else asks `hasPermission(roles, ...)`.
 *
 * Roles mirror the actors in the billing requirements: the salesperson who
 * raises invoices and records payments, the sales manager who approves sale
 * attribution, the finance manager who verifies money received, and the
 * admin who runs the business settings and the team. A user may hold several
 * roles; `admin` implies every permission.
 */

export const USER_ROLES = ["admin", "sales_manager", "finance_manager", "salesperson"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  sales_manager: "Sales manager",
  finance_manager: "Finance manager",
  salesperson: "Salesperson",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Full access, including business settings, the item catalog and the team.",
  sales_manager: "Everything a salesperson can do, plus reports and approving who is credited for a sale.",
  finance_manager: "Records, verifies and reverses payments, sees reports and finance exports.",
  salesperson: "Manages clients, raises invoices and quotes, records payments and sends receipts.",
};

export const PERMISSIONS = [
  // Clients
  "clients.view",
  "clients.manage",
  // Item catalog
  "items.view",
  "items.manage",
  // Invoices, quotes, credit notes, schedules and installment plans
  "invoices.view",
  "invoices.create",
  "invoices.edit",
  "invoices.send",
  // Payments and receipts
  "payments.view",
  "payments.record",
  "payments.delete",
  "payments.verify",
  "receipts.send",
  // Sale attribution (used from the attribution phase onward)
  "attribution.assign",
  "attribution.approve",
  // Incentives (used from the incentive phase onward)
  "incentives.view",
  "incentives.manage",
  "incentives.configure",
  // Reporting
  "reports.view",
  // Administration
  "settings.manage",
  "team.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const SALESPERSON: Permission[] = [
  "clients.view",
  "clients.manage",
  "items.view",
  "invoices.view",
  "invoices.create",
  "invoices.edit",
  "invoices.send",
  "payments.view",
  "payments.record",
  "receipts.send",
  "attribution.assign",
];

const SALES_MANAGER: Permission[] = [...SALESPERSON, "attribution.approve", "incentives.view", "incentives.manage", "reports.view"];

const FINANCE_MANAGER: Permission[] = [
  "clients.view",
  "items.view",
  "invoices.view",
  "invoices.create",
  "invoices.edit",
  "invoices.send",
  "payments.view",
  "payments.record",
  "payments.delete",
  "payments.verify",
  "receipts.send",
  "incentives.view",
  "reports.view",
];

/** What each role may do. `admin` gets every permission. */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  sales_manager: SALES_MANAGER,
  finance_manager: FINANCE_MANAGER,
  salesperson: SALESPERSON,
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/** Union of the permissions granted by a set of roles, in `PERMISSIONS` order. */
export function permissionsForRoles(roles: readonly UserRole[]): Permission[] {
  const granted = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) granted.add(permission);
  }
  return PERMISSIONS.filter((p) => granted.has(p));
}

export function hasPermission(roles: readonly UserRole[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
}

/** Human-readable role list, e.g. "Sales manager · Finance manager". */
export function describeRoles(roles: readonly UserRole[]): string {
  if (roles.length === 0) return "No role";
  return USER_ROLES.filter((r) => roles.includes(r))
    .map((r) => ROLE_LABELS[r])
    .join(" · ");
}

/** Short explanation shown when an action is refused. */
export function permissionDeniedMessage(permission: Permission): string {
  const labels: Partial<Record<Permission, string>> = {
    "clients.manage": "add or change clients",
    "items.manage": "change the item catalog",
    "invoices.create": "create documents",
    "invoices.edit": "change documents",
    "invoices.send": "send emails",
    "payments.record": "record payments",
    "payments.delete": "delete payments",
    "payments.verify": "verify payments",
    "receipts.send": "send receipts",
    "attribution.assign": "assign sale credit",
    "attribution.approve": "approve sale attribution",
    "incentives.manage": "change incentive calculations",
    "incentives.configure": "configure incentive rules",
    "reports.view": "view reports",
    "settings.manage": "change business settings",
    "team.manage": "manage the team",
  };
  const what = labels[permission] ?? `do this (${permission})`;
  return `You do not have permission to ${what}. Ask an admin to change your role.`;
}
