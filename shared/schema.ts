import { pgTable, text, serial, integer, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Settings Table
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  weeklyReminders: boolean("weekly_reminders").default(true).notNull(),
  journalPrompts: boolean("journal_prompts").default(true).notNull(),
  uploadDay: text("upload_day").default("sunday").notNull(),
  sleepGoal: real("sleep_goal").default(8).notNull(),
  stepsGoal: integer("steps_goal").default(10000).notNull(),
  journalFrequency: text("journal_frequency").default("weekly").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Journal Entries Table
export const journals = pgTable("journals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: text("date").notNull(), // ISO date format 'YYYY-MM-DD'
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertJournalSchema = createInsertSchema(journals).omit({
  id: true,
  createdAt: true
});

export type InsertJournal = z.infer<typeof insertJournalSchema>;
export type Journal = typeof journals.$inferSelect;

// Mood Entries Table
export const moods = pgTable("moods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: text("date").notNull(), // ISO date format 'YYYY-MM-DD'
  value: integer("value").notNull(), // Mood on scale 0-100
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertMoodSchema = createInsertSchema(moods).omit({
  id: true,
  createdAt: true
});

export type InsertMood = z.infer<typeof insertMoodSchema>;
export type Mood = typeof moods.$inferSelect;

// Sleep Entries Table
export const sleep = pgTable("sleep", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: text("date").notNull(), // ISO date format 'YYYY-MM-DD'
  hours: real("hours").notNull(), // Sleep duration in hours
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertSleepSchema = createInsertSchema(sleep).omit({
  id: true,
  createdAt: true
});

export type InsertSleep = z.infer<typeof insertSleepSchema>;
export type Sleep = typeof sleep.$inferSelect;

// Activity Entries Table
export const activity = pgTable("activity", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: text("date").notNull(), // ISO date format 'YYYY-MM-DD'
  steps: integer("steps").notNull(), // Number of steps
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertActivitySchema = createInsertSchema(activity).omit({
  id: true,
  createdAt: true
});

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activity.$inferSelect;

// Tips Table
export const tips = pgTable("tips", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertTipSchema = createInsertSchema(tips).omit({
  id: true,
  createdAt: true
});

export type InsertTip = z.infer<typeof insertTipSchema>;
export type Tip = typeof tips.$inferSelect;

// User Achievements Table
export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  achievementId: text("achievement_id").notNull(),
  unlocked: boolean("unlocked").default(false).notNull(),
  unlockedAt: text("unlocked_at"),
  progress: integer("progress"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Achievements Table (master definitions)
export const achievements = pgTable("achievements", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  goal: integer("goal"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  createdAt: true
});

export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievements.$inferSelect;

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;

// Journal Insights Table
export const journalInsights = pgTable("journal_insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  themes: text("themes").array().notNull(),
  correlations: text("correlations").array().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertJournalInsightSchema = createInsertSchema(journalInsights).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertJournalInsight = z.infer<typeof insertJournalInsightSchema>;
export type JournalInsight = typeof journalInsights.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  settings: many(settings),
  journals: many(journals),
  moods: many(moods),
  sleep: many(sleep),
  activity: many(activity),
  journalInsights: many(journalInsights),
  userAchievements: many(userAchievements)
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, { fields: [settings.userId], references: [users.id] })
}));

export const journalsRelations = relations(journals, ({ one }) => ({
  user: one(users, { fields: [journals.userId], references: [users.id] })
}));

export const moodsRelations = relations(moods, ({ one }) => ({
  user: one(users, { fields: [moods.userId], references: [users.id] })
}));

export const sleepRelations = relations(sleep, ({ one }) => ({
  user: one(users, { fields: [sleep.userId], references: [users.id] })
}));

export const activityRelations = relations(activity, ({ one }) => ({
  user: one(users, { fields: [activity.userId], references: [users.id] })
}));

export const journalInsightsRelations = relations(journalInsights, ({ one }) => ({
  user: one(users, { fields: [journalInsights.userId], references: [users.id] })
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, { fields: [userAchievements.userId], references: [users.id] }),
  achievement: one(achievements, { fields: [userAchievements.achievementId], references: [achievements.id] })
}));

export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements)
}));
