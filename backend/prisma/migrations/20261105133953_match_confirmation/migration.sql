-- AlterTable
ALTER TABLE "match_results" ADD COLUMN     "confirmed_at" TIMESTAMPTZ,
ADD COLUMN     "suspicious_text" JSONB;
