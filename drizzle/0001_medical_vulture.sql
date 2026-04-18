PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workspaces` (
	`name` text(20) NOT NULL,
	`projectName` text(20) NOT NULL,
	`gitTarget` text NOT NULL,
	`health` text DEFAULT 'OUT_OF_SYNC' NOT NULL,
	PRIMARY KEY(`name`, `projectName`),
	FOREIGN KEY (`projectName`) REFERENCES `projects`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_workspaces`("name", "projectName", "gitTarget", "health") SELECT "name", "projectName", "gitTarget", "health" FROM `workspaces`;--> statement-breakpoint
DROP TABLE `workspaces`;--> statement-breakpoint
ALTER TABLE `__new_workspaces` RENAME TO `workspaces`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_name_projectName_unique` ON `workspaces` (`name`,`projectName`);