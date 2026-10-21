-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "salary" VARCHAR(200),
ADD COLUMN     "user_id" INTEGER;

-- CreateIndex
CREATE INDEX "jobs_user_id_idx" ON "jobs"("user_id");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
