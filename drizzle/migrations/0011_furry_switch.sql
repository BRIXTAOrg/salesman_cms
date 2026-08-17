ALTER SCHEMA "salesapp" RENAME TO "kamdhenu";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."companies" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "kamdhenu"."companies" CASCADE;--> statement-breakpoint
ALTER TABLE "kamdhenu"."daily_visit_reports" DROP CONSTRAINT "daily_visit_reports_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."daily_visit_reports" DROP CONSTRAINT "daily_visit_reports_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."daily_visit_reports" DROP CONSTRAINT "daily_visit_reports_pjp_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."daily_visit_reports" DROP CONSTRAINT "daily_visit_reports_dealer_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."dealers" DROP CONSTRAINT "dealers_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."dealers" DROP CONSTRAINT "dealers_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."distributors" DROP CONSTRAINT "distributors_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."distributors" DROP CONSTRAINT "distributors_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."geo_tracking" DROP CONSTRAINT "geo_tracking_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."geo_tracking" DROP CONSTRAINT "geo_tracking_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."geo_tracking" DROP CONSTRAINT "geo_tracking_journey_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."geo_tracking" DROP CONSTRAINT "geo_tracking_dealer_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."influencers" DROP CONSTRAINT "influencers_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."influencers" DROP CONSTRAINT "influencers_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."instititions" DROP CONSTRAINT "instititions_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."instititions" DROP CONSTRAINT "institutions_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."journey_breadcrumbs" DROP CONSTRAINT "journey_breadcrumbs_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."journey_breadcrumbs" DROP CONSTRAINT "journey_breadcrumbs_journey_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."journey_ops" DROP CONSTRAINT "journey_ops_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."journey_ops" DROP CONSTRAINT "fk_journey_ops_user";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."journey_ops" DROP CONSTRAINT "fk_journey_ops_journey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."journeys" DROP CONSTRAINT "journeys_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."journeys" DROP CONSTRAINT "journeys_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."journeys" DROP CONSTRAINT "journeys_pjp_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."journeys" DROP CONSTRAINT "journeys_dealer_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."mobile_capabilities" DROP CONSTRAINT "mobile_capabilities_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."outlets" DROP CONSTRAINT "outlets_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."outlets" DROP CONSTRAINT "outlets_distributor_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."outlets" DROP CONSTRAINT "outlets_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."permanent_journey_plans" DROP CONSTRAINT "permanent_journey_plans_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."permanent_journey_plans" DROP CONSTRAINT "permanent_journey_plans_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."permanent_journey_plans" DROP CONSTRAINT "permanent_journey_plans_created_by_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."permanent_journey_plans" DROP CONSTRAINT "permanent_journey_plans_dealer_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."permanent_journey_plans" DROP CONSTRAINT "permanent_journey_plans_institution_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."permanent_journey_plans" DROP CONSTRAINT "permanent_journey_plans_influencer_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."roles" DROP CONSTRAINT "roles_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."salesman_attendance" DROP CONSTRAINT "salesman_attendance_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."salesman_attendance" DROP CONSTRAINT "salesman_attendance_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."salesman_leave_applications" DROP CONSTRAINT "salesman_leave_applications_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."salesman_leave_applications" DROP CONSTRAINT "salesman_leave_applications_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."sync_state" DROP CONSTRAINT "sync_state_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."ta_da_bill_items" DROP CONSTRAINT "ta_da_bill_items_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."ta_da_bill_items" DROP CONSTRAINT "ta_da_bill_items_bill_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."ta_da_bills" DROP CONSTRAINT "ta_da_bills_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."ta_da_bills" DROP CONSTRAINT "ta_da_bills_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."user_mobile_capabilities" DROP CONSTRAINT "user_mobile_capabilities_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."user_mobile_capabilities" DROP CONSTRAINT "user_mobile_capabilities_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."user_mobile_capabilities" DROP CONSTRAINT "user_mobile_capabilities_capability_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."user_roles" DROP CONSTRAINT "user_roles_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."user_roles" DROP CONSTRAINT "user_roles_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."user_roles" DROP CONSTRAINT "user_roles_role_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."users" DROP CONSTRAINT "users_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "kamdhenu"."users" DROP CONSTRAINT "users_reports_to_id_fkey";
--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_daily_visit_reports_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_dealers_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_distributors_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_geo_tracking_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_influencers_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_instititions_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_journey_breadcrumbs_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_journey_ops_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_journeys_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_mobile_capabilities_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_outlets_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_permanent_journey_plans_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_roles_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_salesman_attendance_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_salesman_leave_applications_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_sync_state_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_ta_da_bill_items_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_ta_da_bills_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_user_mobile_capabilities_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_user_roles_company_id";--> statement-breakpoint
DROP INDEX "kamdhenu"."idx_users_company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_pjp_id_fkey" FOREIGN KEY ("pjp_id") REFERENCES "kamdhenu"."permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "kamdhenu"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."dealers" ADD CONSTRAINT "dealers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."distributors" ADD CONSTRAINT "distributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."geo_tracking" ADD CONSTRAINT "geo_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."geo_tracking" ADD CONSTRAINT "geo_tracking_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "kamdhenu"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."geo_tracking" ADD CONSTRAINT "geo_tracking_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "kamdhenu"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."influencers" ADD CONSTRAINT "influencers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."instititions" ADD CONSTRAINT "institutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."journey_breadcrumbs" ADD CONSTRAINT "journey_breadcrumbs_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "kamdhenu"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."journey_ops" ADD CONSTRAINT "fk_journey_ops_user" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."journey_ops" ADD CONSTRAINT "fk_journey_ops_journey" FOREIGN KEY ("journey_id") REFERENCES "kamdhenu"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."journeys" ADD CONSTRAINT "journeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."journeys" ADD CONSTRAINT "journeys_pjp_id_fkey" FOREIGN KEY ("pjp_id") REFERENCES "kamdhenu"."permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."journeys" ADD CONSTRAINT "journeys_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "kamdhenu"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."outlets" ADD CONSTRAINT "outlets_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "kamdhenu"."distributors"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."outlets" ADD CONSTRAINT "outlets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "kamdhenu"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "kamdhenu"."dealers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "kamdhenu"."instititions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_influencer_id_fkey" FOREIGN KEY ("influencer_id") REFERENCES "kamdhenu"."influencers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."salesman_attendance" ADD CONSTRAINT "salesman_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."salesman_leave_applications" ADD CONSTRAINT "salesman_leave_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."ta_da_bill_items" ADD CONSTRAINT "ta_da_bill_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "kamdhenu"."ta_da_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."ta_da_bills" ADD CONSTRAINT "ta_da_bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."user_mobile_capabilities" ADD CONSTRAINT "user_mobile_capabilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."user_mobile_capabilities" ADD CONSTRAINT "user_mobile_capabilities_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "kamdhenu"."mobile_capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "kamdhenu"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "kamdhenu"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kamdhenu"."users" ADD CONSTRAINT "users_reports_to_id_fkey" FOREIGN KEY ("reports_to_id") REFERENCES "kamdhenu"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kamdhenu"."daily_visit_reports" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."dealers" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."distributors" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."geo_tracking" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."influencers" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."instititions" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."journey_breadcrumbs" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."journey_ops" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."journeys" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."mobile_capabilities" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."outlets" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."permanent_journey_plans" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."roles" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."salesman_attendance" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."salesman_leave_applications" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."sync_state" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."ta_da_bill_items" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."ta_da_bills" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."user_mobile_capabilities" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."user_roles" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "kamdhenu"."users" DROP COLUMN "company_id";