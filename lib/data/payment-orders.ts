import { and, eq } from "drizzle-orm";

import { paymentOrders, type PaymentOrder } from "@/db/schema";
import { db } from "@/lib/db";

/** Online checkout attempts (see db/schema/payment-orders.ts). */

export async function createPaymentOrder(input: {
  businessId: string;
  invoiceId: string;
  provider: string;
  providerOrderId: string;
  amount: string;
  currency: string;
}): Promise<PaymentOrder> {
  const [row] = await db.insert(paymentOrders).values(input).returning();
  return row;
}

export async function findPaymentOrder(provider: string, providerOrderId: string): Promise<PaymentOrder | null> {
  const [row] = await db
    .select()
    .from(paymentOrders)
    .where(and(eq(paymentOrders.provider, provider), eq(paymentOrders.providerOrderId, providerOrderId)))
    .limit(1);
  return row ?? null;
}

export async function markPaymentOrder(id: string, status: PaymentOrder["status"], providerPaymentId?: string | null): Promise<void> {
  await db
    .update(paymentOrders)
    .set({ status, providerPaymentId: providerPaymentId ?? null, updatedAt: new Date() })
    .where(eq(paymentOrders.id, id));
}
