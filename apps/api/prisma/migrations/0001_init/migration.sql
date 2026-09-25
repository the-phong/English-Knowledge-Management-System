-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Importance" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "LearningState" AS ENUM ('NEW', 'LEARNING', 'PRACTICING', 'MASTERED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('RECOGNITION', 'RECALL', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "AttemptResult" AS ENUM ('AGAIN', 'HARD', 'GOOD', 'EASY', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "WritingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "daily_minutes" INTEGER NOT NULL DEFAULT 10,
    "max_new_items_per_day" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lexemes" (
    "id" TEXT NOT NULL,
    "lemma" TEXT NOT NULL,
    "normalized_lemma" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "part_of_speech" TEXT NOT NULL DEFAULT 'UNKNOWN',

    CONSTRAINT "lexemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictionary_senses" (
    "id" TEXT NOT NULL,
    "lexeme_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_sense_id" TEXT,
    "definition" TEXT NOT NULL,
    "raw_data" JSONB,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dictionary_senses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lexeme_id" TEXT NOT NULL,
    "dictionary_sense_id" TEXT,
    "definition_vi" TEXT NOT NULL,
    "source_context" TEXT,
    "source_name" TEXT,
    "source_url" TEXT,
    "importance" "Importance" NOT NULL DEFAULT 'NORMAL',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vocabulary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_tags" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_tags" (
    "vocabulary_item_id" TEXT NOT NULL,
    "context_tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocabulary_tags_pkey" PRIMARY KEY ("vocabulary_item_id","context_tag_id")
);

-- CreateTable
CREATE TABLE "learning_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "target_minutes" INTEGER NOT NULL,
    "planned_item_count" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_items" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "vocabulary_item_id" TEXT NOT NULL,
    "activity_type" "ActivityType" NOT NULL,
    "position" INTEGER NOT NULL,
    "selection_reasons" JSONB,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "session_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "vocabulary_item_id" TEXT NOT NULL,
    "session_item_id" TEXT,
    "activity_type" "ActivityType" NOT NULL,
    "answer_text" TEXT,
    "result" "AttemptResult" NOT NULL,
    "was_correct" BOOLEAN NOT NULL,
    "used_hint" BOOLEAN NOT NULL DEFAULT false,
    "response_time_ms" INTEGER,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mastery_snapshots" (
    "id" TEXT NOT NULL,
    "vocabulary_item_id" TEXT NOT NULL,
    "recognition_score" INTEGER NOT NULL DEFAULT 0,
    "recall_score" INTEGER NOT NULL DEFAULT 0,
    "production_score" INTEGER NOT NULL DEFAULT 0,
    "learning_state" "LearningState" NOT NULL DEFAULT 'NEW',
    "review_stage" INTEGER NOT NULL DEFAULT 0,
    "next_review_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "scoring_rule_version" INTEGER NOT NULL DEFAULT 1,
    "scheduling_rule_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "mastery_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mastery_changes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "vocabulary_item_id" TEXT NOT NULL,
    "source_attempt_id" TEXT,
    "before_snapshot" JSONB NOT NULL,
    "after_snapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "rule_version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mastery_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_submissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "vocabulary_item_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "revision_of_id" TEXT,
    "status" "WritingStatus" NOT NULL DEFAULT 'PENDING',
    "failure_code" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "writing_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_evaluations" (
    "id" TEXT NOT NULL,
    "writing_submission_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "schema_version" TEXT NOT NULL,
    "uses_target_sense" BOOLEAN NOT NULL,
    "outcome" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "grammar_issues" JSONB NOT NULL,
    "word_choice_issues" JSONB NOT NULL,
    "suggested_sentence" TEXT,
    "explanation_vi" TEXT,
    "latency_ms" INTEGER,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_email_key" ON "users"("normalized_email");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_expires_at_idx" ON "refresh_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "lexemes_normalized_lemma_language_part_of_speech_key" ON "lexemes"("normalized_lemma", "language", "part_of_speech");

-- CreateIndex
CREATE INDEX "dictionary_senses_lexeme_id_idx" ON "dictionary_senses"("lexeme_id");

-- CreateIndex
CREATE INDEX "vocabulary_items_user_id_archived_at_created_at_idx" ON "vocabulary_items"("user_id", "archived_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "context_tags_user_id_normalized_name_key" ON "context_tags"("user_id", "normalized_name");

-- CreateIndex
CREATE INDEX "learning_sessions_user_id_status_started_at_idx" ON "learning_sessions"("user_id", "status", "started_at");

-- CreateIndex
CREATE INDEX "session_items_session_id_completed_at_idx" ON "session_items"("session_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "session_items_session_id_position_key" ON "session_items"("session_id", "position");

-- CreateIndex
CREATE INDEX "learning_attempts_vocabulary_item_id_created_at_idx" ON "learning_attempts"("vocabulary_item_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "learning_attempts_user_id_idempotency_key_key" ON "learning_attempts"("user_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "mastery_snapshots_vocabulary_item_id_key" ON "mastery_snapshots"("vocabulary_item_id");

-- CreateIndex
CREATE INDEX "mastery_snapshots_next_review_at_idx" ON "mastery_snapshots"("next_review_at");

-- CreateIndex
CREATE INDEX "mastery_changes_vocabulary_item_id_created_at_idx" ON "mastery_changes"("vocabulary_item_id", "created_at");

-- CreateIndex
CREATE INDEX "writing_submissions_user_id_status_created_at_idx" ON "writing_submissions"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "ai_evaluations_writing_submission_id_created_at_idx" ON "ai_evaluations"("writing_submission_id", "created_at");

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dictionary_senses" ADD CONSTRAINT "dictionary_senses_lexeme_id_fkey" FOREIGN KEY ("lexeme_id") REFERENCES "lexemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_lexeme_id_fkey" FOREIGN KEY ("lexeme_id") REFERENCES "lexemes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_dictionary_sense_id_fkey" FOREIGN KEY ("dictionary_sense_id") REFERENCES "dictionary_senses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_tags" ADD CONSTRAINT "context_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_tags" ADD CONSTRAINT "vocabulary_tags_vocabulary_item_id_fkey" FOREIGN KEY ("vocabulary_item_id") REFERENCES "vocabulary_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_tags" ADD CONSTRAINT "vocabulary_tags_context_tag_id_fkey" FOREIGN KEY ("context_tag_id") REFERENCES "context_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_vocabulary_item_id_fkey" FOREIGN KEY ("vocabulary_item_id") REFERENCES "vocabulary_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_attempts" ADD CONSTRAINT "learning_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_attempts" ADD CONSTRAINT "learning_attempts_vocabulary_item_id_fkey" FOREIGN KEY ("vocabulary_item_id") REFERENCES "vocabulary_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_attempts" ADD CONSTRAINT "learning_attempts_session_item_id_fkey" FOREIGN KEY ("session_item_id") REFERENCES "session_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery_snapshots" ADD CONSTRAINT "mastery_snapshots_vocabulary_item_id_fkey" FOREIGN KEY ("vocabulary_item_id") REFERENCES "vocabulary_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery_changes" ADD CONSTRAINT "mastery_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery_changes" ADD CONSTRAINT "mastery_changes_vocabulary_item_id_fkey" FOREIGN KEY ("vocabulary_item_id") REFERENCES "vocabulary_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_vocabulary_item_id_fkey" FOREIGN KEY ("vocabulary_item_id") REFERENCES "vocabulary_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_revision_of_id_fkey" FOREIGN KEY ("revision_of_id") REFERENCES "writing_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_evaluations" ADD CONSTRAINT "ai_evaluations_writing_submission_id_fkey" FOREIGN KEY ("writing_submission_id") REFERENCES "writing_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

