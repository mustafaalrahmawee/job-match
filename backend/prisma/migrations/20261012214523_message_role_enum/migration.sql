-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant');

-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "role" TYPE "MessageRole" USING "role"::"MessageRole";
