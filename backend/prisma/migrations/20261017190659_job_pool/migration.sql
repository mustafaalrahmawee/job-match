-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('ba', 'own');

-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('work', 'self_employment', 'apprenticeship', 'internship');

-- CreateTable
CREATE TABLE "jobs" (
    "id" SERIAL NOT NULL,
    "source" "JobSource" NOT NULL,
    "external_id" VARCHAR(64) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "company" VARCHAR(300),
    "city" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "offer_type" "OfferType" NOT NULL,
    "role" VARCHAR(32) NOT NULL,
    "full_time" BOOLEAN NOT NULL,
    "part_time" BOOLEAN NOT NULL,
    "published_at" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_imports" (
    "id" SERIAL NOT NULL,
    "imported" INTEGER NOT NULL,
    "duplicates" INTEGER NOT NULL,
    "filtered" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_published_at_idx" ON "jobs"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_source_external_id_key" ON "jobs"("source", "external_id");
