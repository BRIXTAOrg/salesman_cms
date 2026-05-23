CREATE TABLE "eurofoam"."influencers" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_person_name" varchar(255),
	"contact_person_number" varchar(20),
	"email" varchar(255),
	"zone" varchar(120),
	"district" varchar(120),
	"area" varchar(120),
	"state" varchar(100),
	"pin_code" varchar(20),
	"address" varchar(500),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_verified" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "eurofoam"."instititions" (
	"id" serial PRIMARY KEY NOT NULL,
	"institution_name" varchar(255) NOT NULL,
	"contact_person_name" varchar(255),
	"contact_person_number" varchar(20),
	"email" varchar(255),
	"gst_no" varchar(50),
	"pan_no" varchar(50),
	"zone" varchar(120),
	"district" varchar(120),
	"area" varchar(120),
	"state" varchar(100),
	"pin_code" varchar(20),
	"address" varchar(500),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_verified" boolean DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "eurofoam"."permanent_journey_plans" RENAME COLUMN "site_id" TO "institution_id";--> statement-breakpoint
DROP INDEX "eurofoam"."idx_pjp_site_id";--> statement-breakpoint
ALTER TABLE "eurofoam"."daily_visit_reports" ADD COLUMN "customer_type" varchar(50);--> statement-breakpoint
ALTER TABLE "eurofoam"."daily_visit_reports" ADD COLUMN "institution_type" varchar(50);--> statement-breakpoint
ALTER TABLE "eurofoam"."daily_visit_reports" ADD COLUMN "influencer_type" varchar(50);--> statement-breakpoint
ALTER TABLE "eurofoam"."permanent_journey_plans" ADD COLUMN "influencer_id" integer;--> statement-breakpoint
CREATE INDEX "idx_influencer_verified_zone" ON "eurofoam"."influencers" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "idx_influencer_verified_district" ON "eurofoam"."influencers" USING btree ("district");--> statement-breakpoint
CREATE INDEX "idx_influencer_verified_pincode" ON "eurofoam"."influencers" USING btree ("pin_code");--> statement-breakpoint
CREATE INDEX "idx_institute_verified_zone" ON "eurofoam"."instititions" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "idx_institute_verified_district" ON "eurofoam"."instititions" USING btree ("district");--> statement-breakpoint
CREATE INDEX "idx_institute_verified_pincode" ON "eurofoam"."instititions" USING btree ("pin_code");--> statement-breakpoint
CREATE INDEX "idx_institute_verified_gst" ON "eurofoam"."instititions" USING btree ("gst_no");--> statement-breakpoint
ALTER TABLE "eurofoam"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "eurofoam"."instititions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "eurofoam"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_influencer_id_fkey" FOREIGN KEY ("influencer_id") REFERENCES "eurofoam"."influencers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_pjp_institution_id" ON "eurofoam"."permanent_journey_plans" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "idx_pjp_influencer_id" ON "eurofoam"."permanent_journey_plans" USING btree ("influencer_id");