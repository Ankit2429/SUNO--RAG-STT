CREATE TABLE `benchmarkSamples` (
	`id` varchar(64) NOT NULL,
	`cacheMode` enum('cold','warm') NOT NULL,
	`language` varchar(32) NOT NULL,
	`adversarial` int NOT NULL,
	`outcome` varchar(16) NOT NULL,
	`ragMs` int NOT NULL,
	`sttMs` int NOT NULL,
	`endToEndMs` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `benchmarkSamples_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ragRuns` (
	`id` varchar(64) NOT NULL,
	`status` varchar(16) NOT NULL,
	`transcript` text NOT NULL,
	`language` varchar(32) NOT NULL,
	`script` varchar(32) NOT NULL,
	`answer` text NOT NULL,
	`evidenceIds` text NOT NULL,
	`confidenceBand` varchar(16) NOT NULL,
	`refusalReason` text,
	`sttMs` int NOT NULL,
	`ragMs` int NOT NULL,
	`endToEndMs` int NOT NULL,
	`trace` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ragRuns_id` PRIMARY KEY(`id`)
);
