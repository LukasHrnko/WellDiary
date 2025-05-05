import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getCurrentWeek, getPreviousWeek, getDaysLeftInWeek } from "@/lib/dates";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Components
import JournalUpload from "@/components/dashboard/JournalUpload";
import MoodCheck from "@/components/dashboard/MoodCheck";
import MoodChart from "@/components/dashboard/MoodChart";
import AITips from "@/components/dashboard/AITips";
import SleepChart from "@/components/dashboard/SleepChart";
import ActivityChart from "@/components/dashboard/ActivityChart";
import Achievements from "@/components/dashboard/Achievements";
import JournalInsights from "@/components/dashboard/JournalInsights";

const Dashboard: React.FC = () => {
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeek());
  
  // Fetch the last journal upload date
  const { data: journalData } = useQuery({
    queryKey: ['/api/journal/last-upload'],
  });
  
  const lastUploadDate = journalData?.lastUploadDate || null;
  const daysLeftInWeek = getDaysLeftInWeek();
  
  const handlePreviousWeek = () => {
    setCurrentWeek(getPreviousWeek());
  };
  
  const handleNextWeek = () => {
    setCurrentWeek(getCurrentWeek());
  };
  
  return (
    <div className="p-4 md:p-6">
      {/* Date Range */}
      <div className="flex items-center mb-6">
        <button 
          className="p-2 rounded hover:bg-gray-100 mr-2"
          onClick={handlePreviousWeek}
        >
          <FontAwesomeIcon icon="chevron-left" className="text-gray-500" />
        </button>
        <h2 className="text-sm">{currentWeek.formattedRange}</h2>
        <button 
          className="p-2 rounded hover:bg-gray-100 ml-2"
          onClick={handleNextWeek}
          disabled={currentWeek.formattedRange === getCurrentWeek().formattedRange}
        >
          <FontAwesomeIcon icon="chevron-right" className="text-gray-500" />
        </button>
      </div>

      {/* Upload Journal Section */}
      <div className="mb-6">
        <JournalUpload 
          lastUploadDate={lastUploadDate} 
          daysLeft={daysLeftInWeek} 
        />
      </div>

      {/* Quick Mood Check */}
      <div className="mb-6">
        <MoodCheck />
      </div>

      {/* Weekly Summary & AI Tips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Mood Chart */}
        <div className="md:col-span-2">
          <MoodChart 
            startDate={currentWeek.startDate.toISOString()} 
            endDate={currentWeek.endDate.toISOString()} 
          />
        </div>
        
        {/* AI Tips */}
        <div>
          <AITips />
        </div>
      </div>

      {/* Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Sleep Chart */}
        <SleepChart 
          startDate={currentWeek.startDate.toISOString()} 
          endDate={currentWeek.endDate.toISOString()} 
        />
        
        {/* Activity Chart */}
        <ActivityChart 
          startDate={currentWeek.startDate.toISOString()} 
          endDate={currentWeek.endDate.toISOString()} 
        />
      </div>

      {/* Achievements Section */}
      <div className="mb-6">
        <Achievements />
      </div>

      {/* Journal Insights */}
      <div className="mb-6">
        <JournalInsights />
      </div>
    </div>
  );
};

export default Dashboard;
