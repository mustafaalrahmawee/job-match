-- CreateEnum
CREATE TYPE "LlmUnit" AS ENUM ('cv_analysis', 'job_extract', 'match_analysis', 'company_research', 'coach_agent');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('running', 'ready', 'failed');

-- CreateTable
CREATE TABLE "llm_runs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "unit" "LlmUnit" NOT NULL,
    "job_id" INTEGER,
    "status" "RunStatus" NOT NULL DEFAULT 'running',
    "model" VARCHAR(64),
    "effort" VARCHAR(16),
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_runs_user_id_unit_created_at_idx" ON "llm_runs"("user_id", "unit", "created_at");

-- AddForeignKey
ALTER TABLE "llm_runs" ADD CONSTRAINT "llm_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_runs" ADD CONSTRAINT "llm_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CopyRuns
INSERT INTO "llm_runs" ("user_id", "unit", "status", "created_at")
SELECT "user_id", 'cv_analysis', 'ready', "created_at" FROM "cv_runs";

INSERT INTO "llm_runs" ("user_id", "unit", "status", "created_at")
SELECT "user_id", 'job_extract', 'ready', "created_at" FROM "extract_runs";

INSERT INTO "llm_runs" ("user_id", "unit", "job_id", "status", "model", "effort", "input_tokens", "output_tokens", "created_at")
SELECT "user_id", 'match_analysis', "job_id", "status"::text::"RunStatus", "model", "effort", "input_tokens", "output_tokens", "created_at" FROM "match_runs";

INSERT INTO "llm_runs" ("user_id", "unit", "status", "model", "effort", "input_tokens", "output_tokens", "created_at")
SELECT "user_id", 'company_research', "status"::text::"RunStatus", "model", "effort", "input_tokens", "output_tokens", "created_at" FROM "company_research_runs";

-- DropForeignKey
ALTER TABLE "company_research_runs" DROP CONSTRAINT "company_research_runs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "cv_runs" DROP CONSTRAINT "cv_runs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "extract_runs" DROP CONSTRAINT "extract_runs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "match_runs" DROP CONSTRAINT "match_runs_job_id_fkey";

-- DropForeignKey
ALTER TABLE "match_runs" DROP CONSTRAINT "match_runs_user_id_fkey";

-- AlterTable
ALTER TABLE "cv_versions" DROP COLUMN "cache_read_tokens",
DROP COLUMN "cache_write_tokens",
DROP COLUMN "effort",
DROP COLUMN "input_tokens",
DROP COLUMN "model",
DROP COLUMN "output_tokens";

-- DropTable
DROP TABLE "company_research_runs";

-- DropTable
DROP TABLE "cv_runs";

-- DropTable
DROP TABLE "extract_runs";

-- DropTable
DROP TABLE "match_runs";

-- DropEnum
DROP TYPE "CompanyResearchRunStatus";

-- DropEnum
DROP TYPE "MatchRunStatus";
