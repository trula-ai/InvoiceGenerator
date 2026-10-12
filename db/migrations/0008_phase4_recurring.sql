CREATE TYPE "public"."recurring_frequency" AS ENUM('weekly', 'fortnightly', 'monthly', 'quarterly', 'half_yearly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."recurring_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TABLE "recurring_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"frequency" "recurring_frequency" DEFAULT 'monthly' NOT NULL,
	"status" "recurring_status" DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"next_run_date" date NOT NULL,
	"end_date" date,
	"max_occurrences" integer,
	"occurrences" integer DEFAULT 0 NOT NULL,
	"auto_send" boolean DEFAULT true NOT NULL,
	"template" jsonb NOT NULL,
	"source_invoice_number" varchar(40),
	"currency" char(3) NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_invoice_id" uuid,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "recurring_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_profiles" ADD CONSTRAINT "recurring_profiles_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_profiles" ADD CONSTRAINT "recurring_profiles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_profiles_business_idx" ON "recurring_profiles" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "recurring_profiles_next_run_idx" ON "recurring_profiles" USING btree ("status","next_run_date");