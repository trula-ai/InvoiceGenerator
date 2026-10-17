CREATE TYPE "public"."payment_status" AS ENUM('pending', 'verified', 'rejected', 'reversed');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'payment_pending' BEFORE 'invoice_paid';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'payment_verified' BEFORE 'invoice_paid';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'payment_rejected' BEFORE 'invoice_paid';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'payment_reversed' BEFORE 'invoice_paid';--> statement-breakpoint
CREATE TABLE "payment_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"file_name" varchar(200) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "receipt_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "is_overdue" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "receiving_account" varchar(120);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "status" "payment_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "recorded_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reversed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reversed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reversal_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_evidence" ADD CONSTRAINT "payment_evidence_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_evidence" ADD CONSTRAINT "payment_evidence_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_evidence" ADD CONSTRAINT "payment_evidence_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_evidence_payment_idx" ON "payment_evidence" USING btree ("payment_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversed_by_user_id_users_id_fk" FOREIGN KEY ("reversed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_business_status_idx" ON "payments" USING btree ("business_id","status");--> statement-breakpoint
-- Payments recorded before verification existed already counted toward their invoices: keep them counted.
UPDATE "payments" SET "status" = 'verified' WHERE "status" = 'pending';--> statement-breakpoint
-- Overdue is now a flag beside the payment status, not a status of its own.
UPDATE "invoices" SET "is_overdue" = true, "status" = CASE WHEN "amount_paid" > 0 THEN 'partially_paid'::invoice_status ELSE 'pending'::invoice_status END WHERE "status" = 'overdue';--> statement-breakpoint
UPDATE "invoices" SET "is_overdue" = true WHERE "document_kind" = 'invoice' AND "status" IN ('pending', 'partially_paid') AND "balance_due" > 0 AND "due_date" < current_date;
