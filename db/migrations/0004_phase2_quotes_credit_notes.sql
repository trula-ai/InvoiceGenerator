CREATE TYPE "public"."document_kind" AS ENUM('invoice', 'quote', 'credit_note');--> statement-breakpoint
ALTER TYPE "public"."counter_kind" ADD VALUE 'quote';--> statement-breakpoint
ALTER TYPE "public"."counter_kind" ADD VALUE 'credit_note';--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'accepted';--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'declined';--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'expired';--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'converted';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'quote_accepted';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'quote_declined';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'quote_converted';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'credit_note_issued';--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "quote_prefix" varchar(10) DEFAULT 'QT' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "credit_note_prefix" varchar(10) DEFAULT 'CN' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "quote_validity_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "document_kind" "document_kind" DEFAULT 'invoice' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "source_document_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "converted_to_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "credit_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_source_document_id_invoices_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_converted_to_id_invoices_id_fk" FOREIGN KEY ("converted_to_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_business_kind_idx" ON "invoices" USING btree ("business_id","document_kind");--> statement-breakpoint
CREATE INDEX "invoices_source_idx" ON "invoices" USING btree ("source_document_id");