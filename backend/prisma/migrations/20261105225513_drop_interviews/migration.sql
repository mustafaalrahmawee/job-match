-- DropForeignKey
ALTER TABLE "interview_sessions" DROP CONSTRAINT "interview_sessions_job_id_fkey";

-- DropForeignKey
ALTER TABLE "interview_sessions" DROP CONSTRAINT "interview_sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "interview_turns" DROP CONSTRAINT "interview_turns_session_id_fkey";

-- DropTable
DROP TABLE "interview_turns";

-- DropTable
DROP TABLE "interview_sessions";

-- DropEnum
DROP TYPE "InterviewDifficulty";

-- DropEnum
DROP TYPE "InterviewStatus";
