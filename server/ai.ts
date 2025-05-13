import { Mood, Sleep, Activity, Journal } from "@shared/schema";
import { format, subDays } from "date-fns";

interface AITip {
  id: string;
  category: string;
  title: string;
  description: string;
}

interface TrendAnalysis {
  moodTrend: "improving" | "declining" | "stable";
  sleepTrend: "improving" | "declining" | "stable";
  activityTrend: "improving" | "declining" | "stable";
  correlations: string[];
}

/**
 * Generate personalized tips based on user data
 * 
 * @param userId User ID
 * @param moods Recent mood data
 * @param sleep Recent sleep data
 * @param activity Recent activity data
 * @param journals Recent journal entries
 * @returns Array of personalized tips
 */
export function generatePersonalizedTips(
  userId: number,
  moods: Mood[],
  sleep: Sleep[],
  activity: Activity[],
  journals?: Journal[]
): AITip[] {
  const tips: AITip[] = [];
  const trends = analyzeTrends(moods, sleep, activity);
  
  // Generate unique IDs
  const generateId = () => `tip-${userId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  // Add sleep-related tip if necessary
  if (trends.sleepTrend === "declining") {
    const avgSleepHours = sleep.reduce((sum, entry) => sum + entry.hours, 0) / Math.max(1, sleep.length);
    
    if (avgSleepHours < 6) {
      tips.push({
        id: generateId(),
        category: "sleep",
        title: "Improve Sleep",
        description: `Your sleep time has decreased to ${avgSleepHours.toFixed(1)} hours. Try going to bed 30 minutes earlier.`
      });
    } else {
      tips.push({
        id: generateId(),
        category: "sleep",
        title: "Sleep Consistency",
        description: "Your sleep schedule has become less consistent. Try to maintain regular sleep and wake times."
      });
    }
  }
  
  // Add activity-related tip if necessary
  if (trends.activityTrend === "improving") {
    const avgSteps = activity.reduce((sum, entry) => sum + entry.steps, 0) / Math.max(1, activity.length);
    
    tips.push({
      id: generateId(),
      category: "activity",
      title: "Activity Progress",
      description: `Great job! You've increased your daily steps to an average of ${Math.round(avgSteps)} this week.`
    });
  } else if (trends.activityTrend === "declining") {
    tips.push({
      id: generateId(),
      category: "activity",
      title: "Boost Your Activity",
      description: "Your activity level has decreased. Try adding a short 10-minute walk to your daily routine."
    });
  }
  
  // Add mood-related tip if necessary
  if (trends.moodTrend === "declining") {
    tips.push({
      id: generateId(),
      category: "stress",
      title: "Stress Management",
      description: "Try 5-minute meditation before bed to help improve your mood and reduce stress patterns."
    });
  }
  
  // Add correlation-based tip if available
  if (trends.correlations.length > 0) {
    // Pick a random correlation to base a tip on
    const randomCorrelation = trends.correlations[Math.floor(Math.random() * trends.correlations.length)];
    
    if (randomCorrelation.includes("sleep") && randomCorrelation.includes("mood")) {
      tips.push({
        id: generateId(),
        category: "sleep",
        title: "Sleep-Mood Connection",
        description: "We've noticed your mood improves with better sleep. Focus on sleep quality for better well-being."
      });
    } else if (randomCorrelation.includes("steps") || randomCorrelation.includes("activity")) {
      tips.push({
        id: generateId(),
        category: "activity",
        title: "Movement Matters",
        description: "Physical activity appears to positively affect your mood. Try to stay consistent with daily movement."
      });
    }
  }
  
  // If we have journal entries, add relevant tips
  if (journals && journals.length > 0) {
    // Check for common themes in journal entries
    const journalText = journals.map(j => j.content).join(" ").toLowerCase();
    
    if (journalText.includes("stress") || journalText.includes("anxious") || journalText.includes("overwhelm")) {
      tips.push({
        id: generateId(),
        category: "stress",
        title: "Manage Stress",
        description: "Your journal mentions stress frequently. Try deep breathing exercises or short breaks throughout the day."
      });
    }
    
    if (journalText.includes("grateful") || journalText.includes("thankful") || journalText.includes("appreciate")) {
      tips.push({
        id: generateId(),
        category: "mood",
        title: "Gratitude Practice",
        description: "You mention gratitude in your journal. Continue this practice - it's proven to boost overall well-being."
      });
    }
  }
  
  // Ensure we have at least one tip
  if (tips.length === 0) {
    tips.push({
      id: generateId(),
      category: "mood",
      title: "Wellness Check-In",
      description: "Take a moment today to reflect on what makes you feel good and try to incorporate more of that into your routine."
    });
  }
  
  // Limit to 3 tips maximum
  return tips.slice(0, 3);
}

