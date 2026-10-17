CREATE TYPE "public"."receipt_delivery_status" AS ENUM('not_sent', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"receipt_number" varchar(40) NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"currency" char(3) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"method_label" varchar(40) NOT NULL,
	"reference" varchar(120),
	"invoice_number" varchar(40) NOT NULL,
	"invoice_date" date NOT NULL,
	"service_description" text,
	"invoice_total" numeric(14, 2) NOT NULL,
	"cumulative_paid" numeric(14, 2) NOT NULL,
	"balance_due" numeric(14, 2) NOT NULL,
	"due_date" date NOT NULL,
	"was_overdue" boolean DEFAULT false NOT NULL,
	"terms_text" text,
	"privacy_url" varchar(300),
	"terms_version" integer DEFAULT 0 NOT NULL,
	"pdf" "bytea",
	"pdf_generated_at" timestamp with time zone,
	"delivery_status" "receipt_delivery_status" DEFAULT 'not_sent' NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"last_sent_at" timestamp with time zone,
	"last_sent_to" varchar(320),
	"last_error" text,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "receipt_terms" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "receipt_privacy_url" varchar(300);--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "receipt_terms_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "receipt_requires_attribution" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_payment_unique" ON "receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "receipts_invoice_idx" ON "receipts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "receipts_business_issued_idx" ON "receipts" USING btree ("business_id","issued_at");--> statement-breakpoint
-- Receipts for payments verified before snapshots existed: cumulative and balance are rebuilt from the payment order.
WITH ordered AS (
  SELECT p.id, p.invoice_id,
    sum(p.amount) OVER (PARTITION BY p.invoice_id ORDER BY p.payment_date, p.created_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative
  FROM "payments" p
  WHERE p.status IN ('verified', 'reversed') AND p.receipt_number IS NOT NULL
)
INSERT INTO "receipts" ("business_id", "payment_id", "invoice_id", "receipt_number", "issued_at", "currency", "amount", "payment_date", "method_label", "reference",
  "invoice_number", "invoice_date", "service_description", "invoice_total", "cumulative_paid", "balance_due", "due_date", "was_overdue", "terms_version",
  "voided_at", "void_reason")
SELECT p.business_id, p.id, p.invoice_id, p.receipt_number, coalesce(p.reviewed_at, p.created_at), i.currency, p.amount, p.payment_date,
  CASE p.method WHEN 'bank_transfer' THEN 'Bank transfer' WHEN 'upi' THEN 'UPI' WHEN 'card' THEN 'Card' WHEN 'cash' THEN 'Cash' WHEN 'cheque' THEN 'Cheque' ELSE 'Other' END,
  p.reference, i.invoice_number, i.issue_date,
  (SELECT left(string_agg(split_part(ii.description, E'\n', 1), '; ' ORDER BY ii.sort_order), 500) FROM "invoice_items" ii WHERE ii.invoice_id = i.id),
  i.total, o.cumulative, greatest(i.total - i.credit_amount - o.cumulative, 0), i.due_date, false, 0,
  p.reversed_at, p.reversal_reason
FROM "payments" p
JOIN ordered o ON o.id = p.id
JOIN "invoices" i ON i.id = p.invoice_id
WHERE NOT EXISTS (SELECT 1 FROM "receipts" r WHERE r.payment_id = p.id);
