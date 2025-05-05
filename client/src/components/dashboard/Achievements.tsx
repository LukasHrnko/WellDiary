import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { IconProp } from "@fortawesome/fontawesome-svg-core";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: IconProp;
  bgColor: string;
  iconBgColor: string;
  iconColor: string;
  unlocked: boolean;
  progress?: number;
  goal?: number;
}

const Achievements: React.FC = () => {
  const { data, isLoading } = useQuery<{ achievements: Achievement[] }>({
    queryKey: ['/api/achievements'],
  });
  
  const achievements = data?.achievements || [];
  
  // Category styling map
  const categoryStyles: Record<string, { 
    bgColor: string, 
    iconBgColor: string, 
    iconColor: string 
  }> = {
    journal: {
      bgColor: "bg-purple-50",
      iconBgColor: "bg-purple-100",
      iconColor: "text-purple-500"
    },
    sleep: {
      bgColor: "bg-blue-50",
      iconBgColor: "bg-blue-100",
      iconColor: "text-blue-500"
    },
    activity: {
      bgColor: "bg-green-50",
      iconBgColor: "bg-green-100",
      iconColor: "text-green-500"
    },
    mood: {
      bgColor: "bg-yellow-50",
      iconBgColor: "bg-yellow-100",
      iconColor: "text-yellow-500"
    }
  };
  
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">Achievements</h2>
          <Link href="/achievements" className="text-sm text-primary">
            View All
          </Link>
        </div>
        
        {isLoading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {achievements.slice(0, 3).map((achievement: Achievement) => (
              <div key={achievement.id} className={`${achievement.bgColor} rounded-lg p-4 text-center`}>
                <div className={`w-12 h-12 ${achievement.iconBgColor} rounded-full flex items-center justify-center mx-auto mb-2`}>
                  <FontAwesomeIcon icon={achievement.icon} className={`${achievement.iconColor} text-xl`} />
                </div>
                <h3 className="text-sm font-medium">{achievement.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{achievement.description}</p>
              </div>
            ))}
            
            {/* Locked achievement placeholder */}
            <div className="bg-gray-50 rounded-lg p-4 text-center border-2 border-dashed border-gray-200">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <FontAwesomeIcon icon="lock" className="text-gray-400 text-xl" />
              </div>
              <h3 className="text-sm font-medium text-gray-500">Locked</h3>
              <p className="text-xs text-gray-400 mt-1">Complete 3 more entries</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Achievements;