/**
 * Analyze trends in user data
 * 
 * @param moods Recent mood data
 * @param sleep Recent sleep data
 * @param activity Recent activity data
 * @returns Trend analysis results
 */
function analyzeTrends(moods: Mood[], sleep: Sleep[], activity: Activity[]): TrendAnalysis {
  // Initialize result
  const result: TrendAnalysis = {
    moodTrend: "stable",
    sleepTrend: "stable",
    activityTrend: "stable",
    correlations: []
  };
  
  // Ensure inputs are arrays
  if (!Array.isArray(moods) || !Array.isArray(sleep) || !Array.isArray(activity)) {
    console.error("Invalid input to analyzeTrends:", { 
      moodsIsArray: Array.isArray(moods), 
      sleepIsArray: Array.isArray(sleep), 
      activityIsArray: Array.isArray(activity) 
    });
    return result;
  }
  
  // Need at least a few data points for meaningful analysis
  if (moods.length < 3 || sleep.length < 3 || activity.length < 3) {
    return result;
  }
  
  // Split data into recent vs older to determine trends
  const moodHalfIndex = Math.floor(moods.length / 2) || 1; // Ensure at least 1
  const sleepHalfIndex = Math.floor(sleep.length / 2) || 1;
  const activityHalfIndex = Math.floor(activity.length / 2) || 1;
  
  // Analyze mood trend
  const recentMoods = moods.slice(-moodHalfIndex);
  const olderMoods = moods.slice(0, moodHalfIndex);
  
  if (recentMoods.length > 0 && olderMoods.length > 0) {
    const recentMoodAvg = recentMoods.reduce((sum, m) => sum + m.value, 0) / recentMoods.length;
    const olderMoodAvg = olderMoods.reduce((sum, m) => sum + m.value, 0) / olderMoods.length;
    
    if (recentMoodAvg - olderMoodAvg > 5) {
      result.moodTrend = "improving";
    } else if (olderMoodAvg - recentMoodAvg > 5) {
      result.moodTrend = "declining";
    }
  }
  
  // Analyze sleep trend
  const recentSleep = sleep.slice(-sleepHalfIndex);
  const olderSleep = sleep.slice(0, sleepHalfIndex);
  
  if (recentSleep.length > 0 && olderSleep.length > 0) {
    const recentSleepAvg = recentSleep.reduce((sum, s) => sum + s.hours, 0) / recentSleep.length;
    const olderSleepAvg = olderSleep.reduce((sum, s) => sum + s.hours, 0) / olderSleep.length;
    
    if (recentSleepAvg - olderSleepAvg > 0.5) {
      result.sleepTrend = "improving";
    } else if (olderSleepAvg - recentSleepAvg > 0.5) {
      result.sleepTrend = "declining";
    }
  }
  
  // Analyze activity trend
  const recentActivity = activity.slice(-activityHalfIndex);
  const olderActivity = activity.slice(0, activityHalfIndex);
  
  if (recentActivity.length > 0 && olderActivity.length > 0) {
    const recentActivityAvg = recentActivity.reduce((sum, a) => sum + a.steps, 0) / recentActivity.length;
    const olderActivityAvg = olderActivity.reduce((sum, a) => sum + a.steps, 0) / olderActivity.length;
    
    if (recentActivityAvg - olderActivityAvg > 1000) {
      result.activityTrend = "improving";
    } else if (olderActivityAvg - recentActivityAvg > 1000) {
      result.activityTrend = "declining";
    }
  }
  
  // Analyze potential correlations
  // Create matching arrays of data by date for correlation analysis
  const dateMap = new Map<string, { mood?: number; sleep?: number; activity?: number }>();
  
  // Add mood data to map
  moods.forEach(m => {
    const date = m.date;
    if (!dateMap.has(date)) {
      dateMap.set(date, {});
    }
    dateMap.get(date)!.mood = m.value;
  });
  
  // Add sleep data to map
  sleep.forEach(s => {
    const date = s.date;
    if (!dateMap.has(date)) {
      dateMap.set(date, {});
    }
    dateMap.get(date)!.sleep = s.hours;
  });
  
  // Add activity data to map
  activity.forEach(a => {
    const date = a.date;
    if (!dateMap.has(date)) {
      dateMap.set(date, {});
    }
    dateMap.get(date)!.activity = a.steps;
  });
  
  // Convert map to array of entries with all three data points
  const completeEntries = Array.from(dateMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .filter(entry => entry.mood !== undefined && entry.sleep !== undefined && entry.activity !== undefined);
  
  // Check for sleep-mood correlation
  if (completeEntries.length >= 5) {
    const goodSleepEntries = completeEntries.filter(entry => (entry.sleep as number) >= 7);
    const badSleepEntries = completeEntries.filter(entry => (entry.sleep as number) < 6);
    
    if (goodSleepEntries.length >= 3 && badSleepEntries.length >= 3) {
      const goodSleepMoodAvg = goodSleepEntries.reduce((sum, e) => sum + (e.mood as number), 0) / goodSleepEntries.length;
      const badSleepMoodAvg = badSleepEntries.reduce((sum, e) => sum + (e.mood as number), 0) / badSleepEntries.length;
      
      if (goodSleepMoodAvg - badSleepMoodAvg > 10) {
        result.correlations.push("Better mood on days with 7+ hours of sleep");
      }
    }
    
    // Check for activity-mood correlation
    const activeEntries = completeEntries.filter(entry => (entry.activity as number) >= 8000);
    const inactiveEntries = completeEntries.filter(entry => (entry.activity as number) < 4000);
    
    if (activeEntries.length >= 3 && inactiveEntries.length >= 3) {
      const activeMoodAvg = activeEntries.reduce((sum, e) => sum + (e.mood as number), 0) / activeEntries.length;
      const inactiveMoodAvg = inactiveEntries.reduce((sum, e) => sum + (e.mood as number), 0) / inactiveEntries.length;
      
      if (activeMoodAvg - inactiveMoodAvg > 10) {
        result.correlations.push("Better mood on days with 8,000+ steps");
      }
    }
  }
  
  return result;
}

/**
 * Extract themes from journal entries
 * 
 * @param journals Journal entries
 * @returns Array of identified themes
 */
export function extractJournalThemes(journals: Journal[]): string[] {
  if (!journals || journals.length === 0) {
    return [];
  }
  
  // Common themes to look for in journal entries
  const themeKeywords = {
    "Work stress": ["work", "job", "stress", "deadline", "meeting", "boss", "colleague"],
    "Family time": ["family", "kids", "children", "parents", "mom", "dad", "husband", "wife", "partner"],
    "Exercise": ["exercise", "workout", "run", "running", "gym", "walk", "walking", "yoga", "fitness"],
    "Reading": ["read", "book", "novel", "reading"],
    "Anxiety": ["anxious", "anxiety", "worry", "worried", "fear", "nervous"],
    "Gratitude": ["grateful", "thankful", "appreciate", "blessed", "gratitude"],
    "Meditation": ["meditate", "meditation", "mindful", "mindfulness", "breathe"],
    "Sleep issues": ["tired", "exhausted", "insomnia", "couldn't sleep", "bad sleep", "restless"],
    "Social activities": ["friend", "dinner", "party", "social", "hangout", "meet up", "coffee"],
    "Nature": ["nature", "outside", "outdoors", "hike", "hiking", "garden", "gardening", "park"]
  };
  
  // Combine all journal content
  const allContent = journals.map(j => j.content.toLowerCase()).join(" ");
  
  // Find matching themes
  const matchedThemes: string[] = [];
  
  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    // Check if any keyword from this theme appears in the content
    const hasTheme = keywords.some(keyword => allContent.includes(keyword));
    
    if (hasTheme) {
      matchedThemes.push(theme);
    }
  }
  
  return matchedThemes;
}

