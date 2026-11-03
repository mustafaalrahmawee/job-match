/*
  Warnings:

  - You are about to drop the column `batch_id` on the `cv_versions` table. All the data in the column will be lost.
  - Added the required column `analyzed_at` to the `cv_versions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "cv_versions" DROP COLUMN "batch_id",
ADD COLUMN     "analyzed_at" TIMESTAMPTZ NOT NULL,
ADD COLUMN     "suspicious_text" JSONB;

-- CreateTable
CREATE TABLE "cv_runs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cv_runs_user_id_created_at_idx" ON "cv_runs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "cv_runs" ADD CONSTRAINT "cv_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
