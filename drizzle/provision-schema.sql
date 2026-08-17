CREATE TABLE "daily_visit_reports" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date,
	"customer_type" varchar(50),
	"dealer_type" varchar(50),
	"institution_type" varchar(50),
	"influencer_type" varchar(50),
	"visit_type" varchar(50),
	"location" varchar(500),
	"latitude" numeric(20, 7),
	"longitude" numeric(20, 7),
	"brand_selling" text[],
	"name_of_party" varchar(255),
	"contact_no_of_party" varchar(20),
	"expected_activation_date" date,
	"current_dealer_outstanding_amt" numeric(18, 2),
	"today_order_qty" numeric(18, 2),
	"today_collection_rupees" numeric(18, 2),
	"overdue_amount" numeric(18, 2),
	"feedbacks" varchar(500),
	"check_in_time" timestamp (6) with time zone,
	"check_out_time" timestamp (6) with time zone,
	"time_spent_in_loc" varchar(255),
	"in_time_image_url" varchar(500),
	"out_time_image_url" varchar(500),
	"user_id" integer NOT NULL,
	"pjp_id" varchar(255),
	"dealer_id" integer,
	"idempotency_key" varchar(255),
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"dealer_party_name" varchar(255) NOT NULL,
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
CREATE TABLE "distributors" (
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
CREATE TABLE "geo_tracking" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"recorded_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"accuracy" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"total_distance_travelled" numeric(10, 3),
	"location_type" varchar(50),
	"check_in_time" timestamp(6) with time zone,
	"check_out_time" timestamp(6) with time zone,
	"dest_lat" numeric(10, 7),
	"dest_lng" numeric(10, 7),
	"journey_id" text,
	"dealer_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "influencers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
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
CREATE TABLE "instititions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
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
CREATE TABLE "journey_breadcrumbs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"journey_id" varchar(255) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"total_distance" double precision DEFAULT 0 NOT NULL,
	"h3_index" varchar(15),
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"is_synced" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "journey_ops" (
	"server_seq" bigserial PRIMARY KEY NOT NULL,
	"op_id" uuid NOT NULL,
	"journey_id" varchar(255) NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"app_role" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journey_ops_op_id_key" UNIQUE("op_id")
);
--> statement-breakpoint
CREATE TABLE "journeys" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"pjp_id" varchar(255),
	"dealer_id" integer,
	"dest_name" varchar(255),
	"dest_lat" numeric(10, 7),
	"dest_lng" numeric(10, 7),
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"is_active" boolean DEFAULT true,
	"start_time" timestamp with time zone DEFAULT now() NOT NULL,
	"end_time" timestamp with time zone,
	"total_distance" numeric(10, 3) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_synced" boolean DEFAULT false,
	"app_role" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "mobile_capabilities" (
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
CREATE TABLE "outlets" (
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
CREATE TABLE "permanent_journey_plans" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_by_id" integer NOT NULL,
	"plan_date" date NOT NULL,
	"area_to_be_visited" varchar(500) NOT NULL,
	"description" varchar(500),
	"status" varchar(50) NOT NULL,
	"verification_status" varchar(50),
	"additional_visit_remarks" varchar(500),
	"route" varchar(500),
	"diversion_reason" varchar(500),
	"no_of_dealer_visits" integer,
	"no_of_institution_visits" integer,
	"no_of_influencer_visits" integer,
	"dealer_id" integer,
	"bulk_op_id" varchar(50),
	"institution_id" integer,
	"influencer_id" integer,
	"idempotency_key" varchar(120),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_role" varchar(100),
	"job_role" varchar(100),
	"granted_perms" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"perm_description" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "salesman_attendance" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"attendance_date" date NOT NULL,
	"location_name" varchar(500) NOT NULL,
	"in_time_timestamp" timestamp(6) with time zone NOT NULL,
	"out_time_timestamp" timestamp(6) with time zone,
	"in_time_image_captured" boolean NOT NULL,
	"out_time_image_captured" boolean NOT NULL,
	"in_time_image_url" varchar(500),
	"out_time_image_url" varchar(500),
	"in_time_latitude" numeric(10, 7) NOT NULL,
	"in_time_longitude" numeric(10, 7) NOT NULL,
	"out_time_latitude" numeric(10, 7),
	"out_time_longitude" numeric(10, 7),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"role" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "salesman_leave_applications" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"leave_type" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" varchar(500) NOT NULL,
	"status" varchar(50) NOT NULL,
	"admin_remarks" varchar(500),
	"app_role" varchar(50),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_server_seq" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "one_row_only" CHECK (id = 1)
);
--> statement-breakpoint
CREATE TABLE "ta_da_bill_items" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" varchar(255) NOT NULL,
	"from_location" varchar(255),
	"to_location" varchar(255),
	"distance_travelled_km" numeric(18, 2),
	"transport_fare" numeric(18, 2) DEFAULT '0',
	"lodging_fare" numeric(18, 2) DEFAULT '0',
	"fooding_fare" numeric(18, 2) DEFAULT '0',
	"local_conveyance" numeric(18, 2) DEFAULT '0',
	"out_of_pocket_paid" numeric(18, 2) DEFAULT '0',
	"total_bills_added" integer DEFAULT 0,
	"bill_photo_urls" text[],
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "ta_da_bills" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"from_date" date,
	"to_date" date,
	"bill_date" date NOT NULL,
	"daily_allowance" numeric(18, 2) DEFAULT '0',
	"total_cost" numeric(18, 2) DEFAULT '0',
	"status" varchar(50) DEFAULT 'PENDING',
	"remarks" text,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_mobile_capabilities" (
	"user_id" integer NOT NULL,
	"capability_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_mobile_capabilities_user_id_capability_id_pk" PRIMARY KEY("user_id","capability_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text,
	"phone_number" varchar(50),
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"area" varchar(100),
	"zone" varchar(100),
	"is_dashboard_user" boolean DEFAULT false NOT NULL,
	"dashboard_login_id" text,
	"dashboard_hashed_password" text,
	"is_sales_app_user" boolean DEFAULT false NOT NULL,
	"salesman_login_id" text,
	"sales_app_password" text,
	"display_name" varchar(160),
	"department" varchar(160),
	"designation" varchar(160),
	"sales_app_password_hash" text,
	"reports_to_id" integer,
	"device_id" varchar(255),
	"fcm_token" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "uniq_user_device_id" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "admin_ownership_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"area_key" varchar(120) NOT NULL,
	"scope_type" varchar(40) DEFAULT 'organization' NOT NULL,
	"scope_value" varchar(180),
	"primary_admin_user_id" integer,
	"fallback_admin_user_id" integer,
	"priority" integer DEFAULT 0 NOT NULL,
	"sla_minutes" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appliance_audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"actor_type" varchar(40) DEFAULT 'admin' NOT NULL,
	"action" varchar(180) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" varchar(255),
	"before_state" jsonb,
	"after_state" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" varchar(60) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"area_key" varchar(120) NOT NULL,
	"title" varchar(220) NOT NULL,
	"requester_user_id" integer,
	"assigned_admin_user_id" integer,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" integer,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attention_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area_key" varchar(120) NOT NULL,
	"severity" varchar(20) DEFAULT 'info' NOT NULL,
	"title" varchar(220) NOT NULL,
	"body" text,
	"entity_type" varchar(80),
	"entity_id" varchar(255),
	"assigned_admin_user_id" integer,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" integer
);
--> statement-breakpoint
CREATE TABLE "capability_assignment_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"capability_id" integer NOT NULL,
	"subject_type" varchar(40) NOT NULL,
	"subject_value" varchar(180),
	"effect" varchar(16) DEFAULT 'allow' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"platform" varchar(40) NOT NULL,
	"app_version" varchar(80),
	"push_token" varchar(700),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dynamic_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_mutation_id" uuid NOT NULL,
	"user_id" integer NOT NULL,
	"capability_id" integer NOT NULL,
	"work_item_id" uuid,
	"status" varchar(40) DEFAULT 'submitted' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"client_created_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dynamic_submissions_client_mutation_id_key" UNIQUE("client_mutation_id")
);
--> statement-breakpoint
CREATE TABLE "employee_runtime_state" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"last_login_at" timestamp with time zone,
	"last_bootstrap_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"current_device_id" varchar(255),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"surface" varchar(40) NOT NULL,
	"action_key" varchar(160) NOT NULL,
	"entity_type" varchar(80),
	"entity_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_pins" (
	"user_id" integer NOT NULL,
	"surface" varchar(40) NOT NULL,
	"item_key" varchar(160) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_pins_user_id_surface_item_key_pk" PRIMARY KEY("user_id","surface","item_key")
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capability_id" integer,
	"assignee_user_id" integer NOT NULL,
	"created_by_user_id" integer,
	"title" varchar(220) NOT NULL,
	"description" text,
	"status" varchar(40) DEFAULT 'assigned' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"due_at" timestamp with time zone,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"approval_required" boolean DEFAULT false NOT NULL,
	"approval_area_key" varchar(120),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_user_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_pjp_id_fkey" FOREIGN KEY ("pjp_id") REFERENCES "permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "distributors" ADD CONSTRAINT "distributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "geo_tracking" ADD CONSTRAINT "geo_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "geo_tracking" ADD CONSTRAINT "geo_tracking_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_tracking" ADD CONSTRAINT "geo_tracking_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencers" ADD CONSTRAINT "influencers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "instititions" ADD CONSTRAINT "institutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journey_breadcrumbs" ADD CONSTRAINT "journey_breadcrumbs_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_ops" ADD CONSTRAINT "fk_journey_ops_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journey_ops" ADD CONSTRAINT "fk_journey_ops_journey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_pjp_id_fkey" FOREIGN KEY ("pjp_id") REFERENCES "permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "instititions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_influencer_id_fkey" FOREIGN KEY ("influencer_id") REFERENCES "influencers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesman_attendance" ADD CONSTRAINT "salesman_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesman_leave_applications" ADD CONSTRAINT "salesman_leave_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ta_da_bill_items" ADD CONSTRAINT "ta_da_bill_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "ta_da_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ta_da_bills" ADD CONSTRAINT "ta_da_bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mobile_capabilities" ADD CONSTRAINT "user_mobile_capabilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mobile_capabilities" ADD CONSTRAINT "user_mobile_capabilities_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "mobile_capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_reports_to_id_fkey" FOREIGN KEY ("reports_to_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "admin_ownership_rules" ADD CONSTRAINT "admin_ownership_rules_primary_admin_user_id_fkey" FOREIGN KEY ("primary_admin_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_ownership_rules" ADD CONSTRAINT "admin_ownership_rules_fallback_admin_user_id_fkey" FOREIGN KEY ("fallback_admin_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_ownership_rules" ADD CONSTRAINT "admin_ownership_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appliance_audit_log" ADD CONSTRAINT "appliance_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_assigned_admin_user_id_fkey" FOREIGN KEY ("assigned_admin_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attention_items" ADD CONSTRAINT "attention_items_assigned_admin_user_id_fkey" FOREIGN KEY ("assigned_admin_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attention_items" ADD CONSTRAINT "attention_items_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_assignment_rules" ADD CONSTRAINT "capability_assignment_rules_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "mobile_capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_assignment_rules" ADD CONSTRAINT "capability_assignment_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_submissions" ADD CONSTRAINT "dynamic_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_submissions" ADD CONSTRAINT "dynamic_submissions_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "mobile_capabilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_submissions" ADD CONSTRAINT "dynamic_submissions_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_runtime_state" ADD CONSTRAINT "employee_runtime_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_pins" ADD CONSTRAINT "user_pins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "mobile_capabilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_daily_visit_reports_user_id" ON "daily_visit_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_daily_visit_reports_pjp_id" ON "daily_visit_reports" USING btree ("pjp_id");--> statement-breakpoint
CREATE INDEX "idx_verified_zone" ON "dealers" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "idx_verified_district" ON "dealers" USING btree ("district");--> statement-breakpoint
CREATE INDEX "idx_verified_pincode" ON "dealers" USING btree ("pin_code");--> statement-breakpoint
CREATE INDEX "idx_verified_gst" ON "dealers" USING btree ("gst_no");--> statement-breakpoint
CREATE INDEX "idx_geo_active" ON "geo_tracking" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_geo_dealer_id" ON "geo_tracking" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_geo_journey_time" ON "geo_tracking" USING btree ("journey_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_geo_tracking_recorded_at" ON "geo_tracking" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_geo_tracking_user_id" ON "geo_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_geo_user_time" ON "geo_tracking" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_influencer_verified_zone" ON "influencers" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "idx_influencer_verified_district" ON "influencers" USING btree ("district");--> statement-breakpoint
CREATE INDEX "idx_influencer_verified_pincode" ON "influencers" USING btree ("pin_code");--> statement-breakpoint
CREATE INDEX "idx_institute_verified_zone" ON "instititions" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "idx_institute_verified_district" ON "instititions" USING btree ("district");--> statement-breakpoint
CREATE INDEX "idx_institute_verified_pincode" ON "instititions" USING btree ("pin_code");--> statement-breakpoint
CREATE INDEX "idx_institute_verified_gst" ON "instititions" USING btree ("gst_no");--> statement-breakpoint
CREATE INDEX "idx_breadcrumbs_h3" ON "journey_breadcrumbs" USING btree ("h3_index");--> statement-breakpoint
CREATE INDEX "idx_breadcrumbs_journey_time" ON "journey_breadcrumbs" USING btree ("journey_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_journey_ops_created" ON "journey_ops" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_journey_ops_journey" ON "journey_ops" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "idx_journey_ops_server_seq" ON "journey_ops" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "idx_journey_ops_user" ON "journey_ops" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_journeys_user_status" ON "journeys" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_capabilities_key_key" ON "mobile_capabilities" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_permanent_journey_plans_created_by_id" ON "permanent_journey_plans" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_permanent_journey_plans_user_id" ON "permanent_journey_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pjp_bulk_op_id" ON "permanent_journey_plans" USING btree ("bulk_op_id");--> statement-breakpoint
CREATE INDEX "idx_pjp_dealer_id" ON "permanent_journey_plans" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_pjp_institution_id" ON "permanent_journey_plans" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "idx_pjp_influencer_id" ON "permanent_journey_plans" USING btree ("influencer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_pjp_idempotency_key_not_null" ON "permanent_journey_plans" USING btree ("idempotency_key") WHERE (idempotency_key IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_pjp_user_dealer_plan_date" ON "permanent_journey_plans" USING btree ("user_id","dealer_id","plan_date");--> statement-breakpoint
CREATE INDEX "idx_salesman_attendance_user_id" ON "salesman_attendance" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_salesman_leave_applications_user_id" ON "salesman_leave_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ta_da_bill_items_bill_id" ON "ta_da_bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "idx_ta_da_bills_user_id" ON "ta_da_bills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_device_id" ON "users" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_salesman_login_id_key" ON "users" USING btree ("salesman_login_id");--> statement-breakpoint
CREATE INDEX "idx_users_reports_to_id" ON "users" USING btree ("reports_to_id");--> statement-breakpoint
CREATE INDEX "idx_admin_ownership_rules_area" ON "admin_ownership_rules" USING btree ("area_key");--> statement-breakpoint
CREATE INDEX "idx_admin_ownership_rules_scope" ON "admin_ownership_rules" USING btree ("scope_type","scope_value");--> statement-breakpoint
CREATE INDEX "idx_appliance_audit_log_entity" ON "appliance_audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_appliance_audit_log_actor" ON "appliance_audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_approval_requests_status" ON "approval_requests" USING btree ("status","assigned_admin_user_id");--> statement-breakpoint
CREATE INDEX "idx_approval_requests_area" ON "approval_requests" USING btree ("area_key");--> statement-breakpoint
CREATE INDEX "idx_attention_items_status" ON "attention_items" USING btree ("status","assigned_admin_user_id");--> statement-breakpoint
CREATE INDEX "idx_attention_items_area" ON "attention_items" USING btree ("area_key");--> statement-breakpoint
CREATE INDEX "idx_capability_assignment_rules_capability" ON "capability_assignment_rules" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "idx_capability_assignment_rules_subject" ON "capability_assignment_rules" USING btree ("subject_type","subject_value");--> statement-breakpoint
CREATE INDEX "idx_capability_assignment_rules_enabled" ON "capability_assignment_rules" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "device_registrations_user_device_key" ON "device_registrations" USING btree ("user_id","device_id");--> statement-breakpoint
CREATE INDEX "idx_device_registrations_last_seen" ON "device_registrations" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_dynamic_submissions_user" ON "dynamic_submissions" USING btree ("user_id","submitted_at");--> statement-breakpoint
CREATE INDEX "idx_dynamic_submissions_capability" ON "dynamic_submissions" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "idx_employee_runtime_state_last_seen" ON "employee_runtime_state" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_usage_events_actor_action" ON "usage_events" USING btree ("actor_user_id","action_key");--> statement-breakpoint
CREATE INDEX "idx_usage_events_occurred_at" ON "usage_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_work_items_assignee_status" ON "work_items" USING btree ("assignee_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_work_items_due_at" ON "work_items" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "idx_work_items_capability" ON "work_items" USING btree ("capability_id");