/**
 * Find correlations between mood, sleep, activity, and journal content
 * 
 * @param moods Mood data
 * @param sleep Sleep data
 * @param activity Activity data
 * @param journals Journal entries
 * @returns Array of correlation statements
 */
export function findJournalCorrelations(
  moods: Mood[],
  sleep: Sleep[],
  activity: Activity[],
  journals: Journal[]
): string[] {
  const correlations: string[] = [];
  
  // Need sufficient data for meaningful correlations
  if (moods.length < 5 || sleep.length < 5 || activity.length < 5 || journals.length < 5) {
    return correlations;
  }
  
  // Create a map of journal content by date
  const journalByDate = new Map<string, string>();
  journals.forEach(journal => {
    journalByDate.set(journal.date, journal.content.toLowerCase());
  });
  
  // Check for exercise correlation with mood
  const exerciseKeywords = ["exercise", "workout", "run", "running", "gym", "walk", "walking", "yoga"];
  const daysWithExercise: string[] = [];
  
  journalByDate.forEach((content, date) => {
    if (exerciseKeywords.some(keyword => content.includes(keyword))) {
      daysWithExercise.push(date);
    }
  });
  
  if (daysWithExercise.length >= 3) {
    // Find mood on exercise days vs non-exercise days
    const exerciseDayMoods = moods.filter(mood => daysWithExercise.includes(mood.date));
    const nonExerciseDayMoods = moods.filter(mood => !daysWithExercise.includes(mood.date));
    
    if (exerciseDayMoods.length >= 3 && nonExerciseDayMoods.length >= 3) {
      const exerciseMoodAvg = exerciseDayMoods.reduce((sum, m) => sum + m.value, 0) / exerciseDayMoods.length;
      const nonExerciseMoodAvg = nonExerciseDayMoods.reduce((sum, m) => sum + m.value, 0) / nonExerciseDayMoods.length;
      
      if (exerciseMoodAvg > nonExerciseMoodAvg + 10) {
        correlations.push("Better mood on days with 30+ min exercise");
      }
    }
  }
  
  // Check for social activity correlation with mood
  const socialKeywords = ["friend", "dinner", "party", "social", "hangout", "meet", "coffee", "people"];
  const daysWithSocial: string[] = [];
  
  journalByDate.forEach((content, date) => {
    if (socialKeywords.some(keyword => content.includes(keyword))) {
      daysWithSocial.push(date);
    }
  });
  
  if (daysWithSocial.length >= 3) {
    // Find mood on social days vs non-social days
    const socialDayMoods = moods.filter(mood => daysWithSocial.includes(mood.date));
    const nonSocialDayMoods = moods.filter(mood => !daysWithSocial.includes(mood.date));
    
    if (socialDayMoods.length >= 3 && nonSocialDayMoods.length >= 3) {
      const socialMoodAvg = socialDayMoods.reduce((sum, m) => sum + m.value, 0) / socialDayMoods.length;
      const nonSocialMoodAvg = nonSocialDayMoods.reduce((sum, m) => sum + m.value, 0) / nonSocialDayMoods.length;
      
      if (socialMoodAvg > nonSocialMoodAvg + 5) {
        correlations.push("Improved mood on days with social activities");
      }
    }
  }
  
  // Check for screen time correlation with sleep
  const screenTimeKeywords = ["screen", "phone", "tv", "television", "netflix", "movie", "social media", "youtube"];
  const daysWithLateScreens: string[] = [];
  
  journalByDate.forEach((content, date) => {
    if (screenTimeKeywords.some(keyword => content.includes(keyword)) && 
        (content.includes("night") || content.includes("late") || content.includes("before bed"))) {
      daysWithLateScreens.push(date);
    }
  });
  
  if (daysWithLateScreens.length >= 3) {
    // Find sleep quality on late screen days vs other days
    const nextDaySleep = sleep.filter(s => {
      const prevDate = format(subDays(new Date(s.date), 1), 'yyyy-MM-dd');
      return daysWithLateScreens.includes(prevDate);
    });
    
    const otherDaySleep = sleep.filter(s => {
      const prevDate = format(subDays(new Date(s.date), 1), 'yyyy-MM-dd');
      return !daysWithLateScreens.includes(prevDate);
    });
    
    if (nextDaySleep.length >= 3 && otherDaySleep.length >= 3) {
      const screenSleepAvg = nextDaySleep.reduce((sum, s) => sum + s.hours, 0) / nextDaySleep.length;
      const otherSleepAvg = otherDaySleep.reduce((sum, s) => sum + s.hours, 0) / otherDaySleep.length;
      
      if (otherSleepAvg > screenSleepAvg + 0.5) {
        correlations.push("Lower mood after late night device usage");
      }
    }
  }
  
  return correlations;
}

