CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"match" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"extract_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"watch_folders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"system_prompt" text DEFAULT '' NOT NULL,
	"model" text DEFAULT 'claude-sonnet-4-5-20250929' NOT NULL,
	"max_rounds" integer DEFAULT 15 NOT NULL,
	"poll_interval_ms" integer DEFAULT 30000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_org_idx" ON "agents" USING btree ("org_id");