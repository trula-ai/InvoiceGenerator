CREATE TYPE "public"."supply_type" AS ENUM('domestic_intra_state', 'domestic_inter_state', 'export_lut', 'export_with_igst', 'international_taxable', 'exempt');--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "lut_number" varchar(40);--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "lut_valid_until" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "supply_type" "supply_type";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "lut_reference" varchar(40);--> statement-breakpoint
-- Invoices issued before explicit classification were taxed as domestic supplies; record that so documents keep printing the same treatment.
UPDATE "invoices" SET "supply_type" = CASE WHEN "is_inter_state" THEN 'domestic_inter_state'::supply_type ELSE 'domestic_intra_state'::supply_type END WHERE "gst_applied" = true AND "supply_type" IS NULL;