/**
 * Check if user has achieved any new achievements
 * 
 * @param moods Mood data
 * @param sleep Sleep data
 * @param activity Activity data
 * @param journals Journal entries
 * @returns Array of achieved achievement IDs
 */
export function checkAchievements(
  moods: Mood[],
  sleep: Sleep[],
  activity: Activity[],
  journals: Journal[]
): string[] {
  const achievements: string[] = [];
  
  // Check for 7-day streak of journal entries
  if (journals.length >= 7) {
    // Sort journals by date
    const sortedJournals = [...journals].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Check if the last 7 entries are on consecutive days
    let hasJournalStreak = true;
    for (let i = sortedJournals.length - 7; i < sortedJournals.length - 1; i++) {
      const currentDate = new Date(sortedJournals[i].date);
      const nextDate = new Date(sortedJournals[i + 1].date);
      
      // Check if the next date is exactly one day after the current date
      const diffTime = nextDate.getTime() - currentDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      
      if (Math.abs(diffDays - 1) > 0.1) { // Allow small time differences
        hasJournalStreak = false;
        break;
      }
    }
    
    if (hasJournalStreak) {
      achievements.push("7-day-streak");
    }
  }
  
  // Check for sleep master (5 nights of 7+ hours sleep)
  if (sleep.length >= 5) {
    const goodSleepNights = sleep.filter(s => s.hours >= 7).length;
    
    if (goodSleepNights >= 5) {
      achievements.push("sleep-master");
    }
  }
  
  // Check for step champion (reached 10,000 steps in a day)
  if (activity.some(a => a.steps >= 10000)) {
    achievements.push("step-champion");
  }
  
  // Check for mood improver (consistent mood improvement for 5 days)
  if (moods.length >= 5) {
    // Sort moods by date
    const sortedMoods = [...moods].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Check the last 5 entries for improvement
    let hasImprovement = true;
    for (let i = sortedMoods.length - 5; i < sortedMoods.length - 1; i++) {
      if (sortedMoods[i].value >= sortedMoods[i + 1].value) {
        hasImprovement = false;
        break;
      }
    }
    
    if (hasImprovement) {
      achievements.push("mood-improver");
    }
  }
  
  return achievements;
}
