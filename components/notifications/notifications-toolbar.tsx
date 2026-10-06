"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, MailClock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { markAllNotificationsReadAction, runDueChecksAction } from "@/lib/actions/notifications";

interface NotificationsToolbarProps {
  unread: number;
}

/** Page-level actions: mark everything read, or run the due-date scan and reminder emails now. */
export function NotificationsToolbar({ unread }: NotificationsToolbarProps) {
  const router = useRouter();
  const [marking, startMarking] = useTransition();
  const [checking, startChecking] = useTransition();

  function markAllRead() {
    startMarking(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function runChecks() {
    startChecking(async () => {
      const result = await runDueChecksAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { sent, failed, skipped, notified } = result.data;
      const parts = [
        sent ? `${sent} reminder${sent === 1 ? "" : "s"} emailed` : null,
        failed ? `${failed} failed` : null,
        skipped ? `${skipped} skipped` : null,
        notified ? `${notified} new notification${notified === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      toast.success("Due-date check complete", { description: parts.length ? parts.join(" · ") : "Nothing is due today." });
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" onClick={runChecks} disabled={checking}>
        {checking ? <Spinner /> : <MailClock />} Check due invoices
      </Button>
      <Button variant="outline" onClick={markAllRead} disabled={marking || unread === 0}>
        {marking ? <Spinner /> : <CheckCheck />} Mark all as read
      </Button>
    </>
  );
}
