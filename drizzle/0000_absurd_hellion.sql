CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`category` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subjects_owner` ON `subjects` (`owner`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`subject_id` text NOT NULL,
	`type` text NOT NULL,
	`priority` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`due_date` text,
	`due_time` text,
	`repeat` text DEFAULT 'none' NOT NULL,
	`interval` integer DEFAULT 1 NOT NULL,
	`anchor_day` integer,
	`completed_at` text,
	`created_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`parent_id` text,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_owner` ON `tasks` (`owner`);--> statement-breakpoint
CREATE INDEX `tasks_parent` ON `tasks` (`parent_id`);