-- CreateEnum
CREATE TYPE "MatchRunStatus" AS ENUM ('running', 'ready', 'failed');

-- CreateTable
CREATE TABLE "match_results" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "cv_version_id" INTEGER NOT NULL,
    "job_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "strengths" JSONB NOT NULL,
    "gaps" JSONB NOT NULL,
    "tips" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_runs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "job_id" INTEGER NOT NULL,
    "status" "MatchRunStatus" NOT NULL DEFAULT 'running',
    "model" VARCHAR(64) NOT NULL,
    "effort" VARCHAR(16),
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_results_user_id_job_id_idx" ON "match_results"("user_id", "job_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_results_cv_version_id_job_id_key" ON "match_results"("cv_version_id", "job_id");

-- CreateIndex
CREATE INDEX "match_runs_user_id_created_at_idx" ON "match_runs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_cv_version_id_fkey" FOREIGN KEY ("cv_version_id") REFERENCES "cv_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_runs" ADD CONSTRAINT "match_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_runs" ADD CONSTRAINT "match_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
