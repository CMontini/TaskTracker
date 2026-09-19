CREATE TABLE `workspace_initialization` (
	`owner` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `subjects` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `archived_at` text;