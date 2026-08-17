ALTER SCHEMA "kamdhenu" RENAME TO "salesapp";
--> statement-breakpoint
CREATE TABLE "salesapp"."distributors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" varchar(255) NOT NULL,
	"concerned_person_name" varchar(255) NOT NULL,
	"concerned_person_phone_num" varchar(50) NOT NULL,
	"area" varchar(120),
	"zone" varchar(120),
	"state" varchar(100),
	"district" varchar(120),
	"city" varchar(120),
	"address" varchar(500) NOT NULL,
	"pin_code" varchar(20),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"gst_number" varchar(50),
	"store_image" varchar(500),
	"date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salesapp"."outlets" (
	"id" serial PRIMARY KEY NOT NULL,
	"distributor_id" integer,
	"user_id" integer,
	"name" varchar(255) NOT NULL,
	"concerned_person_name" varchar(255) NOT NULL,
	"concerned_person_phone_num" varchar(50) NOT NULL,
	"area" varchar(120),
	"zone" varchar(120),
	"state" varchar(100),
	"district" varchar(120),
	"city" varchar(120),
	"address" varchar(500) NOT NULL,
	"pin_code" varchar(20),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"gst_number" varchar(50),
	"store_image" varchar(500),
	"date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salesapp"."daily_visit_reports" DROP CONSTRAINT "daily_visit_reports_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."daily_visit_reports" DROP CONSTRAINT "daily_visit_reports_pjp_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."daily_visit_reports" DROP CONSTRAINT "daily_visit_reports_dealer_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."geo_tracking" DROP CONSTRAINT "geo_tracking_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."geo_tracking" DROP CONSTRAINT "geo_tracking_journey_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."geo_tracking" DROP CONSTRAINT "geo_tracking_dealer_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."journey_breadcrumbs" DROP CONSTRAINT "journey_breadcrumbs_journey_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."journey_ops" DROP CONSTRAINT "fk_journey_ops_user";
--> statement-breakpoint
ALTER TABLE "salesapp"."journey_ops" DROP CONSTRAINT "fk_journey_ops_journey";
--> statement-breakpoint
ALTER TABLE "salesapp"."journeys" DROP CONSTRAINT "journeys_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."journeys" DROP CONSTRAINT "journeys_pjp_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."journeys" DROP CONSTRAINT "journeys_dealer_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."permanent_journey_plans" DROP CONSTRAINT "permanent_journey_plans_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."permanent_journey_plans" DROP CONSTRAINT "permanent_journey_plans_created_by_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."permanent_journey_plans" DROP CONSTRAINT "permanent_journey_plans_dealer_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."permanent_journey_plans" DROP CONSTRAINT "permanent_journey_plans_institution_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."permanent_journey_plans" DROP CONSTRAINT "permanent_journey_plans_influencer_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."salesman_attendance" DROP CONSTRAINT "salesman_attendance_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."salesman_leave_applications" DROP CONSTRAINT "salesman_leave_applications_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."ta_da_bill_items" DROP CONSTRAINT "ta_da_bill_items_bill_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."ta_da_bills" DROP CONSTRAINT "ta_da_bills_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."user_roles" DROP CONSTRAINT "user_roles_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."user_roles" DROP CONSTRAINT "user_roles_role_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."users" DROP CONSTRAINT "users_reports_to_id_fkey";
--> statement-breakpoint
ALTER TABLE "salesapp"."dealers" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "salesapp"."influencers" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "salesapp"."instititions" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "salesapp"."distributors" ADD CONSTRAINT "distributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."outlets" ADD CONSTRAINT "outlets_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "salesapp"."distributors"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."outlets" ADD CONSTRAINT "outlets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_pjp_id_fkey" FOREIGN KEY ("pjp_id") REFERENCES "salesapp"."permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "salesapp"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."dealers" ADD CONSTRAINT "dealers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."geo_tracking" ADD CONSTRAINT "geo_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."geo_tracking" ADD CONSTRAINT "geo_tracking_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "salesapp"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."geo_tracking" ADD CONSTRAINT "geo_tracking_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "salesapp"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."influencers" ADD CONSTRAINT "influencers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."instititions" ADD CONSTRAINT "institutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."journey_breadcrumbs" ADD CONSTRAINT "journey_breadcrumbs_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "salesapp"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."journey_ops" ADD CONSTRAINT "fk_journey_ops_user" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."journey_ops" ADD CONSTRAINT "fk_journey_ops_journey" FOREIGN KEY ("journey_id") REFERENCES "salesapp"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."journeys" ADD CONSTRAINT "journeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."journeys" ADD CONSTRAINT "journeys_pjp_id_fkey" FOREIGN KEY ("pjp_id") REFERENCES "salesapp"."permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."journeys" ADD CONSTRAINT "journeys_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "salesapp"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "salesapp"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "salesapp"."dealers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "salesapp"."instititions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_influencer_id_fkey" FOREIGN KEY ("influencer_id") REFERENCES "salesapp"."influencers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."salesman_attendance" ADD CONSTRAINT "salesman_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."salesman_leave_applications" ADD CONSTRAINT "salesman_leave_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesapp"."ta_da_bill_items" ADD CONSTRAINT "ta_da_bill_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "salesapp"."ta_da_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."ta_da_bills" ADD CONSTRAINT "ta_da_bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "salesapp"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."users" ADD CONSTRAINT "users_reports_to_id_fkey" FOREIGN KEY ("reports_to_id") REFERENCES "salesapp"."users"("id") ON DELETE set null ON UPDATE cascade;