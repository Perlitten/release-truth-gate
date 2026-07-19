ALTER TYPE "public"."decision_type" ADD VALUE 'assignment';--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "assignee_id" uuid;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;