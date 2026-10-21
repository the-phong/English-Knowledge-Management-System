-- CreateTable
CREATE TABLE "lexemes" (
    "id" UUID NOT NULL,
    "normalized_lemma" VARCHAR(100) NOT NULL,
    "language" VARCHAR(8) NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lexemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictionary_senses" (
    "id" UUID NOT NULL,
    "lexeme_id" UUID NOT NULL,
    "provider_id" VARCHAR(64) NOT NULL,
    "source_sense_id" VARCHAR(128) NOT NULL,
    "part_of_speech" VARCHAR(32) NOT NULL,
    "definition" VARCHAR(1000) NOT NULL,
    "attribution" VARCHAR(255) NOT NULL,
    "provenance" VARCHAR(64) NOT NULL,
    "provider_version" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dictionary_senses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lexeme_id" UUID NOT NULL,
    "dictionary_sense_id" UUID,
    "sense_key" VARCHAR(160) NOT NULL,
    "part_of_speech" VARCHAR(32) NOT NULL,
    "definition" VARCHAR(1000) NOT NULL,
    "definition_provenance" VARCHAR(64) NOT NULL,
    "attribution" VARCHAR(255),
    "source_context" VARCHAR(3000),
    "note" VARCHAR(3000) NOT NULL DEFAULT '',
    "importance" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vocabulary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_tags" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "normalized_name" VARCHAR(50) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_tags" (
    "user_id" UUID NOT NULL,
    "vocabulary_item_id" UUID NOT NULL,
    "context_tag_id" UUID NOT NULL,

    CONSTRAINT "vocabulary_tags_pkey" PRIMARY KEY ("vocabulary_item_id","context_tag_id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "operation" VARCHAR(64) NOT NULL,
    "key" UUID NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lexemes_normalized_lemma_key" ON "lexemes"("normalized_lemma");

-- CreateIndex
CREATE INDEX "dictionary_senses_lexeme_id_part_of_speech_idx" ON "dictionary_senses"("lexeme_id", "part_of_speech");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_senses_provider_id_source_sense_id_key" ON "dictionary_senses"("provider_id", "source_sense_id");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_senses_id_lexeme_id_key" ON "dictionary_senses"("id", "lexeme_id");

-- CreateIndex
CREATE INDEX "vocabulary_items_user_id_archived_at_created_at_id_idx" ON "vocabulary_items"("user_id", "archived_at", "created_at", "id");

-- CreateIndex
CREATE INDEX "vocabulary_items_user_id_lexeme_id_idx" ON "vocabulary_items"("user_id", "lexeme_id");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_items_user_id_sense_key_key" ON "vocabulary_items"("user_id", "sense_key");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_items_id_user_id_key" ON "vocabulary_items"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "context_tags_user_id_normalized_name_key" ON "context_tags"("user_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "context_tags_id_user_id_key" ON "context_tags"("id", "user_id");

-- CreateIndex
CREATE INDEX "vocabulary_tags_user_id_context_tag_id_idx" ON "vocabulary_tags"("user_id", "context_tag_id");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_user_id_operation_key_key" ON "idempotency_records"("user_id", "operation", "key");

-- AddForeignKey
ALTER TABLE "dictionary_senses" ADD CONSTRAINT "dictionary_senses_lexeme_id_fkey" FOREIGN KEY ("lexeme_id") REFERENCES "lexemes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_lexeme_id_fkey" FOREIGN KEY ("lexeme_id") REFERENCES "lexemes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_dictionary_sense_id_lexeme_id_fkey" FOREIGN KEY ("dictionary_sense_id", "lexeme_id") REFERENCES "dictionary_senses"("id", "lexeme_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_tags" ADD CONSTRAINT "context_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_tags" ADD CONSTRAINT "vocabulary_tags_vocabulary_item_id_user_id_fkey" FOREIGN KEY ("vocabulary_item_id", "user_id") REFERENCES "vocabulary_items"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_tags" ADD CONSTRAINT "vocabulary_tags_context_tag_id_user_id_fkey" FOREIGN KEY ("context_tag_id", "user_id") REFERENCES "context_tags"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain bounds and normalized identity. All operations above are additive.
ALTER TABLE "lexemes" ADD CONSTRAINT "lexemes_normalized_lemma_check" CHECK (
    length("normalized_lemma") BETWEEN 1 AND 100
    AND "normalized_lemma" = lower(btrim("normalized_lemma"))
);
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_bounds_check" CHECK (
    "importance" BETWEEN 1 AND 3
    AND "version" >= 1
    AND length("definition") BETWEEN 1 AND 1000
    AND ("source_context" IS NULL OR length("source_context") BETWEEN 1 AND 3000)
);
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_provenance_check" CHECK (
    ("dictionary_sense_id" IS NULL AND "definition_provenance" = 'USER_AUTHORED')
    OR ("dictionary_sense_id" IS NOT NULL AND "definition_provenance" <> 'USER_AUTHORED')
);
ALTER TABLE "context_tags" ADD CONSTRAINT "context_tags_name_check" CHECK (
    length("name") BETWEEN 1 AND 50
    AND length("normalized_name") BETWEEN 1 AND 50
    AND "normalized_name" = lower(btrim("normalized_name"))
    AND "version" >= 1
);
