import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { D } from "@/lib/money";

/**
 * Razorpay integration, server side only.
 *
 * Configured through environment variables (see .env.example):
 *   RAZORPAY_KEY_ID         public key, also handed to Checkout in the browser
 *   RAZORPAY_KEY_SECRET     signs orders and verifies checkout signatures
 *   RAZORPAY_WEBHOOK_SECRET verifies webhook deliveries (optional but recommended)
 *
 * Uses Razorpay's REST API directly with Basic auth, so no SDK is bundled.
 * Checkout itself (UPI, QR, cards, net banking, wallets, EMI) is rendered by
 * Razorpay's hosted script in the client's browser; which methods appear is
 * controlled in the Razorpay dashboard.
 */

const API_BASE = "https://api.razorpay.com/v1";

export function razorpayKeyId(): string | undefined {
  return process.env.RAZORPAY_KEY_ID?.trim() || undefined;
}

function keySecret(): string | undefined {
  return process.env.RAZORPAY_KEY_SECRET?.trim() || undefined;
}

export function webhookSecret(): string | undefined {
  return process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || undefined;
}

export function isRazorpayConfigured(): boolean {
  return !!(razorpayKeyId() && keySecret());
}

/** Zero-decimal currencies have no minor unit; everything Razorpay supports otherwise uses 100 subunits. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "HUF", "XOF", "XAF"]);

/** "1875.00" INR -> 187500 paise. */
export function toMinorUnits(amount: string, currency: string): number {
  const factor = ZERO_DECIMAL.has(currency) ? 1 : 100;
  return D(amount).times(factor).toDecimalPlaces(0).toNumber();
}

/** 187500 paise -> "1875.00". */
export function fromMinorUnits(minor: number, currency: string): string {
  const factor = ZERO_DECIMAL.has(currency) ? 1 : 100;
  return D(minor).div(factor).toFixed(2);
}

function authHeader(): string {
  const id = razorpayKeyId();
  const secret = keySecret();
  if (!id || !secret) throw new Error("Razorpay is not configured.");
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { authorization: authHeader(), "content-type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!response.ok) {
    throw new Error(body?.error?.description ?? `Razorpay request failed (${response.status}).`);
  }
  return body;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

export async function createRazorpayOrder(input: { amountMinor: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<RazorpayOrder> {
  return api<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount: input.amountMinor, currency: input.currency, receipt: input.receipt.slice(0, 40), notes: input.notes }),
  });
}

export interface RazorpayPayment {
  id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  /** "upi" | "card" | "netbanking" | "wallet" | "emi" | ... */
  method?: string;
  email?: string;
  contact?: string;
  vpa?: string;
  bank?: string;
  wallet?: string;
  card?: { network?: string; last4?: string };
  notes?: Record<string, string>;
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  return api<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Checkout success handler signature: HMAC-SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = keySecret();
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC-SHA256(raw body, webhook_secret) in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = webhookSecret();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

/** Maps Razorpay's method names onto the app's payment_method enum. */
export function mapRazorpayMethod(method: string | undefined): "upi" | "card" | "bank_transfer" | "other" {
  switch (method) {
    case "upi":
      return "upi";
    case "card":
    case "emi":
      return "card";
    case "netbanking":
      return "bank_transfer";
    default:
      return "other";
  }
}

/** One-line description of how the client paid, kept on the payment as notes. */
export function describeRazorpayPayment(p: RazorpayPayment): string {
  const parts = [`Razorpay ${p.method ?? "payment"}`];
  if (p.vpa) parts.push(p.vpa);
  if (p.bank) parts.push(p.bank);
  if (p.wallet) parts.push(p.wallet);
  if (p.card?.network || p.card?.last4) parts.push(`${p.card.network ?? "card"} ****${p.card.last4 ?? ""}`.trim());
  return parts.join(" · ");
}
