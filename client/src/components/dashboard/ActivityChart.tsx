import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AreaChart } from "@/components/ui/chart";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import { formatShortWeekday } from "@/lib/dates";

interface ActivityChartProps {
  startDate: string;
  endDate: string;
}

const ActivityChart: React.FC<ActivityChartProps> = ({ startDate, endDate }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/activity', startDate, endDate],
  });

  const activityData = data?.activity || [];
  const averageSteps = data?.average || 0;
  const weeklyChange = data?.weeklyChange || 0;
  const goal = data?.goal || 10000;
  const goalPercentage = Math.min(100, (averageSteps / goal) * 100);
  
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">Physical Activity</h2>
          <div className="text-xs bg-accent bg-opacity-10 text-accent py-1 px-2 rounded-full">
            <span className="font-medium">{averageSteps.toLocaleString()}</span> avg steps
          </div>
        </div>
        
        {isLoading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            <AreaChart 
              data={activityData} 
              areaKey="steps" 
              height={160}
              color="#4ADE80"
              tooltipFormatter={(value) => `${value.toLocaleString()} steps`}
            />
            
            <div className="flex mt-4 text-xs text-gray-500">
              <div className="w-1/2">
                <p className="font-medium text-gray-700">Weekly Change</p>
                <p className="flex items-center mt-1">
                  {weeklyChange >= 0 ? (
                    <>
                      <FontAwesomeIcon icon="arrow-up" className="text-green-500 mr-1" />
                      <span>+{weeklyChange.toLocaleString()} steps from last week</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon="arrow-down" className="text-red-500 mr-1" />
                      <span>{weeklyChange.toLocaleString()} steps from last week</span>
                    </>
                  )}
                </p>
              </div>
              <div className="w-1/2">
                <p className="font-medium text-gray-700">Activity Goal</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-accent rounded-full h-2" 
                    style={{ width: `${goalPercentage}%` }}
                  ></div>
                </div>
                <p className="flex justify-between mt-1">
                  <span>Current: {averageSteps.toLocaleString()}</span>
                  <span>Goal: {goal.toLocaleString()}</span>
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityChart;
