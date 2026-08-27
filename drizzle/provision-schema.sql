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
CREATE TABLE "sync_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_server_seq" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "one_row_only" CHECK (id = 1)
);
--> statement-breakpoint
CREATE TABLE "user_mobile_capabilities" (
	"user_id" integer NOT NULL,
	"capability_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_mobile_capabilities_user_id_capability_id_pk" PRIMARY KEY("user_id","capability_id")
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

ALTER TABLE "user_mobile_capabilities" ADD CONSTRAINT "user_mobile_capabilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

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

CREATE UNIQUE INDEX "mobile_capabilities_key_key" ON "mobile_capabilities" USING btree ("key");--> statement-breakpoint

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