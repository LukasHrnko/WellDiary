import { useEffect, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Journal } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Styl pro označení dnů s deníkovými záznamy
import 'react-day-picker/dist/style.css';
import './JournalCalendar.css';

interface JournalCalendarProps {
  onSelectDate?: (date: Date) => void;
}

export default function JournalCalendar({ onSelectDate }: JournalCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [, navigate] = useLocation();
  const [entriesByDate, setEntriesByDate] = useState<Record<string, Journal[]>>({});
  
  // Získání deníkových záznamů
  const { data, isLoading } = useQuery<{ entries: Journal[] }>({
    queryKey: ['/api/journal/entries'],
  });
  
  const entries = data?.entries || [];
  
  // Vytvoření seznamu dnů s deníkovými záznamy
  useEffect(() => {
    if (entries.length > 0) {
      const byDate: Record<string, Journal[]> = {};
      
      entries.forEach(entry => {
        const dateStr = entry.date.split('T')[0]; // Získání YYYY-MM-DD formátu
        if (!byDate[dateStr]) {
          byDate[dateStr] = [];
        }
        byDate[dateStr].push(entry);
      });
      
      setEntriesByDate(byDate);
    }
  }, [entries]);
  
  // Vytvoření pole pro označené dny
  const daysWithEntries = Object.keys(entriesByDate).map(dateStr => {
    const entries = entriesByDate[dateStr];
    const moodSum = entries.reduce((sum, entry) => 
      sum + (entry.mood || 0), 0);
    const avgMood = entries.length > 0 ? moodSum / entries.length : 0;
    
    // Určení barvy podle nálady
    let className = 'journal-day';
    if (avgMood >= 80) className += ' high-mood';
    else if (avgMood >= 60) className += ' good-mood';
    else if (avgMood >= 40) className += ' neutral-mood';
    else if (avgMood >= 20) className += ' low-mood';
    else className += ' very-low-mood';
    
    return {
      date: new Date(dateStr),
      className
    };
  });
  
  // Funkce pro zpracování výběru dne
  const handleDayClick = (day: Date | undefined) => {
    if (!day) return;
    
    setSelectedDay(day);
    
    // Navigace na detail záznamu nebo vytvoření nového
    const dateStr = format(day, 'yyyy-MM-dd');
    
    if (onSelectDate) {
      onSelectDate(day);
    } else {
      // Pokud existuje záznam pro daný den, zobrazit detail
      if (entriesByDate[dateStr] && entriesByDate[dateStr].length > 0) {
        navigate(`/journal?date=${dateStr}`);
      } else {
        // Jinak přejít na formulář pro vytvoření nového záznamu
        navigate(`/journal/new?date=${dateStr}`);
      }
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Kalendář deníkových záznamů</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <DayPicker
            mode="single"
            selected={selectedDay}
            onSelect={handleDayClick}
            modifiers={{ hasEntry: daysWithEntries.map(d => d.date) }}
            modifiersClassNames={{
              ...daysWithEntries.reduce((acc, day) => ({
                ...acc,
                [format(day.date, 'yyyy-MM-dd')]: day.className
              }), {})
            }}
            locale={cs}
            showOutsideDays
            className="journal-calendar"
          />
        </div>
      </CardContent>
    </Card>
  );
}