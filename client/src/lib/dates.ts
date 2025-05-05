import { format, startOfWeek, endOfWeek, eachDayOfInterval, subDays } from "date-fns";

// Format a date as a short weekday (Mon, Tue, etc.)
export function formatShortWeekday(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, "EEE");
  } catch (error) {
    return dateString;
  }
}

// Format a date range for display (Mon, Oct 2, 2023 — Sun, Oct 8, 2023)
export function formatDateRange(startDate: Date, endDate: Date): string {
  return `${format(startDate, "EEE, MMM d, yyyy")} — ${format(endDate, "EEE, MMM d, yyyy")}`;
}

// Get the current week's start and end dates
export function getCurrentWeek(): {
  startDate: Date;
  endDate: Date;
  formattedRange: string;
  daysOfWeek: Date[];
} {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 }); // Start on Monday
  const end = endOfWeek(now, { weekStartsOn: 1 }); // End on Sunday
  const days = eachDayOfInterval({ start, end });
  
  return {
    startDate: start,
    endDate: end,
    formattedRange: formatDateRange(start, end),
    daysOfWeek: days,
  };
}

// Get the previous week's start and end dates
export function getPreviousWeek(): {
  startDate: Date;
  endDate: Date;
  formattedRange: string;
  daysOfWeek: Date[];
} {
  const now = new Date();
  const previousWeekStart = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7);
  const previousWeekEnd = subDays(endOfWeek(now, { weekStartsOn: 1 }), 7);
  const days = eachDayOfInterval({
    start: previousWeekStart,
    end: previousWeekEnd,
  });
  
  return {
    startDate: previousWeekStart,
    endDate: previousWeekEnd,
    formattedRange: formatDateRange(previousWeekStart, previousWeekEnd),
    daysOfWeek: days,
  };
}

// Get days left until the end of the week
export function getDaysLeftInWeek(): number {
  const now = new Date();
  const end = endOfWeek(now, { weekStartsOn: 1 });
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
