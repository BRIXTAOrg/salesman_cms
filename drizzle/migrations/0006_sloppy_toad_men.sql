CREATE TABLE "eurofoam"."ta_da_bill_items" (
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
CREATE TABLE "eurofoam"."ta_da_bills" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"bill_date" date NOT NULL,
	"daily_allowance" numeric(18, 2) DEFAULT '0',
	"total_cost" numeric(18, 2) DEFAULT '0',
	"status" varchar(50) DEFAULT 'PENDING',
	"remarks" text,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eurofoam"."ta_da_bill_items" ADD CONSTRAINT "ta_da_bill_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "eurofoam"."ta_da_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eurofoam"."ta_da_bills" ADD CONSTRAINT "ta_da_bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "eurofoam"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ta_da_bill_items_bill_id" ON "eurofoam"."ta_da_bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "idx_ta_da_bills_user_id" ON "eurofoam"."ta_da_bills" USING btree ("user_id");