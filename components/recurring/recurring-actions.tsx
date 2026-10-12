"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pause, Pencil, Play, PlayCircle, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { RecurringStatus } from "@/db/schema";
import { deleteRecurringAction, runRecurringNowAction, setRecurringStatusAction } from "@/lib/actions/recurring";

export function RecurringActions({ id, status, compact = false }: { id: string; status: RecurringStatus; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "Something went wrong");
    });
  }

  function generateNow() {
    startTransition(async () => {
      const result = await runRecurringNowAction(id);
      if (result.ok) {
        toast.success("Invoice generated");
        router.push(`/dashboard/invoices/${result.data.invoiceId}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const size = compact ? "sm" : "default";

  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" ? (
        <>
          <Button size={size} onClick={generateNow} disabled={pending} title="Create the next invoice right now">
            <PlayCircle /> Generate now
          </Button>
          <Button size={size} variant="outline" onClick={() => run(() => setRecurringStatusAction(id, "paused"), "Schedule paused")} disabled={pending}>
            <Pause /> Pause
          </Button>
        </>
      ) : null}
      {status !== "active" ? (
        <Button size={size} onClick={() => run(() => setRecurringStatusAction(id, "active"), "Schedule resumed")} disabled={pending}>
          <Play /> {status === "ended" ? "Restart" : "Resume"}
        </Button>
      ) : null}
      {!compact ? (
        <Button size={size} variant="outline" nativeButton={false} render={<Link href={`/dashboard/recurring/${id}/edit`} />}>
          <Pencil /> Edit schedule
        </Button>
      ) : null}
      {status !== "ended" && !compact ? (
        <Button size={size} variant="outline" onClick={() => run(() => setRecurringStatusAction(id, "ended"), "Schedule ended")} disabled={pending}>
          <Square /> End
        </Button>
      ) : null}
      {!compact ? (
        <AlertDialog>
          <AlertDialogTrigger render={<Button size={size} variant="destructive" disabled={pending} />}>
            <Trash2 /> Delete
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
              <AlertDialogDescription>Invoices already generated are kept. No further invoices will be created.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => run(() => deleteRecurringAction(id), "Schedule deleted")}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
