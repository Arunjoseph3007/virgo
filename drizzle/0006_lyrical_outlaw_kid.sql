PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspaceName` text(20) NOT NULL,
	`projectName` text(20) NOT NULL,
	`varInfo` text NOT NULL,
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
INSERT INTO `__new_history`("id", "workspaceName", "projectName", "varInfo", "repoUrl", "revision", "author", "comment", "createdAt", "updatedAt") SELECT "id", "workspaceName", "projectName", "varInfo", "repoUrl", "revision", "author", "comment", "createdAt", "updatedAt" FROM `history`;--> statement-breakpoint
DROP TABLE `history`;--> statement-breakpoint
ALTER TABLE `__new_history` RENAME TO `history`;--> statement-breakpoint
PRAGMA foreign_keys=ON;