"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { NotificationList } from "@/components/notifications/notification-list";
import { fetchNotificationsAction, markAllNotificationsReadAction } from "@/lib/actions/notifications";
import type { NotificationItem } from "@/lib/notifications";

interface NotificationBellProps {
  /** Unread count rendered by the server so the badge is right on first paint. */
  initialUnread: number;
  className?: string;
}

/**
 * Header bell with an unread badge. Opens a right-hand panel listing the
 * latest notifications; the full feed lives at /dashboard/notifications.
 */
export function NotificationBell({ initialUnread, className }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, startLoading] = useTransition();
  const [marking, startMarking] = useTransition();

  // Adopt a fresh server-rendered count (after revalidation) without an effect.
  const [seenInitial, setSeenInitial] = useState(initialUnread);
  if (initialUnread !== seenInitial) {
    setSeenInitial(initialUnread);
    setUnread(initialUnread);
  }

  // Refresh the list every time the panel opens.
  useEffect(() => {
    if (!open) return;
    startLoading(async () => {
      const result = await fetchNotificationsAction(50);
      setItems(result.items);
      setUnread(result.unread);
    });
  }, [open]);

  function markAllRead() {
    startMarking(async () => {
      const result = await markAllNotificationsReadAction();
      if (result.ok) {
        setUnread(0);
        setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
      }
    });
  }

  const badge = unread > 99 ? "99+" : unread;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        onClick={() => setOpen(true)}
        className={cn("relative", className)}
      >
        <Bell className="size-[18px]" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
            {badge}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-5 py-4 pr-14">
            <SheetTitle className="text-lg font-semibold">Notifications</SheetTitle>
            <SheetDescription>{unread ? `${unread} unread` : "You're all caught up"}</SheetDescription>
          </SheetHeader>

          <div className="flex items-center justify-between gap-2 border-b px-5 py-2">
            <Button variant="ghost" size="sm" onClick={markAllRead} disabled={marking || unread === 0} className="-ml-2">
              {marking ? <Spinner /> : <CheckCheck />} Mark all as read
            </Button>
            <Button variant="link" size="sm" nativeButton={false} render={<Link href="/dashboard/notifications" onClick={() => setOpen(false)} />}>
              View all
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {items === null || (loading && items.length === 0) ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Spinner className="size-5" />
              </div>
            ) : (
              <NotificationList items={items} compact onNavigate={() => setOpen(false)} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
