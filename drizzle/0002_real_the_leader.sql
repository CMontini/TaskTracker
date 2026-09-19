CREATE TABLE `workspace_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`task_count` integer NOT NULL,
	`completed_at` text NOT NULL
);
