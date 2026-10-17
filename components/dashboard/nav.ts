import {
  BadgeCheck,
  Bell,
  CalendarClock,
  ChartColumn,
  ClipboardList,
  CreditCard,
  FileMinus,
  FilePen,
  FileText,
  History,
  LayoutDashboard,
  Package,
  Repeat,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Match the pathname exactly instead of by prefix. */
  exact?: boolean;
  /** Hidden from users whose roles do not grant this permission. Items without one are shown to every member. */
  permission?: Permission;
}

export const dashboardNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { title: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { title: "Clients", href: "/dashboard/clients", icon: Users, permission: "clients.view" },
  { title: "Items", href: "/dashboard/items", icon: Package, permission: "items.view" },
  { title: "Quotes", href: "/dashboard/quotes", icon: FilePen, permission: "invoices.view" },
  { title: "Invoices", href: "/dashboard/invoices", icon: FileText, permission: "invoices.view" },
  { title: "Credit notes", href: "/dashboard/credit-notes", icon: FileMinus, permission: "invoices.view" },
  { title: "Scheduled", href: "/dashboard/scheduled", icon: CalendarClock, permission: "invoices.view" },
  { title: "Recurring", href: "/dashboard/recurring", icon: Repeat, permission: "invoices.view" },
  { title: "Payments", href: "/dashboard/payments", icon: CreditCard, permission: "payments.view", exact: true },
  { title: "Verification", href: "/dashboard/payments/verification", icon: BadgeCheck, permission: "payments.verify" },
  { title: "History", href: "/dashboard/history", icon: History, permission: "payments.view" },
  { title: "Records", href: "/dashboard/records", icon: ClipboardList, permission: "invoices.view" },
  { title: "Reports", href: "/dashboard/reports", icon: ChartColumn, permission: "reports.view" },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Nav items the given permissions allow, in display order. */
export function visibleNav(permissions: readonly Permission[]): NavItem[] {
  return dashboardNav.filter((item) => !item.permission || permissions.includes(item.permission));
}
