-- BRIXTA Role Context + Device Runtime Control Plane
-- Idempotent: safe for existing tenants and new-tenant provisioning.

CREATE TABLE IF NOT EXISTS "role_context_profiles" (
  "role_id" integer PRIMARY KEY NOT NULL,
  "schema_version" integer DEFAULT 1 NOT NULL,
  "definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_by_user_id" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "role_context_profiles_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade,
  CONSTRAINT "role_context_profiles_updated_by_user_id_fkey"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "device_runtime_assignments" (
  "device_registration_id" uuid PRIMARY KEY NOT NULL,
  "desired_generation" integer DEFAULT 0 NOT NULL,
  "installed_generation" integer DEFAULT 0 NOT NULL,
  "mode" varchar(30) DEFAULT 'published' NOT NULL,
  "desired_manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_by_user_id" integer,
  "last_acknowledged_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "device_runtime_assignments_device_registration_id_fkey"
    FOREIGN KEY ("device_registration_id") REFERENCES "device_registrations"("id") ON DELETE cascade,
  CONSTRAINT "device_runtime_assignments_updated_by_user_id_fkey"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint

INSERT INTO "platform_meta" ("key", "value", "updated_at")
VALUES ('tenant_platform_version', '3'::jsonb, now())
ON CONFLICT ("key")
DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
