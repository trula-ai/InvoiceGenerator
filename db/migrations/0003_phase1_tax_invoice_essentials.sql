CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"hsn_sac" varchar(10),
	"unit" varchar(20),
	"unit_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "round_totals" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "signature_data_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "signatory_name" varchar(120);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "shipping_address" text;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "item_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "po_number" varchar(60);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "reference" varchar(120);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "ship_to_address" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "round_off_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_business_idx" ON "items" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "items_name_idx" ON "items" USING btree ("business_id","name");--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;