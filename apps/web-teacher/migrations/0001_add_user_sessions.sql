CREATE TABLE IF NOT EXISTS "user_sessions" (
	"sid" varchar NOT NULL COLLATE "default",
	"sess" json NOT NULL,
	"expire" timestamp(6) NOT NULL,
	CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
) WITH (OIDS=FALSE);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");
