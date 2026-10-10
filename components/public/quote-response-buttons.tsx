"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { respondToQuotePublicAction } from "@/lib/actions/public";

/** Accept / decline controls on the public quote page. */
export function QuoteResponseButtons({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<"accepted" | "declined" | null>(null);

  function respond(decision: "accepted" | "declined") {
    setChoice(decision);
    startTransition(async () => {
      const result = await respondToQuotePublicAction(token, decision);
      if (result.ok) {
        toast.success(decision === "accepted" ? "Thank you, the quote has been accepted." : "The quote has been declined.");
        router.refresh();
      } else {
        toast.error(result.error);
        setChoice(null);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => respond("accepted")} disabled={pending}>
        {pending && choice === "accepted" ? <Spinner /> : <Check />} Accept quote
      </Button>
      <Button variant="outline" onClick={() => respond("declined")} disabled={pending}>
        {pending && choice === "declined" ? <Spinner /> : <X />} Decline
      </Button>
    </div>
  );
}
