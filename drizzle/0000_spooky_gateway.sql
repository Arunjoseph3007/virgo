CREATE TABLE `params` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspaceName` text NOT NULL,
	`projectName` text NOT NULL,
	`type` text NOT NULL,
	`key` text NOT NULL,
	`value` text,
	FOREIGN KEY (`projectName`,`workspaceName`) REFERENCES `workspaces`(`projectName`,`projectName`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `params_workspaceName_key_type_unique` ON `params` (`workspaceName`,`key`,`type`);--> statement-breakpoint
CREATE TABLE `projects` (
	`name` text(20) PRIMARY KEY NOT NULL,
	`folder` text DEFAULT '.' NOT NULL,
	`repoId` integer NOT NULL,
	FOREIGN KEY (`repoId`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `repos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`name` text(20) NOT NULL,
	`projectName` text(20) NOT NULL,
	`gitTarget` text NOT NULL,
	`health` text DEFAULT 'OUT_OF_SYNC' NOT NULL,
	FOREIGN KEY (`projectName`) REFERENCES `projects`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_name_projectName_unique` ON `workspaces` (`name`,`projectName`);