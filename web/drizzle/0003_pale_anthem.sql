ALTER TABLE "agents" ALTER COLUMN "model" SET DEFAULT 'claude-haiku-4-5-20251001';--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "match";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "extract_fields";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "actions";