ALTER TABLE "businesses" ADD COLUMN "reminder_schedule" varchar(80) DEFAULT '7,3,1' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "notify_owner" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Carry each business's existing "days before" setting into the new schedule (0 meant "none before the due date").
UPDATE "businesses" SET "reminder_schedule" = CASE WHEN "reminder_days_before" > 0 THEN "reminder_days_before"::text ELSE '' END;
