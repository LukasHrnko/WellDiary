import { db } from "@db";
import {
  users,
  settings,
  journals,
  moods,
  sleep,
  activity,
  tips,
  achievements,
  userAchievements,
  journalInsights,
  InsertUser,
  InsertJournal,
  InsertMood,
  InsertSleep,
  InsertActivity,
  InsertTip,
  InsertAchievement,
  InsertUserAchievement,
  InsertJournalInsight,
  InsertSettings,
  User,
  Journal,
  Mood,
  Sleep,
  Activity,
  Tip,
  Achievement,
  JournalInsight,
  Settings
} from "@shared/schema";
import { eq, and, desc, asc, gte, lte, sql, between } from "drizzle-orm";
import { startOfWeek, endOfWeek, format, subDays } from "date-fns";

/**
 * User methods
 */
export async function getUserById(id: number): Promise<User | undefined> {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0];
}

export async function insertUser(userData: InsertUser): Promise<User> {
  const result = await db.insert(users).values(userData).returning();
  return result[0];
}

/**
 * Settings methods
 */
export async function getSettings(userId: number): Promise<Settings | undefined> {
  const result = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  return result[0];
}

export async function updateSettings(userId: number, settingsData: Partial<InsertSettings>): Promise<Settings> {
  const result = await db
    .update(settings)
    .set(settingsData)
    .where(eq(settings.userId, userId))
    .returning();
  return result[0];
}

export async function createSettings(settingsData: InsertSettings): Promise<Settings> {
  const result = await db.insert(settings).values(settingsData).returning();
  return result[0];
}

/**
 * Journal methods
 */
export async function getJournalEntries(userId: number, limit = 20, offset = 0): Promise<Journal[]> {
  return await db
    .select()
    .from(journals)
    .where(eq(journals.userId, userId))
    .orderBy(desc(journals.date))
    .limit(limit)
    .offset(offset);
}

export async function getJournalById(journalId: number): Promise<Journal | undefined> {
  const result = await db.select().from(journals).where(eq(journals.id, journalId)).limit(1);
  return result[0];
}

export async function getLastJournalUpload(userId: number): Promise<{ lastUploadDate: string | null }> {
  const result = await db
    .select({ lastUploadDate: journals.date })
    .from(journals)
    .where(eq(journals.userId, userId))
    .orderBy(desc(journals.date))
    .limit(1);
  
  return { lastUploadDate: result[0]?.lastUploadDate || null };
}

export async function insertJournal(journalData: InsertJournal): Promise<Journal> {
  const result = await db.insert(journals).values(journalData).returning();
  return result[0];
}

export async function updateJournal(journalId: number, journalData: Partial<InsertJournal>): Promise<Journal> {
  const result = await db
    .update(journals)
    .set(journalData)
    .where(eq(journals.id, journalId))
    .returning();
  return result[0];
}

/**
 * Mood methods
 */
export async function getMoods(userId: number, startDate: string, endDate: string): Promise<{ moods: Mood[], average: number }> {
  const moodData = await db
    .select()
    .from(moods)
    .where(
      and(
        eq(moods.userId, userId),
        gte(moods.date, startDate),
        lte(moods.date, endDate)
      )
    )
    .orderBy(asc(moods.date));
  
  // Calculate average mood
  const total = moodData.reduce((sum, mood) => sum + mood.value, 0);
  const average = moodData.length > 0 ? Math.round(total / moodData.length) : 0;
  
  return { moods: moodData, average };
}

