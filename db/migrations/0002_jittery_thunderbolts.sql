CREATE TYPE "public"."reminder_stage" AS ENUM('due_soon', 'due_today', 'overdue');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'statement_sent';--> statement-breakpoint
CREATE TABLE "invoice_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"stage" "reminder_stage" NOT NULL,
	"stage_key" varchar(80) NOT NULL,
	"to_email" varchar(320) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "reminders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "reminder_days_before" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "reminder_overdue_every_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "auto_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "last_reminder_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_reminders_stage_unique" ON "invoice_reminders" USING btree ("invoice_id","stage_key");--> statement-breakpoint
CREATE INDEX "invoice_reminders_business_idx" ON "invoice_reminders" USING btree ("business_id","sent_at");