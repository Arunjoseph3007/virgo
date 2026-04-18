PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_params` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspaceName` text NOT NULL,
	`projectName` text NOT NULL,
	`type` text NOT NULL,
	`key` text NOT NULL,
	`value` text,
	FOREIGN KEY (`projectName`,`workspaceName`) REFERENCES `workspaces`(`projectName`,`name`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_params`("id", "workspaceName", "projectName", "type", "key", "value") SELECT "id", "workspaceName", "projectName", "type", "key", "value" FROM `params`;--> statement-breakpoint
DROP TABLE `params`;--> statement-breakpoint
ALTER TABLE `__new_params` RENAME TO `params`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `params_workspaceName_key_type_unique` ON `params` (`workspaceName`,`key`,`type`);