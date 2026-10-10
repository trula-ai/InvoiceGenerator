import {
  Bell,
  ChartColumn,
  ClipboardList,
  CreditCard,
  FileMinus,
  FilePen,
  FileText,
  History,
  LayoutDashboard,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Match the pathname exactly instead of by prefix. */
  exact?: boolean;
}

export const dashboardNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { title: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { title: "Clients", href: "/dashboard/clients", icon: Users },
  { title: "Items", href: "/dashboard/items", icon: Package },
  { title: "Quotes", href: "/dashboard/quotes", icon: FilePen },
  { title: "Invoices", href: "/dashboard/invoices", icon: FileText },
  { title: "Credit notes", href: "/dashboard/credit-notes", icon: FileMinus },
  { title: "Payments", href: "/dashboard/payments", icon: CreditCard },
  { title: "History", href: "/dashboard/history", icon: History },
  { title: "Records", href: "/dashboard/records", icon: ClipboardList },
  { title: "Reports", href: "/dashboard/reports", icon: ChartColumn },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
