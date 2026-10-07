ALTER TABLE "cv_versions" ADD COLUMN "analysis" jsonb;--> statement-breakpoint
ALTER TABLE "cv_versions" ADD COLUMN "analysis_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "cv_versions" ADD COLUMN "analysis_error" text;--> statement-breakpoint
ALTER TABLE "cv_versions" ADD COLUMN "analysis_batch_id" text;--> statement-breakpoint
ALTER TABLE "cv_versions" ADD COLUMN "analysis_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cv_versions" ADD COLUMN "analysis_input_tokens" integer;--> statement-breakpoint
ALTER TABLE "cv_versions" ADD COLUMN "analysis_output_tokens" integer;--> statement-breakpoint
ALTER TABLE "cv_versions" ADD COLUMN "analysis_cache_read_tokens" integer;--> statement-breakpoint
ALTER TABLE "cv_versions" ADD COLUMN "analysis_cache_write_tokens" integer;