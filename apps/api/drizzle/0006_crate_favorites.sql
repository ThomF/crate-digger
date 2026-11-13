CREATE TABLE `crate_favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`crate_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`crate_id`) REFERENCES `crates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crate_favorites_user_crate_unique` ON `crate_favorites` (`user_id`,`crate_id`);--> statement-breakpoint
CREATE INDEX `crate_favorites_crate_idx` ON `crate_favorites` (`crate_id`);