import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const ragRuns = mysqlTable("ragRuns", {
  id: varchar("id", { length: 64 }).primaryKey(),
  status: varchar("status", { length: 16 }).notNull(),
  transcript: text("transcript").notNull(),
  language: varchar("language", { length: 32 }).notNull(),
  script: varchar("script", { length: 32 }).notNull(),
  answer: text("answer").notNull(),
  evidenceIds: text("evidenceIds").notNull(),
  confidenceBand: varchar("confidenceBand", { length: 16 }).notNull(),
  refusalReason: text("refusalReason"),
  sttMs: int("sttMs").notNull(),
  ragMs: int("ragMs").notNull(),
  endToEndMs: int("endToEndMs").notNull(),
  trace: text("trace").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const benchmarkSamples = mysqlTable("benchmarkSamples", {
  id: varchar("id", { length: 64 }).primaryKey(),
  cacheMode: mysqlEnum("cacheMode", ["cold", "warm"]).notNull(),
  language: varchar("language", { length: 32 }).notNull(),
  adversarial: int("adversarial").notNull(),
  outcome: varchar("outcome", { length: 16 }).notNull(),
  ragMs: int("ragMs").notNull(),
  sttMs: int("sttMs").notNull(),
  endToEndMs: int("endToEndMs").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RagRun = typeof ragRuns.$inferSelect;
export type InsertRagRun = typeof ragRuns.$inferInsert;
export type BenchmarkSample = typeof benchmarkSamples.$inferSelect;
