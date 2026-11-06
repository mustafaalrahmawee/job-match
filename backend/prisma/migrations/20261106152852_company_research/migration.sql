-- CreateEnum
CREATE TYPE "CompanyResearchRunStatus" AS ENUM ('running', 'ready', 'failed');

-- CreateTable
CREATE TABLE "company_researches" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "company" VARCHAR(300) NOT NULL,
    "question" VARCHAR(300) NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "suspicious_text" TEXT,
    "suspicious_sources" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "queries" JSONB NOT NULL,
    "search_results" JSONB NOT NULL,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_researches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_research_runs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "CompanyResearchRunStatus" NOT NULL DEFAULT 'running',
    "model" VARCHAR(64) NOT NULL,
    "effort" VARCHAR(16),
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_research_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_researches_user_id_idx" ON "company_researches"("user_id");

-- CreateIndex
CREATE INDEX "company_researches_conversation_id_idx" ON "company_researches"("conversation_id");

-- CreateIndex
CREATE INDEX "company_research_runs_user_id_created_at_idx" ON "company_research_runs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "company_researches" ADD CONSTRAINT "company_researches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_researches" ADD CONSTRAINT "company_researches_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_research_runs" ADD CONSTRAINT "company_research_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
