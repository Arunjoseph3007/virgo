CREATE TABLE `history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspaceName` text(20) NOT NULL,
	`projectName` text(20) NOT NULL,
	`varInfo` text DEFAULT '{"vars":{},"varFile":[]}' NOT NULL,
	`repoUrl` text NOT NULL,
	`revision` text(40) NOT NULL,
	`author` text NOT NULL,
	`comment` text,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`workspaceName`) REFERENCES `workspaces`(`name`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`projectName`) REFERENCES `workspaces`(`projectName`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_repos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`connected` integer DEFAULT false
);
--> statement-breakpoint
INSERT INTO `__new_repos`("id", "name", "url", "connected") SELECT "id", "name", "url", "connected" FROM `repos`;--> statement-breakpoint
DROP TABLE `repos`;--> statement-breakpoint
ALTER TABLE `__new_repos` RENAME TO `repos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;