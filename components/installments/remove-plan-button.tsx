"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import { deleteInstallmentPlanAction } from "@/lib/actions/installments";

export function RemovePlanButton({ invoiceId, size = "sm" }: { invoiceId: string; size?: "sm" | "default" }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" size={size} disabled={pending} />}>
        <Trash2 /> Remove plan
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove the installment plan?</AlertDialogTitle>
          <AlertDialogDescription>
            The invoice goes back to a single due date (the last installment&rsquo;s date). Payments already recorded are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep plan</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              startTransition(async () => {
                const result = await deleteInstallmentPlanAction(invoiceId);
                if (result.ok) {
                  toast.success("Installment plan removed");
                  router.push(`/dashboard/invoices/${invoiceId}`);
                } else {
                  toast.error(result.error);
                }
              })
            }
          >
            Remove plan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
