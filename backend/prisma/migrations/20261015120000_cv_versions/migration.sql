-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('none', 'running', 'ready', 'failed');

-- CreateTable
CREATE TABLE "cv_versions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "pdf" BYTEA NOT NULL,
    "role" VARCHAR(32),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "analysis" JSONB,
    "analysis_status" "AnalysisStatus" NOT NULL DEFAULT 'none',
    "analysis_error" VARCHAR(32),
    "batch_id" VARCHAR(64),
    "model" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cv_versions_user_id_idx" ON "cv_versions"("user_id");

-- AddForeignKey
ALTER TABLE "cv_versions" ADD CONSTRAINT "cv_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

