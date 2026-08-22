-- BRIXTA Platform Core workflow provisioning
-- Matches drizzle/workflowSchema.ts.
-- Run after drizzle/provision-schema.sql so users/roles/mobile_capabilities exist.

CREATE TABLE IF NOT EXISTS "action_definitions" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" varchar(160) NOT NULL,
  "title" varchar(220) NOT NULL,
  "permission_key" varchar(160),
  "entitlement_key" varchar(160),
  "handler_key" varchar(160) NOT NULL,
  "capability_id" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "action_definitions_capability_id_fkey"
    FOREIGN KEY ("capability_id") REFERENCES "mobile_capabilities"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "action_definitions_key_key" ON "action_definitions" ("key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_action_definitions_capability" ON "action_definitions" ("capability_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workflow_definitions" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" varchar(160) NOT NULL,
  "name" varchar(220) NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_user_id" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_definitions_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_definitions_key_key" ON "workflow_definitions" ("key");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workflow_versions" (
  "id" serial PRIMARY KEY NOT NULL,
  "workflow_id" integer NOT NULL,
  "version" integer NOT NULL,
  "status" varchar(30) DEFAULT 'draft' NOT NULL,
  "created_by_user_id" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "published_at" timestamptz,
  CONSTRAINT "workflow_versions_workflow_id_fkey"
    FOREIGN KEY ("workflow_id") REFERENCES "workflow_definitions"("id") ON DELETE cascade,
  CONSTRAINT "workflow_versions_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_versions_workflow_version_key"
  ON "workflow_versions" ("workflow_id","version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_versions_status" ON "workflow_versions" ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "approval_policies" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" varchar(160) NOT NULL,
  "name" varchar(220) NOT NULL,
  "mode" varchar(30) DEFAULT 'any' NOT NULL,
  "minimum_approvals" integer DEFAULT 1 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by_user_id" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "approval_policies_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "approval_policies_key_key" ON "approval_policies" ("key");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "approval_policy_actors" (
  "id" serial PRIMARY KEY NOT NULL,
  "policy_id" integer NOT NULL,
  "subject_type" varchar(50) NOT NULL,
  "role_id" integer,
  "user_id" integer,
  "scope_type" varchar(60),
  "scope_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sequence" integer DEFAULT 0 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  CONSTRAINT "approval_policy_actors_policy_id_fkey"
    FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE cascade,
  CONSTRAINT "approval_policy_actors_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade,
  CONSTRAINT "approval_policy_actors_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_approval_policy_actors_policy" ON "approval_policy_actors" ("policy_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_approval_policy_actors_role" ON "approval_policy_actors" ("role_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_approval_policy_actors_user" ON "approval_policy_actors" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workflow_steps" (
  "id" serial PRIMARY KEY NOT NULL,
  "workflow_version_id" integer NOT NULL,
  "step_key" varchar(160) NOT NULL,
  "title" varchar(220) NOT NULL,
  "step_type" varchar(40) NOT NULL,
  "action_definition_id" integer,
  "approval_policy_id" integer,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "workflow_steps_workflow_version_id_fkey"
    FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE cascade,
  CONSTRAINT "workflow_steps_action_definition_id_fkey"
    FOREIGN KEY ("action_definition_id") REFERENCES "action_definitions"("id") ON DELETE set null,
  CONSTRAINT "workflow_steps_approval_policy_id_fkey"
    FOREIGN KEY ("approval_policy_id") REFERENCES "approval_policies"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_steps_version_step_key"
  ON "workflow_steps" ("workflow_version_id","step_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_steps_version" ON "workflow_steps" ("workflow_version_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workflow_step_dependencies" (
  "step_id" integer NOT NULL,
  "depends_on_step_id" integer NOT NULL,
  "required_status" varchar(40) DEFAULT 'completed' NOT NULL,
  CONSTRAINT "workflow_step_dependencies_step_id_depends_on_step_id_pk"
    PRIMARY KEY ("step_id","depends_on_step_id"),
  CONSTRAINT "workflow_step_dependencies_step_id_fkey"
    FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE cascade,
  CONSTRAINT "workflow_step_dependencies_depends_on_step_id_fkey"
    FOREIGN KEY ("depends_on_step_id") REFERENCES "workflow_steps"("id") ON DELETE cascade
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workflow_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_version_id" integer NOT NULL,
  "subject_user_id" integer NOT NULL,
  "status" varchar(40) DEFAULT 'active' NOT NULL,
  "context_type" varchar(80),
  "context_id" varchar(255),
  "context" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_instances_workflow_version_id_fkey"
    FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE restrict,
  CONSTRAINT "workflow_instances_subject_user_id_fkey"
    FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_instances_subject_status"
  ON "workflow_instances" ("subject_user_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_instances_context"
  ON "workflow_instances" ("context_type","context_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workflow_step_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_instance_id" uuid NOT NULL,
  "workflow_step_id" integer NOT NULL,
  "status" varchar(40) DEFAULT 'blocked' NOT NULL,
  "actor_user_id" integer,
  "source_type" varchar(80),
  "source_id" varchar(255),
  "blocked_reason" varchar(160),
  "activated_at" timestamptz,
  "completed_at" timestamptz,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_step_instances_workflow_instance_id_fkey"
    FOREIGN KEY ("workflow_instance_id") REFERENCES "workflow_instances"("id") ON DELETE cascade,
  CONSTRAINT "workflow_step_instances_workflow_step_id_fkey"
    FOREIGN KEY ("workflow_step_id") REFERENCES "workflow_steps"("id") ON DELETE restrict,
  CONSTRAINT "workflow_step_instances_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_step_instances_instance_step_key"
  ON "workflow_step_instances" ("workflow_instance_id","workflow_step_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_step_instances_status" ON "workflow_step_instances" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_step_instances_actor" ON "workflow_step_instances" ("actor_user_id");
