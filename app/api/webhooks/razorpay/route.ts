import { NextResponse } from "next/server";

import { settleRazorpayPayment } from "@/lib/payments/checkout";
import { verifyWebhookSignature, webhookSecret, type RazorpayPayment } from "@/lib/payments/razorpay";

/**
 * POST /api/webhooks/razorpay
 *
 * Razorpay calls this for every event enabled on the webhook. Only
 * `payment.captured` is acted on: the payment is recorded against the invoice
 * its order belongs to, idempotently, so a client who closed the browser
 * before Checkout's success handler ran is still marked paid. Configure the
 * URL and the same secret as RAZORPAY_WEBHOOK_SECRET in the Razorpay dashboard.
 */
export const dynamic = "force-dynamic";

interface WebhookBody {
  event?: string;
  payload?: { payment?: { entity?: RazorpayPayment } };
}

export async function POST(request: Request) {
  if (!webhookSecret()) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });

  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.event !== "payment.captured" || !body.payload?.payment?.entity) {
    return NextResponse.json({ ok: true, ignored: body.event ?? "unknown" });
  }

  try {
    const result = await settleRazorpayPayment(body.payload.payment.entity);
    return NextResponse.json({ ok: true, recorded: !!result?.created, paymentId: result?.paymentId ?? null });
  } catch (error) {
    console.error("[razorpay webhook] failed:", error instanceof Error ? error.message : error);
    // 500 makes Razorpay retry later.
    return NextResponse.json({ error: "Could not record the payment" }, { status: 500 });
  }
}
