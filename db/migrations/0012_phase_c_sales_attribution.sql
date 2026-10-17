CREATE TYPE "public"."attribution_action" AS ENUM('proposed', 'reproposed', 'approved', 'rejected', 'reassigned');--> statement-breakpoint
CREATE TYPE "public"."attribution_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'attribution_pending' BEFORE 'invoice_paid';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'attribution_approved' BEFORE 'invoice_paid';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'attribution_rejected' BEFORE 'invoice_paid';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'attribution_reassigned' BEFORE 'invoice_paid';--> statement-breakpoint
CREATE TABLE "attribution_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"attribution_id" uuid NOT NULL,
	"action" "attribution_action" NOT NULL,
	"actor_user_id" uuid,
	"from_user_id" uuid,
	"to_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"credited_user_id" uuid NOT NULL,
	"assigned_by_user_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"status" "attribution_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"previous_credited_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attribution_events" ADD CONSTRAINT "attribution_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_events" ADD CONSTRAINT "attribution_events_attribution_id_sale_attributions_id_fk" FOREIGN KEY ("attribution_id") REFERENCES "public"."sale_attributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_events" ADD CONSTRAINT "attribution_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_events" ADD CONSTRAINT "attribution_events_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_events" ADD CONSTRAINT "attribution_events_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_attributions" ADD CONSTRAINT "sale_attributions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_attributions" ADD CONSTRAINT "sale_attributions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_attributions" ADD CONSTRAINT "sale_attributions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_attributions" ADD CONSTRAINT "sale_attributions_credited_user_id_users_id_fk" FOREIGN KEY ("credited_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_attributions" ADD CONSTRAINT "sale_attributions_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_attributions" ADD CONSTRAINT "sale_attributions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_attributions" ADD CONSTRAINT "sale_attributions_previous_credited_user_id_users_id_fk" FOREIGN KEY ("previous_credited_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attribution_events_attribution_idx" ON "attribution_events" USING btree ("attribution_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_attributions_invoice_unique" ON "sale_attributions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "sale_attributions_business_status_idx" ON "sale_attributions" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "sale_attributions_credited_idx" ON "sale_attributions" USING btree ("business_id","credited_user_id");