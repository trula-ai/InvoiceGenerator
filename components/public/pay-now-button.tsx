"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { confirmCheckoutAction, startCheckoutAction } from "@/lib/actions/public";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckout {
  open: () => void;
  on: (event: "payment.failed", handler: (r: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/**
 * "Pay now" on the public invoice page. Creates a Razorpay order on the
 * server, opens Razorpay Checkout (UPI, QR, cards, net banking, wallets as
 * enabled in the Razorpay dashboard), then confirms the signed result so the
 * payment is recorded and the page refreshes as paid.
 */
export function PayNowButton({ token, amountLabel }: { token: string; amountLabel: string }) {
  const router = useRouter();
  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && !!window.Razorpay);
  const [busy, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function pay() {
    startTransition(async () => {
      const started = await startCheckoutAction(token);
      if (!started.ok) {
        toast.error(started.error);
        return;
      }
      const s = started.data;
      if (!window.Razorpay) {
        toast.error("The payment window could not be loaded. Please try again.");
        return;
      }
      const checkout = new window.Razorpay({
        key: s.keyId,
        order_id: s.orderId,
        amount: s.amountMinor,
        currency: s.currency,
        name: s.businessName,
        description: s.description,
        prefill: s.prefill,
        theme: { color: "#18181b" },
        handler: (response: RazorpayResponse) => {
          setConfirming(true);
          confirmCheckoutAction(token, response)
            .then((result) => {
              if (result.ok) {
                toast.success("Payment received. Thank you!");
                router.refresh();
              } else {
                toast.error(result.error);
              }
            })
            .finally(() => setConfirming(false));
        },
        modal: { ondismiss: () => toast.message("Payment window closed. You can pay any time from this page.") },
      });
      checkout.on("payment.failed", (r) => toast.error(r.error?.description ?? "The payment did not go through."));
      checkout.open();
    });
  }

  return (
    <>
      <Script src={CHECKOUT_SRC} strategy="afterInteractive" onLoad={() => setScriptReady(true)} />
      <Button onClick={pay} disabled={busy || confirming || !scriptReady} size="lg">
        {busy || confirming ? <Spinner /> : <CreditCard />}
        {confirming ? "Confirming payment…" : `Pay ${amountLabel}`}
      </Button>
    </>
  );
}
