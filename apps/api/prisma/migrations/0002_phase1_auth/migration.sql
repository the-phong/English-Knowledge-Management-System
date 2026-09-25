-- Phase 1 authentication rotation and security audit support.
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_session_id" TEXT,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");
CREATE UNIQUE INDEX "refresh_sessions_replaced_by_id_key" ON "refresh_sessions"("replaced_by_id");
CREATE INDEX "refresh_sessions_family_id_idx" ON "refresh_sessions"("family_id");
CREATE INDEX "security_events_user_id_created_at_idx" ON "security_events"("user_id", "created_at");

ALTER TABLE "refresh_sessions"
ADD CONSTRAINT "refresh_sessions_replaced_by_id_fkey"
FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "security_events"
ADD CONSTRAINT "security_events_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "security_events"
ADD CONSTRAINT "security_events_refresh_session_id_fkey"
FOREIGN KEY ("refresh_session_id") REFERENCES "refresh_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
