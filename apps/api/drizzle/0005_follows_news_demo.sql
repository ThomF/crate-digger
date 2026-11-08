CREATE TABLE `follows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`follower_id` integer NOT NULL,
	`followee_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`followee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "follows_no_self" CHECK("follows"."follower_id" <> "follows"."followee_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follows_follower_followee_unique` ON `follows` (`follower_id`,`followee_id`);--> statement-breakpoint
CREATE INDEX `follows_followee_idx` ON `follows` (`followee_id`);--> statement-breakpoint
CREATE TABLE `news_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seed_key` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`source` text NOT NULL,
	`published_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_items_seed_key_unique` ON `news_items` (`seed_key`);--> statement-breakpoint
ALTER TABLE `albums` ADD `demo_seed_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `albums_demo_seed_key_unique` ON `albums` (`demo_seed_key`);--> statement-breakpoint
ALTER TABLE `crates` ADD `demo_seed_key` text;--> statement-breakpoint
ALTER TABLE `crates` ADD `recommended_rank` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `crates_demo_seed_key_unique` ON `crates` (`demo_seed_key`);--> statement-breakpoint
ALTER TABLE `users` ADD `demo_seed_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_demo_seed_key_unique` ON `users` (`demo_seed_key`);