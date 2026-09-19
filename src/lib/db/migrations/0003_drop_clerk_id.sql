ALTER TABLE "users" DROP CONSTRAINT "users_clerk_id_unique";--> statement-breakpoint
DROP INDEX "users_clerk_id_idx";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "clerk_id";