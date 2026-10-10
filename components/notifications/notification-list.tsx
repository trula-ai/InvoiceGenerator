"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  BellOff,
  CalendarClock,
  CircleCheck,
  Clock,
  FileText,
  MailCheck,
  MailWarning,
  Send,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";

import type { NotificationKind } from "@/db/schema";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { markNotificationReadAction } from "@/lib/actions/notifications";
import { formatCurrency } from "@/lib/format";
import { groupNotificationsByDay, KIND_LABELS, SEVERITY_STYLES, timeLabel, type NotificationItem } from "@/lib/notifications";

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  invoice_issued: FileText,
  invoice_sent: Send,
  payment_received: Wallet,
  invoice_paid: CircleCheck,
  invoice_due_soon: Clock,
  invoice_due_today: CalendarClock,
  invoice_overdue: TriangleAlert,
  invoice_cancelled: Ban,
  reminder_sent: MailCheck,
  reminder_failed: MailWarning,
  statement_sent: Send,
  quote_accepted: CircleCheck,
  quote_declined: Ban,
  quote_converted: FileText,
  credit_note_issued: FileText,
};

interface NotificationCardProps {
  item: NotificationItem;
  compact?: boolean;
  /** Called after the card is clicked (e.g. to close the panel). */
  onNavigate?: () => void;
}

/** One light-tinted notification card. Clicking marks it read and opens the related record. */
export function NotificationCard({ item, compact = false, onNavigate }: NotificationCardProps) {
  const router = useRouter();
  const Icon = KIND_ICONS[item.kind];
  const styles = SEVERITY_STYLES[item.severity];

  function open() {
    if (!item.read) void markNotificationReadAction(item.id);
    onNavigate?.();
    if (item.href) router.push(item.href);
  }

  const meta = [item.clientName, item.invoiceNumber, item.amount ? formatCurrency(item.amount, item.currency ?? "INR") : null].filter(Boolean);

  return (
    <button
      type="button"
      onClick={open}
      aria-label={item.title}
      className={cn(
        "group relative flex w-full flex-col gap-1 rounded-xl border border-foreground/5 border-l-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        compact ? "px-3.5 py-3" : "px-4 py-3.5",
        styles.card,
        item.read && "opacity-80",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("size-3.5 shrink-0", styles.icon)} />
        <span className={cn("text-xs font-medium tracking-wide", styles.label)}>{KIND_LABELS[item.kind]}</span>
        {!item.read ? <span className="size-1.5 rounded-full bg-primary" aria-label="Unread" /> : null}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums" suppressHydrationWarning>
          {timeLabel(item.createdAt)}
        </span>
      </div>
      <p className={cn("text-sm leading-snug text-foreground", item.read ? "font-medium" : "font-semibold")}>{item.title}</p>
      <p className="text-sm leading-snug text-foreground/75">{item.body}</p>
      {meta.length ? <p className="mt-0.5 text-xs text-muted-foreground">{meta.join(" · ")}</p> : null}
    </button>
  );
}

interface NotificationListProps {
  items: NotificationItem[];
  compact?: boolean;
  onNavigate?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

/** Newest-first feed grouped under day headings (Today, Yesterday, weekday, then dates). */
export function NotificationList({
  items,
  compact = false,
  onNavigate,
  emptyTitle = "You're all caught up",
  emptyDescription = "Payment activity, due dates and reminders will appear here.",
}: NotificationListProps) {
  const groups = useMemo(() => groupNotificationsByDay(items), [items]);

  if (!items.length) {
    return (
      <Empty className={cn(!compact && "border")}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BellOff />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-4" : "gap-5")}>
      {groups.map((group) => (
        <section key={group.day} className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase" suppressHydrationWarning>
              {group.label}
            </h3>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-col gap-2">
            {group.items.map((item) => (
              <NotificationCard key={item.id} item={item} compact={compact} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
