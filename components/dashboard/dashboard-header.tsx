"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings, User } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { dashboardNav, isNavItemActive } from "@/components/dashboard/nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { AppearanceMenuSection } from "@/components/theme/appearance-menu-section";
import { logoutAction } from "@/lib/actions/auth";
import { getInitials } from "@/lib/format";

interface DashboardHeaderProps {
  workspaceName: string;
  user: { name: string; email: string };
  /** Unread notification count for the bell badge. */
  unreadNotifications?: number;
}

export function DashboardHeader({ workspaceName, user, unreadNotifications = 0 }: DashboardHeaderProps) {
  const pathname = usePathname();
  const current = dashboardNav.find((item) => isNavItemActive(item, pathname));
  const title = current?.title ?? "Dashboard";

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink render={<Link href="/dashboard" />} className="capitalize">{workspaceName}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <span className="text-sm font-medium sm:hidden">{title}</span>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <GlobalSearch className="hidden md:flex" />
        <NotificationBell initialUnread={unreadNotifications} />

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-1.5" aria-label="Account menu" />}>
            <Avatar size="sm">
              <AvatarFallback>{getInitials(user.name) || <User className="size-3.5" />}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium lg:inline">{user.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
                <span className="text-sm font-medium text-foreground">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
                <Settings /> Business settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <AppearanceMenuSection />
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => logoutAction()}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
