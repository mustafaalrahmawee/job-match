-- CreateTable
CREATE TABLE "extract_runs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extract_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extract_runs_user_id_created_at_idx" ON "extract_runs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "extract_runs" ADD CONSTRAINT "extract_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
