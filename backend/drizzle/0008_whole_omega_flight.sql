CREATE TABLE "cv_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pdf" "bytea" NOT NULL,
	"size_bytes" integer NOT NULL,
	"role" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cv_versions" ADD CONSTRAINT "cv_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cv_versions_user_id_created_at_idx" ON "cv_versions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cv_versions_one_active_idx" ON "cv_versions" USING btree ("user_id") WHERE "cv_versions"."active";