CREATE TYPE "public"."notification_kind" AS ENUM('invoice_issued', 'invoice_sent', 'payment_received', 'invoice_paid', 'invoice_due_soon', 'invoice_due_today', 'invoice_overdue', 'invoice_cancelled', 'reminder_sent', 'reminder_failed');--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('info', 'success', 'warning', 'urgent');--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"severity" "notification_severity" DEFAULT 'info' NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"invoice_id" uuid,
	"invoice_number" varchar(40),
	"client_name" varchar(200),
	"amount" numeric(14, 2),
	"currency" char(3),
	"due_date" date,
	"href" varchar(300),
	"dedupe_key" varchar(120),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "logo_data_url" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "public_token" varchar(64);--> statement-breakpoint
UPDATE "invoices" SET "public_token" = translate(encode(sha256(("id"::text || clock_timestamp()::text || random()::text)::bytea), 'base64'), '+/=', '-_') WHERE "public_token" IS NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "public_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_business_created_idx" ON "notifications" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_unique" ON "notifications" USING btree ("business_id","dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_public_token_unique" ON "invoices" USING btree ("public_token");