CREATE TABLE `albums` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`crate_id` integer NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`year` integer,
	`genre` text,
	`format` text DEFAULT 'LP' NOT NULL,
	`cover_path` text,
	`sleeve_color` text DEFAULT '#2b2118' NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`crate_id`) REFERENCES `crates`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "albums_rating_range" CHECK("albums"."rating" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE INDEX `albums_crate_position_idx` ON `albums` (`crate_id`,`position`);--> statement-breakpoint
CREATE TABLE `crates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#c8a374' NOT NULL,
	`label` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`album_id` integer NOT NULL,
	`side` text DEFAULT 'A' NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`duration_sec` integer,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tracks_album_side_position_idx` ON `tracks` (`album_id`,`side`,`position`);