import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart } from "@/components/ui/chart";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import { formatShortWeekday } from "@/lib/dates";

interface SleepChartProps {
  startDate: string;
  endDate: string;
}

const SleepChart: React.FC<SleepChartProps> = ({ startDate, endDate }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/sleep', startDate, endDate],
  });

  const sleepData = data?.sleep || [];
  const averageSleep = data?.average || 0;
  const weeklyChange = data?.weeklyChange || 0;
  const goal = data?.goal || 8;
  const goalPercentage = Math.min(100, (averageSleep / goal) * 100);
  
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">Sleep Quality</h2>
          <div className="text-xs bg-secondary bg-opacity-10 text-secondary py-1 px-2 rounded-full">
            <span className="font-medium">{averageSleep.toFixed(1)}h</span> avg
          </div>
        </div>
        
        {isLoading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-secondary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            <BarChart 
              data={sleepData} 
              barKey="hours" 
              height={160}
              color="#4AAED9"
              xAxisFormatter={formatShortWeekday}
              tooltipFormatter={(value) => `${value} hours`}
            />
            
            <div className="flex mt-4 text-xs text-gray-500">
              <div className="w-1/2">
                <p className="font-medium text-gray-700">Weekly Change</p>
                <p className="flex items-center mt-1">
                  {weeklyChange >= 0 ? (
                    <>
                      <FontAwesomeIcon icon="arrow-up" className="text-green-500 mr-1" />
                      <span>+{weeklyChange.toFixed(1)} hours from last week</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon="arrow-down" className="text-red-500 mr-1" />
                      <span>{weeklyChange.toFixed(1)} hours from last week</span>
                    </>
                  )}
                </p>
              </div>
              <div className="w-1/2">
                <p className="font-medium text-gray-700">Sleep Goal</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-secondary rounded-full h-2" 
                    style={{ width: `${goalPercentage}%` }}
                  ></div>
                </div>
                <p className="flex justify-between mt-1">
                  <span>Current: {averageSleep.toFixed(1)}h</span>
                  <span>Goal: {goal}h</span>
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SleepChart;
