import { db } from "./index";
import * as schema from "@shared/schema";
import { format, subDays } from "date-fns";
import * as bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

// Generate random steps between min and max
function getRandomSteps(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate random sleep hours between min and max
function getRandomSleepHours(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(1));
}

// Generate random mood value between min and max
function getRandomMood(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Format date as YYYY-MM-DD
function formatDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

// Generate dates for the last n days
function generateDatesForLastDays(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(today, i);
    dates.push(formatDateString(date));
  }
  
  return dates;
}

async function seed() {
  try {
    console.log("Starting database seed...");
    
    // Create a test user
    const hashedPassword = await bcrypt.hash("password123", 10);
    
    // Check if user already exists
    const existingUsers = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, "testuser"));
    
    let userId: number;
    
    if (existingUsers.length === 0) {
      console.log("Creating test user...");
      const [user] = await db.insert(schema.users).values({
        username: "testuser",
        password: hashedPassword
      }).returning();
      
      userId = user.id;
    } else {
      console.log("Test user already exists, skipping creation.");
      userId = existingUsers[0].id;
    }
    
    // Create user settings if they don't exist
    const existingSettings = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.userId, userId));
    
    if (existingSettings.length === 0) {
      console.log("Creating user settings...");
      await db.insert(schema.settings).values({
        userId,
        name: "John Doe",
        email: "john.doe@example.com",
        weeklyReminders: true,
        journalPrompts: true,
        uploadDay: "sunday",
        sleepGoal: 8,
        stepsGoal: 10000,
        journalFrequency: "weekly"
      });
    } else {
      console.log("User settings already exist, skipping creation.");
    }
    
    // Create sample tips
    console.log("Creating sample wellness tips...");
    
    const tipCategories = ["sleep", "activity", "stress", "mood", "nutrition"];
    const tipTitles = {
      sleep: [
        "Improve Sleep Quality",
        "Establish a Sleep Routine",
        "Optimize Your Sleep Environment",
        "Manage Sleep Disruptions"
      ],
      activity: [
        "Start a Walking Habit",
        "Incorporate More Movement",
        "Exercise for Mental Health",
        "Stay Active Throughout the Day"
      ],
      stress: [
        "Stress Management Techniques",
        "Mindfulness Practice",
        "Breathing Exercises",
        "Reduce Workplace Stress"
      ],
      mood: [
        "Boost Your Mood Naturally",
        "Practice Gratitude",
        "Social Connections",
        "Positive Self-Talk"
      ],
      nutrition: [
        "Hydration and Mood",
        "Foods for Better Sleep",
        "Energy-Boosting Meals",
        "Balanced Diet for Mental Health"
      ]
    };
    
    const existingTips = await db.select().from(schema.tips);
    
    if (existingTips.length === 0) {
      const tipsToInsert = [
        {
          category: "sleep",
          title: "Improve Sleep Quality",
          description: "Your sleep time has decreased by 1.2 hours. Try going to bed 30 minutes earlier.",
          content: "Consistent sleep and wake times help regulate your body's internal clock. Aim to go to bed and wake up at the same time every day, even on weekends."
        },
        {
          category: "activity",
          title: "Activity Progress",
          description: "Great job! You've increased your daily steps by 1,500 this week.",
          content: "Regular physical activity improves sleep quality, reduces anxiety, and boosts your overall mood. Even small increases in daily movement can have significant benefits."
        },
        {
          category: "stress",
          title: "Stress Management",
          description: "Try 5-minute meditation before bed to reduce stress patterns.",
          content: "Brief mindfulness sessions can significantly reduce stress hormones. Even 5 minutes of focused breathing can activate your parasympathetic nervous system, helping you relax."
        },
        {
          category: "sleep",
          title: "Create a Sleep Environment",
          description: "Keep your bedroom cool, dark, and quiet for optimal sleep quality.",
          content: "Your sleep environment plays a crucial role in sleep quality. Aim for a room temperature between 60-67°F (15-19°C), use blackout curtains, and consider a white noise machine if needed."
        },
        {
          category: "activity",
          title: "Walking for Wellbeing",
          description: "A daily 20-minute walk can improve mood and energy levels significantly.",
          content: "Walking is one of the most accessible forms of exercise with numerous benefits for physical and mental health. Even short walks can reduce stress hormones and boost endorphins."
        },
        {
          category: "mood",
          title: "Gratitude Practice",
          description: "Daily gratitude journaling is linked to improved mood and sleep quality.",
          content: "Taking time to write down three things you're grateful for each day can rewire your brain to focus more on positive aspects of life, leading to increased happiness over time."
        },
        {
          category: "nutrition",
          title: "Hydration and Mood",
          description: "Even mild dehydration can negatively impact your mood and energy levels.",
          content: "Studies show that being just 1-2% dehydrated can affect your concentration and mood. Aim to drink water consistently throughout the day rather than large amounts all at once."
        },
        {
          category: "stress",
          title: "Digital Detox",
          description: "Consider a 30-minute screen-free period before bedtime to improve sleep quality.",
          content: "The blue light from screens can interfere with melatonin production, making it harder to fall asleep. Try reading a physical book, gentle stretching, or meditation instead."
        }
      ];
      
      for (const tip of tipsToInsert) {
        await db.insert(schema.tips).values(tip);
      }
      
      console.log(`Created ${tipsToInsert.length} wellness tips.`);
    } else {
      console.log("Tips already exist, skipping creation.");
    }
    
    // Create sample achievements
    console.log("Creating sample achievements...");
    
    const existingAchievements = await db.select().from(schema.achievements);
    
    if (existingAchievements.length === 0) {
      const achievementsToInsert = [
        {
          id: "7-day-streak",
          category: "journal",
          title: "7-Day Streak",
          description: "Completed a week of journaling",
          icon: "medal",
          unlocked: false
        },
        {
          id: "sleep-master",
          category: "sleep",
          title: "Sleep Master",
          description: "5 nights of 7+ hours sleep",
          icon: "moon",
          unlocked: false
        },
        {
          id: "step-champion",
          category: "activity",
          title: "Step Champion",
          description: "Reached 10,000 steps in a day",
          icon: "walking",
          unlocked: false
        },
        {
          id: "mood-improver",
          category: "mood",
          title: "Mood Improver",
          description: "5 days of mood improvement",
          icon: "heart",
          unlocked: false,
          progress: 2,
          goal: 5
        },
        {
          id: "meditation-novice",
          category: "stress",
          title: "Meditation Novice",
          description: "7 days of meditation practice",
          icon: "brain",
          unlocked: false,
          progress: 3,
          goal: 7
        },
        {
          id: "early-riser",
          category: "sleep",
          title: "Early Riser",
          description: "Wake up before 7am for 5 consecutive days",
          icon: "sun",
          unlocked: false,
          progress: 2,
          goal: 5
        },
        {
          id: "journal-master",
          category: "journal",
          title: "Journal Master",
          description: "Complete 30 journal entries",
          icon: "book",
          unlocked: false,
          progress: 12,
          goal: 30
        },
        {
          id: "active-week",
          category: "activity",
          title: "Active Week",
          description: "7,500+ steps every day for a week",
          icon: "fire",
          unlocked: false,
          progress: 4,
          goal: 7
        }
      ];
      
      for (const achievement of achievementsToInsert) {
        await db.insert(schema.achievements).values(achievement);
      }
      
      console.log(`Created ${achievementsToInsert.length} achievements.`);
    } else {
      console.log("Achievements already exist, skipping creation.");
    }
    
    // Generate sample data for the last 30 days
    console.log("Generating sample user data for the last 30 days...");
    
    const dates = generateDatesForLastDays(30);
    
    // Check if we already have data for the user
    const existingMoods = await db
      .select()
      .from(schema.moods)
      .where(eq(schema.moods.userId, userId));
    
    if (existingMoods.length === 0) {
      console.log("Creating sample mood data...");
      
      // Generate mood data with a trend line (gradually improving)
      for (let i = 0; i < dates.length; i++) {
        const baseValue = 50;
        const trendComponent = Math.floor((i / dates.length) * 30); // Trend from 0 to 30
        const randomComponent = Math.floor(Math.random() * 20) - 10; // Random variation -10 to +10
        
        const moodValue = Math.min(100, Math.max(20, baseValue + trendComponent + randomComponent));
        
        await db.insert(schema.moods).values({
          userId,
          date: dates[i],
          value: moodValue
        });
      }
    } else {
      console.log("Mood data already exists, skipping creation.");
    }
    
    // Check if we already have sleep data
    const existingSleep = await db
      .select()
      .from(schema.sleep)
      .where(eq(schema.sleep.userId, userId));
    
    if (existingSleep.length === 0) {
      console.log("Creating sample sleep data...");
      
      // Generate sleep data with a realistic pattern (weekdays less, weekends more)
      for (let i = 0; i < dates.length; i++) {
        const dayOfWeek = new Date(dates[i]).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        const sleepHours = isWeekend
          ? getRandomSleepHours(7, 9)  // More sleep on weekends
          : getRandomSleepHours(5.5, 7.5);  // Less sleep on weekdays
        
        await db.insert(schema.sleep).values({
          userId,
          date: dates[i],
          hours: sleepHours
        });
      }
    } else {
      console.log("Sleep data already exists, skipping creation.");
    }
    
    // Check if we already have activity data
    const existingActivity = await db
      .select()
      .from(schema.activity)
      .where(eq(schema.activity.userId, userId));
    
    if (existingActivity.length === 0) {
      console.log("Creating sample activity data...");
      
      // Generate activity data with a gradual improvement trend
      for (let i = 0; i < dates.length; i++) {
        const baseSteps = 5000;
        const trendComponent = Math.floor((i / dates.length) * 3000); // Trend from 0 to 3000
        const randomComponent = Math.floor(Math.random() * 3000) - 1500; // Random variation -1500 to +1500
        
        const steps = Math.max(2000, baseSteps + trendComponent + randomComponent);
        
        await db.insert(schema.activity).values({
          userId,
          date: dates[i],
          steps
        });
      }
    } else {
      console.log("Activity data already exists, skipping creation.");
    }
    
    // Generate sample journal entries (one per week)
    const existingJournals = await db
      .select()
      .from(schema.journals)
      .where(eq(schema.journals.userId, userId));
    
    if (existingJournals.length === 0) {
      console.log("Creating sample journal entries...");
      
      const journalSamples = [
        {
          content: "Today was a challenging day at work. Had a lot of meetings and felt stressed about deadlines. Tried to take a short walk during lunch which helped a bit. Getting better at managing stress, but still feel overwhelmed sometimes. Sleep hasn't been great this week.",
          date: dates[3]
        },
        {
          content: "Had a really good weekend! Spent time with family and went for a long hike. Noticed my mood improves significantly when I spend time outdoors. Did some reading before bed and slept much better. Want to make outdoor activities a priority going forward.",
          date: dates[10]
        },
        {
          content: "Mixed feelings today. Work was stressful but I managed to fit in a 30-minute yoga session which helped my mental state. Been trying to be more mindful of my eating habits too. Slept about 7 hours last night which is an improvement.",
          date: dates[17]
        },
        {
          content: "Feeling more energetic this week! I've been consistent with daily walks and it's making a difference. Mood has been more stable and I'm sleeping better too. Grateful for the small improvements I'm seeing in my overall wellbeing.",
          date: dates[24]
        }
      ];
      
      for (const journal of journalSamples) {
        await db.insert(schema.journals).values({
          userId,
          date: journal.date,
          content: journal.content
        });
      }
      
      console.log(`Created ${journalSamples.length} journal entries.`);
    } else {
      console.log("Journal entries already exist, skipping creation.");
    }
    
    // Create journal insights if they don't exist
    const existingInsights = await db
      .select()
      .from(schema.journalInsights)
      .where(eq(schema.journalInsights.userId, userId));
    
    if (existingInsights.length === 0) {
      console.log("Creating sample journal insights...");
      
      await db.insert(schema.journalInsights).values({
        userId,
        themes: ["Work stress", "Family time", "Exercise", "Reading", "Anxiety"],
        correlations: [
          "Better mood on days with 30+ min exercise",
          "Lower mood after late night device usage",
          "Improved mood on days with social activities"
        ]
      });
    } else {
      console.log("Journal insights already exist, skipping creation.");
    }
    
    console.log("Database seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seed();
