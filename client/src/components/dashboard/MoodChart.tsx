import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart } from "@/components/ui/chart";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import { formatShortWeekday } from "@/lib/dates";

interface MoodChartProps {
  startDate: string;
  endDate: string;
}

const MoodChart: React.FC<MoodChartProps> = ({ startDate, endDate }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/mood', startDate, endDate],
  });

  const moodData = data?.moods || [];
  
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">Weekly Mood</h2>
          <button className="text-gray-400 hover:text-gray-600">
            <FontAwesomeIcon icon="ellipsis-h" />
          </button>
        </div>
        
        {isLoading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            <BarChart 
              data={moodData} 
              barKey="value" 
              height={192}
              xAxisFormatter={formatShortWeekday}
              tooltipFormatter={(value) => `Mood: ${value}/100`}
            />
            
            <div className="flex justify-between text-xs text-gray-500 mt-4">
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full mood-high mr-1"></span>
                <span>Good</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full mood-medium mr-1"></span>
                <span>Neutral</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full mood-low mr-1"></span>
                <span>Bad</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MoodChart;
