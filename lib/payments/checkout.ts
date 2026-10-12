import "server-only";

import { eq } from "drizzle-orm";

import { invoices } from "@/db/schema";
import { getInvoiceDetailByToken, PAYABLE_STATUSES } from "@/lib/data/invoices";
import { createPaymentOrder, findPaymentOrder, markPaymentOrder } from "@/lib/data/payment-orders";
import { recordGatewayPayment } from "@/lib/data/payments";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/fiscal-year";
import { D, isPositive } from "@/lib/money";

import {
  createRazorpayOrder,
  describeRazorpayPayment,
  fetchRazorpayPayment,
  fromMinorUnits,
  isRazorpayConfigured,
  mapRazorpayMethod,
  razorpayKeyId,
  toMinorUnits,
  verifyCheckoutSignature,
  type RazorpayPayment,
} from "./razorpay";

/**
 * Online payment flow for the public invoice page.
 *
 *   1. startCheckout(token)     -> Razorpay order for the balance due
 *   2. browser opens Checkout   -> client pays by UPI / QR / card / net banking / wallet
 *   3. confirmCheckout(...)     -> signature verified, payment recorded
 *   4. webhook (payment.captured) -> same recording, in case the browser never
 *      reached step 3; idempotent on the Razorpay payment id.
 */

export interface CheckoutSession {
  keyId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  businessName: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
}

export async function startCheckout(token: string): Promise<CheckoutSession> {
  if (!isRazorpayConfigured()) throw new Error("Online payments are not set up for this business yet.");
  const detail = await getInvoiceDetailByToken(token);
  if (!detail) throw new Error("Invoice not found.");
  const { invoice, client, business } = detail;
  if (!business.onlinePaymentsEnabled) throw new Error("Online payments are turned off for this business.");
  if (invoice.documentKind !== "invoice" || !PAYABLE_STATUSES.includes(invoice.status) || !isPositive(invoice.balanceDue)) {
    throw new Error("This invoice has nothing left to pay.");
  }

  const amountMinor = toMinorUnits(invoice.balanceDue, invoice.currency);
  const order = await createRazorpayOrder({
    amountMinor,
    currency: invoice.currency,
    receipt: invoice.invoiceNumber,
    notes: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, businessId: business.id },
  });
  await createPaymentOrder({
    businessId: business.id,
    invoiceId: invoice.id,
    provider: "razorpay",
    providerOrderId: order.id,
    amount: invoice.balanceDue,
    currency: invoice.currency,
  });

  return {
    keyId: razorpayKeyId()!,
    orderId: order.id,
    amountMinor,
    currency: invoice.currency,
    businessName: business.name,
    description: `${invoice.invoiceNumber} · ${client.name}`,
    prefill: { name: client.contactName ?? client.name, email: client.email ?? "", contact: client.phone ?? "" },
  };
}

/**
 * Records a captured Razorpay payment against the invoice its order was
 * created for. Shared by the checkout callback and the webhook. Returns the
 * payment id, or null when the order is unknown or the payment is not captured.
 */
export async function settleRazorpayPayment(payment: RazorpayPayment): Promise<{ paymentId: string; created: boolean } | null> {
  if (payment.status !== "captured" || !payment.order_id) return null;
  const order = await findPaymentOrder("razorpay", payment.order_id);
  if (!order) return null;
  if (payment.currency !== order.currency) throw new Error("Payment currency does not match the order.");

  const amount = fromMinorUnits(payment.amount, payment.currency);
  // Never record more than the invoice still owes (Razorpay could capture a partial amount).
  const [inv] = await db.select({ balanceDue: invoices.balanceDue }).from(invoices).where(eq(invoices.id, order.invoiceId)).limit(1);
  if (!inv) return null;
  const capped = D(amount).greaterThan(D(inv.balanceDue)) ? inv.balanceDue : amount;

  const result = await recordGatewayPayment(order.businessId, {
    invoiceId: order.invoiceId,
    amount: capped,
    paymentDate: todayIso(),
    method: mapRazorpayMethod(payment.method),
    provider: "razorpay",
    providerPaymentId: payment.id,
    providerOrderId: payment.order_id,
    notes: describeRazorpayPayment(payment),
  });
  if (result.created) await markPaymentOrder(order.id, "paid", payment.id);
  return result;
}

export interface CheckoutConfirmation {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/** Verifies the Checkout success payload and records the payment. */
export async function confirmCheckout(token: string, c: CheckoutConfirmation): Promise<{ paymentId: string }> {
  if (!verifyCheckoutSignature(c.razorpay_order_id, c.razorpay_payment_id, c.razorpay_signature)) {
    throw new Error("Payment signature could not be verified.");
  }
  const detail = await getInvoiceDetailByToken(token);
  const order = await findPaymentOrder("razorpay", c.razorpay_order_id);
  if (!detail || !order || order.invoiceId !== detail.invoice.id) throw new Error("This payment does not belong to this invoice.");

  const payment = await fetchRazorpayPayment(c.razorpay_payment_id);
  const settled = await settleRazorpayPayment(payment);
  if (!settled) throw new Error(`Razorpay reports the payment as ${payment.status}; it will be recorded once it is captured.`);
  return { paymentId: settled.paymentId };
}
