CREATE TABLE "exam_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_id" integer NOT NULL,
	"access_code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"start_time" timestamp DEFAULT now(),
	"end_time" timestamp
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"teacher_id" integer NOT NULL,
	"access_code" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "exams_access_code_unique" UNIQUE("access_code")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_id" integer NOT NULL,
	"text" text NOT NULL,
	"type" text NOT NULL,
	"options" jsonb,
	"correct_answer" text,
	"rubric" text,
	"points" integer DEFAULT 1 NOT NULL,
	"order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"exam_id" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"submitted_at" timestamp,
	"responses" jsonb,
	"grades" jsonb,
	"total_score" integer
);
--> statement-breakpoint
CREATE TABLE "teacher_student_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"institution" text,
	"profile_code" text,
	"status" text DEFAULT 'active' NOT NULL,
	"validated_at" timestamp,
	"avatar_url" text,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_profile_code_unique" UNIQUE("profile_code")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submissions_student_idx" ON "submissions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "submissions_session_idx" ON "submissions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "submissions_exam_idx" ON "submissions" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "links_teacher_idx" ON "teacher_student_links" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "links_student_idx" ON "teacher_student_links" USING btree ("student_id");