export async function getWeeklyMoods(userId: number, date: string): Promise<{
  moods: Mood[];
  average: number;
  weeklyChange: number;
}> {
  const currentDate = new Date(date);
  const currentWeekStart = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const currentWeekEnd = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  
  const previousWeekStart = format(startOfWeek(subDays(currentDate, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const previousWeekEnd = format(endOfWeek(subDays(currentDate, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  
  // Get current week's moods
  const { moods: currentMoods, average: currentAverage } = await getMoods(
    userId,
    currentWeekStart,
    currentWeekEnd
  );
  
  // Get previous week's moods
  const { average: previousAverage } = await getMoods(
    userId,
    previousWeekStart,
    previousWeekEnd
  );
  
  // Calculate change
  const weeklyChange = currentAverage - previousAverage;
  
  return {
    moods: currentMoods,
    average: currentAverage,
    weeklyChange
  };
}

export async function insertMood(moodData: InsertMood): Promise<Mood> {
  const result = await db.insert(moods).values(moodData).returning();
  return result[0];
}

export async function getMonthlyMoodData(userId: number, startDate: string, endDate: string): Promise<{
  moods: Mood[];
  average: number;
  stability: number;
  goodDays: number;
  bestDay: string;
}> {
  const { moods, average } = await getMoods(userId, startDate, endDate);
  
  // Calculate mood stability (100 - standard deviation as a percentage of max range)
  const values = moods.map(m => m.value);
  const stdDev = values.length > 1 
    ? Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length) 
    : 0;
  const stability = Math.round(Math.max(0, 100 - (stdDev / 100) * 100));
  
  // Count good days (mood >= 70)
  const goodDays = moods.filter(m => m.value >= 70).length;
  
  // Find best day
  const bestMood = moods.reduce((prev, current) => (prev.value > current.value) ? prev : current, { value: 0, date: "" } as Mood);
  const bestDay = bestMood.date ? format(new Date(bestMood.date), 'EEEE') : 'N/A';
  
  return {
    moods,
    average,
    stability,
    goodDays,
    bestDay
  };
}

/**
 * Sleep methods
 */
export async function getSleep(userId: number, startDate: string, endDate: string): Promise<{
  sleep: Sleep[];
  average: number;
  goal: number;
}> {
  const sleepData = await db
    .select()
    .from(sleep)
    .where(
      and(
        eq(sleep.userId, userId),
        gte(sleep.date, startDate),
        lte(sleep.date, endDate)
      )
    )
    .orderBy(asc(sleep.date));
  
  // Get user's sleep goal from settings
  const userSettings = await getSettings(userId);
  const goal = userSettings?.sleepGoal || 8;
  
  // Calculate average sleep
  const total = sleepData.reduce((sum, entry) => sum + entry.hours, 0);
  const average = sleepData.length > 0 ? total / sleepData.length : 0;
  
  return { sleep: sleepData, average, goal };
}

export async function getWeeklySleep(userId: number, date: string): Promise<{
  sleep: Sleep[];
  average: number;
  weeklyChange: number;
  goal: number;
  goalPercentage: number;
}> {
  const currentDate = new Date(date);
  const currentWeekStart = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const currentWeekEnd = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  
  const previousWeekStart = format(startOfWeek(subDays(currentDate, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const previousWeekEnd = format(endOfWeek(subDays(currentDate, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  
  // Get current week's sleep
  const { sleep: currentSleep, average: currentAverage, goal } = await getSleep(
    userId,
    currentWeekStart,
    currentWeekEnd
  );
  
  // Get previous week's sleep
  const { average: previousAverage } = await getSleep(
    userId,
    previousWeekStart,
    previousWeekEnd
  );
  
  // Calculate change
  const weeklyChange = currentAverage - previousAverage;
  
  // Calculate goal percentage
  const goalPercentage = Math.min(100, (currentAverage / goal) * 100);
  
  return {
    sleep: currentSleep,
    average: currentAverage,
    weeklyChange,
    goal,
    goalPercentage
  };
}

export async function insertSleep(sleepData: InsertSleep): Promise<Sleep> {
  const result = await db.insert(sleep).values(sleepData).returning();
  return result[0];
}

export async function getMonthlySleepData(userId: number, startDate: string, endDate: string): Promise<{
  sleep: Sleep[];
  average: number;
  goal: number;
  goalPercentage: number;
  qualityScore: number;
  consistency: number;
  optimalNights: number;
}> {
  const { sleep: sleepData, average, goal } = await getSleep(userId, startDate, endDate);
  
  // Calculate goal percentage
  const goalPercentage = Math.min(100, (average / goal) * 100);
  
  // Calculate quality score as a weighted average of duration and consistency
  const stdDev = sleepData.length > 1 
    ? Math.sqrt(sleepData.reduce((sum, s) => sum + Math.pow(s.hours - average, 2), 0) / sleepData.length) 
    : 0;
  
  // Lower standard deviation means better consistency
  const consistencyScore = Math.max(0, 100 - (stdDev / goal) * 100);
  
  // Duration score based on how close to goal
  const durationScore = Math.min(100, (average / goal) * 100);
  
  // Quality score is weighted average (60% duration, 40% consistency)
  const qualityScore = Math.round((durationScore * 0.6) + (consistencyScore * 0.4));
  
  // Consistency as a percentage
  const consistency = Math.round(consistencyScore);
  
  // Count optimal nights (within 1 hour of goal)
  const optimalNights = sleepData.filter(s => Math.abs(s.hours - goal) <= 1).length;
  
  return {
    sleep: sleepData,
    average,
    goal,
    goalPercentage,
    qualityScore,
    consistency,
    optimalNights
  };
}

/**
 * Activity methods
 */
export async function getActivity(userId: number, startDate: string, endDate: string): Promise<{
  activity: Activity[];
  average: number;
  goal: number;
}> {
  const activityData = await db
    .select()
    .from(activity)
    .where(
      and(
        eq(activity.userId, userId),
        gte(activity.date, startDate),
        lte(activity.date, endDate)
      )
    )
    .orderBy(asc(activity.date));
  
  // Get user's step goal from settings
  const userSettings = await getSettings(userId);
  const goal = userSettings?.stepsGoal || 10000;
  
  // Calculate average steps
  const total = activityData.reduce((sum, entry) => sum + entry.steps, 0);
  const average = activityData.length > 0 ? Math.round(total / activityData.length) : 0;
  
  return { activity: activityData, average, goal };
}

export async function getWeeklyActivity(userId: number, date: string): Promise<{
  activity: Activity[];
  average: number;
  weeklyChange: number;
  goal: number;
  goalPercentage: number;
}> {
  const currentDate = new Date(date);
  const currentWeekStart = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const currentWeekEnd = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  
  const previousWeekStart = format(startOfWeek(subDays(currentDate, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const previousWeekEnd = format(endOfWeek(subDays(currentDate, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  
  // Get current week's activity
  const { activity: currentActivity, average: currentAverage, goal } = await getActivity(
    userId,
    currentWeekStart,
    currentWeekEnd
  );
  
  // Get previous week's activity
  const { average: previousAverage } = await getActivity(
    userId,
    previousWeekStart,
    previousWeekEnd
  );
  
  // Calculate change
  const weeklyChange = currentAverage - previousAverage;
  
  // Calculate goal percentage
  const goalPercentage = Math.min(100, (currentAverage / goal) * 100);
  
  return {
    activity: currentActivity,
    average: currentAverage,
    weeklyChange,
    goal,
    goalPercentage
  };
}

export async function insertActivity(activityData: InsertActivity): Promise<Activity> {
  const result = await db.insert(activity).values(activityData).returning();
  return result[0];
}

export async function getMonthlyActivityData(userId: number, startDate: string, endDate: string): Promise<{
  activity: Activity[];
  average: number;
  goal: number;
  goalPercentage: number;
  caloriesBurned: number;
  activeDays: number;
}> {
  const { activity: activityData, average, goal } = await getActivity(userId, startDate, endDate);
  
  // Calculate goal percentage
  const goalPercentage = Math.min(100, (average / goal) * 100);
  
  // Calculate average calories burned (very rough estimation)
  // Assume 1 step = 0.04 calories on average
  const caloriesBurned = Math.round(average * 0.04);
  
  // Count active days (>= 70% of goal)
  const activeDays = activityData.filter(a => a.steps >= goal * 0.7).length;
  
  return {
    activity: activityData,
    average,
    goal,
    goalPercentage,
    caloriesBurned,
    activeDays
  };
}

/**
 * Tips methods
 */
export async function getTips(userId: number, limit = 3): Promise<Tip[]> {
  return await db
    .select()
    .from(tips)
    .orderBy(sql`RANDOM()`)
    .limit(limit);
}

export async function getAllTips(): Promise<{
  tips: Tip[];
  categories: string[];
}> {
  const tipsData = await db.select().from(tips);
  
  // Extract unique categories
  const categories = [...new Set(tipsData.map(tip => tip.category))];
  
  return { tips: tipsData, categories };
}

export async function insertTip(tipData: InsertTip): Promise<Tip> {
  const result = await db.insert(tips).values(tipData).returning();
  return result[0];
}

/**
 * Achievements methods
 */
export async function getAchievements(userId: number, limit = 3): Promise<any[]> {
  // Get all master achievements
  const masterAchievements = await db
    .select()
    .from(achievements);
  
  // Get user-specific achievement progress
  const userAchievementsResult = await db
    .select()
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  
  // If no user achievements found, create default entries for each achievement
  if (userAchievementsResult.length === 0) {
    await initializeUserAchievements(userId, masterAchievements);
    return getAchievements(userId, limit); // Retry after initialization
  }
  
  // Combine master achievement definitions with user progress
  const combinedAchievements = masterAchievements.map(achievement => {
    const userProgress = userAchievementsResult.find(ua => ua.achievementId === achievement.id);
    return {
      ...achievement,
      unlocked: userProgress ? userProgress.unlocked : false,
      unlockedAt: userProgress ? userProgress.unlockedAt : null,
      progress: userProgress ? userProgress.progress : 0
    };
  });
  
  // Sort by unlocked (unlocked first), then by unlockedAt (most recent first)
  combinedAchievements.sort((a, b) => {
    if (a.unlocked === b.unlocked) {
      if (!a.unlockedAt && !b.unlockedAt) return 0;
      if (!a.unlockedAt) return 1;
      if (!b.unlockedAt) return -1;
      return new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime();
    }
    return a.unlocked ? -1 : 1;
  });
  
  return limit ? combinedAchievements.slice(0, limit) : combinedAchievements;
}

export async function getAllAchievements(userId: number): Promise<{
  achievements: any[];
  categories: string[];
}> {
  const achievementsData = await getAchievements(userId, 0); // 0 = no limit
  
  // Extract unique categories
  const categories = [...new Set(achievementsData.map(achievement => achievement.category))];
  
  return { achievements: achievementsData, categories };
}

export async function insertAchievement(achievementData: InsertAchievement): Promise<Achievement> {
  const result = await db.insert(achievements).values(achievementData).returning();
  return result[0];
}

export async function initializeUserAchievements(userId: number, masterAchievements?: Achievement[]): Promise<void> {
  // Get all master achievements if not provided
  if (!masterAchievements) {
    masterAchievements = await db.select().from(achievements);
  }
  
  // Create default user achievement entries for each master achievement
  for (const achievement of masterAchievements) {
    await db.insert(userAchievements).values({
      userId,
      achievementId: achievement.id,
      unlocked: false,
      progress: 0
    });
  }
}

export async function updateUserAchievement(userId: number, achievementId: string, data: Partial<InsertUserAchievement>): Promise<void> {
  await db
    .update(userAchievements)
    .set({
      ...data,
      updatedAt: new Date() // Automatically converted to ISO string by Drizzle
    })
    .where(
      and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, achievementId)
      )
    );
}

/**
 * Journal Insights methods
 */
export async function getJournalInsights(userId: number): Promise<{
  themes: { id: string; text: string; bgColor: string; textColor: string }[];
  correlations: { id: string; text: string; positive: boolean }[];
}> {
  const insightsData = await db
    .select()
    .from(journalInsights)
    .where(eq(journalInsights.userId, userId))
    .limit(1);
  
  if (insightsData.length === 0) {
    return { themes: [], correlations: [] };
  }
  
  // Process themes data
  const themes = insightsData[0].themes.map((theme, index) => ({
    id: `theme-${index}`,
    text: theme,
    bgColor: getThemeColor(theme).bg,
    textColor: getThemeColor(theme).text
  }));
  
  // Process correlations data
  const correlations = insightsData[0].correlations.map((correlation, index) => {
    const isPositive = !correlation.includes("Lower") && 
                       !correlation.includes("Decreased") &&
                       !correlation.includes("Worse");
    
    return {
      id: `correlation-${index}`,
      text: correlation,
      positive: isPositive
    };
  });
  
  return { themes, correlations };
}

export async function insertJournalInsight(insightData: InsertJournalInsight): Promise<JournalInsight> {
  const result = await db.insert(journalInsights).values(insightData).returning();
  return result[0];
}

// Helper function to assign colors to themes
function getThemeColor(theme: string): { bg: string; text: string } {
  // Map common themes to specific colors
  const themeColors: Record<string, { bg: string; text: string }> = {
    "work": { bg: "bg-blue-50", text: "text-blue-700" },
    "stress": { bg: "bg-red-50", text: "text-red-700" },
    "family": { bg: "bg-green-50", text: "text-green-700" },
    "exercise": { bg: "bg-purple-50", text: "text-purple-700" },
    "reading": { bg: "bg-yellow-50", text: "text-yellow-700" },
    "anxiety": { bg: "bg-red-50", text: "text-red-700" },
    "sleep": { bg: "bg-blue-50", text: "text-blue-700" },
    "food": { bg: "bg-orange-50", text: "text-orange-700" },
    "meditation": { bg: "bg-purple-50", text: "text-purple-700" },
    "friends": { bg: "bg-indigo-50", text: "text-indigo-700" },
    "gratitude": { bg: "bg-green-50", text: "text-green-700" },
    "health": { bg: "bg-emerald-50", text: "text-emerald-700" },
    "social": { bg: "bg-indigo-50", text: "text-indigo-700" },
  };
  
  // Check if the theme contains any of our known keywords
  for (const [key, value] of Object.entries(themeColors)) {
    if (theme.toLowerCase().includes(key)) {
      return value;
    }
  }
  
  // Default colors for unknown themes
  return { bg: "bg-gray-50", text: "text-gray-700" };
}
