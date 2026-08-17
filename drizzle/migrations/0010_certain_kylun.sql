CREATE TABLE "salesapp"."companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"office_address" text NOT NULL,
	"contact_number" varchar(50) NOT NULL,
	"state" varchar(100),
	"district" varchar(100),
	"city" varchar(100),
	"is_head_office" boolean DEFAULT true NOT NULL,
	"admin_user_id" integer NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "salesapp"."mobile_capabilities" (
	"company_id" integer,
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(120) NOT NULL,
	"title" varchar(160) NOT NULL,
	"type" varchar(50) NOT NULL,
	"description" text,
	"icon" varchar(80),
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salesapp"."user_mobile_capabilities" (
	"company_id" integer,
	"user_id" integer NOT NULL,
	"capability_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_mobile_capabilities_user_id_capability_id_pk" PRIMARY KEY("user_id","capability_id")
);
--> statement-breakpoint
ALTER TABLE "salesapp"."daily_visit_reports" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."dealers" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."distributors" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."geo_tracking" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."influencers" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."instititions" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."journey_breadcrumbs" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."journey_ops" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."journeys" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."outlets" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."permanent_journey_plans" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."roles" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."salesman_attendance" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."salesman_leave_applications" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."sync_state" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."ta_da_bill_items" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."ta_da_bills" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."user_roles" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."users" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "salesapp"."users" ADD COLUMN "display_name" varchar(160);--> statement-breakpoint
ALTER TABLE "salesapp"."users" ADD COLUMN "department" varchar(160);--> statement-breakpoint
ALTER TABLE "salesapp"."users" ADD COLUMN "designation" varchar(160);--> statement-breakpoint
ALTER TABLE "salesapp"."users" ADD COLUMN "sales_app_password_hash" text;--> statement-breakpoint
ALTER TABLE "salesapp"."mobile_capabilities" ADD CONSTRAINT "mobile_capabilities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."user_mobile_capabilities" ADD CONSTRAINT "user_mobile_capabilities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."user_mobile_capabilities" ADD CONSTRAINT "user_mobile_capabilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "salesapp"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."user_mobile_capabilities" ADD CONSTRAINT "user_mobile_capabilities_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "salesapp"."mobile_capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_admin_user_id_key" ON "salesapp"."companies" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "idx_mobile_capabilities_company_id" ON "salesapp"."mobile_capabilities" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_capabilities_key_key" ON "salesapp"."mobile_capabilities" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_user_mobile_capabilities_company_id" ON "salesapp"."user_mobile_capabilities" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "salesapp"."daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."dealers" ADD CONSTRAINT "dealers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."distributors" ADD CONSTRAINT "distributors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."geo_tracking" ADD CONSTRAINT "geo_tracking_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."influencers" ADD CONSTRAINT "influencers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."instititions" ADD CONSTRAINT "instititions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."journey_breadcrumbs" ADD CONSTRAINT "journey_breadcrumbs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."journey_ops" ADD CONSTRAINT "journey_ops_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."journeys" ADD CONSTRAINT "journeys_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."outlets" ADD CONSTRAINT "outlets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."roles" ADD CONSTRAINT "roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."salesman_attendance" ADD CONSTRAINT "salesman_attendance_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."salesman_leave_applications" ADD CONSTRAINT "salesman_leave_applications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."sync_state" ADD CONSTRAINT "sync_state_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."ta_da_bill_items" ADD CONSTRAINT "ta_da_bill_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."ta_da_bills" ADD CONSTRAINT "ta_da_bills_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."user_roles" ADD CONSTRAINT "user_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesapp"."users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "salesapp"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_daily_visit_reports_company_id" ON "salesapp"."daily_visit_reports" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_dealers_company_id" ON "salesapp"."dealers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_distributors_company_id" ON "salesapp"."distributors" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_geo_tracking_company_id" ON "salesapp"."geo_tracking" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_influencers_company_id" ON "salesapp"."influencers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_instititions_company_id" ON "salesapp"."instititions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_journey_breadcrumbs_company_id" ON "salesapp"."journey_breadcrumbs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_journey_ops_company_id" ON "salesapp"."journey_ops" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_journeys_company_id" ON "salesapp"."journeys" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_outlets_company_id" ON "salesapp"."outlets" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_permanent_journey_plans_company_id" ON "salesapp"."permanent_journey_plans" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_roles_company_id" ON "salesapp"."roles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_salesman_attendance_company_id" ON "salesapp"."salesman_attendance" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_salesman_leave_applications_company_id" ON "salesapp"."salesman_leave_applications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_sync_state_company_id" ON "salesapp"."sync_state" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_ta_da_bill_items_company_id" ON "salesapp"."ta_da_bill_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_ta_da_bills_company_id" ON "salesapp"."ta_da_bills" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_company_id" ON "salesapp"."user_roles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_users_company_id" ON "salesapp"."users" USING btree ("company_id");