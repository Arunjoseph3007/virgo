PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_params` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspaceName` text NOT NULL,
	`projectName` text NOT NULL,
	`type` text NOT NULL,
	`key` text NOT NULL,
	`value` text,
	FOREIGN KEY (`projectName`,`workspaceName`) REFERENCES `workspaces`(`projectName`,`projectName`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_params`("id", "workspaceName", "projectName", "type", "key", "value") SELECT "id", "workspaceName", "projectName", "type", "key", "value" FROM `params`;--> statement-breakpoint
DROP TABLE `params`;--> statement-breakpoint
ALTER TABLE `__new_params` RENAME TO `params`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `params_workspaceName_key_type_unique` ON `params` (`workspaceName`,`key`,`type`);--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`name` text(20) PRIMARY KEY NOT NULL,
	`folder` text DEFAULT '.' NOT NULL,
	`repoId` integer NOT NULL,
	FOREIGN KEY (`repoId`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_projects`("name", "folder", "repoId") SELECT "name", "folder", "repoId" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
CREATE TABLE `__new_workspaces` (
	`name` text(20) NOT NULL,
	`projectName` text(20) NOT NULL,
	`gitTarget` text NOT NULL,
	`health` text DEFAULT 'OUT_OF_SYNC' NOT NULL,
	PRIMARY KEY(`name`, `projectName`),
	FOREIGN KEY (`projectName`) REFERENCES `projects`(`name`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_workspaces`("name", "projectName", "gitTarget", "health") SELECT "name", "projectName", "gitTarget", "health" FROM `workspaces`;--> statement-breakpoint
DROP TABLE `workspaces`;--> statement-breakpoint
ALTER TABLE `__new_workspaces` RENAME TO `workspaces`;--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_name_projectName_unique` ON `workspaces` (`name`,`projectName`);