ALTER TABLE "bins" ADD COLUMN "name" varchar(128) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "bins" ADD COLUMN "address" text DEFAULT '' NOT NULL;
