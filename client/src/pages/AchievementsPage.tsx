import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Achievement {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: IconProp;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  goal?: number;
}

const AchievementsPage: React.FC = () => {
  const { data, isLoading } = useQuery<{ achievements: Achievement[], categories: string[] }>({
    queryKey: ['/api/achievements/all'],
  });
  
  const achievements = data?.achievements || [];
  const categories = data?.categories || [];
  
  // Calculate progress stats
  const totalAchievements = achievements.length;
  const unlockedAchievements = achievements.filter((a: Achievement) => a.unlocked).length;
  const progressPercentage = Math.round((unlockedAchievements / totalAchievements) * 100) || 0;
  
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-4">Achievements</h1>
      
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Your Progress</h2>
              <p className="text-gray-500 text-sm mt-1">
                You've unlocked {unlockedAchievements} of {totalAchievements} achievements
              </p>
            </div>
            
            <div className="md:w-1/2 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{progressPercentage}% complete</span>
                <span>{unlockedAchievements}/{totalAchievements}</span>
              </div>
              <Progress value={progressPercentage} />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="all">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Achievements</TabsTrigger>
          <TabsTrigger value="unlocked">Unlocked</TabsTrigger>
          <TabsTrigger value="locked">Locked</TabsTrigger>
          {categories.map((category: string) => (
            <TabsTrigger key={category} value={category}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value="all">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {achievements.map((achievement: Achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="unlocked">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {achievements
              .filter((achievement: Achievement) => achievement.unlocked)
              .map((achievement: Achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
          </div>
        </TabsContent>
        
        <TabsContent value="locked">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {achievements
              .filter((achievement: Achievement) => !achievement.unlocked)
              .map((achievement: Achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
          </div>
        </TabsContent>
        
        {categories.map((category: string) => (
          <TabsContent key={category} value={category}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {achievements
                .filter((achievement: Achievement) => achievement.category === category)
                .map((achievement: Achievement) => (
                  <AchievementCard key={achievement.id} achievement={achievement} />
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

const AchievementCard: React.FC<{ achievement: Achievement }> = ({ achievement }) => {
  // Get background and icon colors based on category
  const getCategoryColors = (category: string) => {
    switch (category) {
      case 'journal':
        return { bg: 'bg-purple-50', iconBg: 'bg-purple-100', iconColor: 'text-purple-500' };
      case 'sleep':
        return { bg: 'bg-blue-50', iconBg: 'bg-blue-100', iconColor: 'text-blue-500' };
      case 'activity':
        return { bg: 'bg-green-50', iconBg: 'bg-green-100', iconColor: 'text-green-500' };
      case 'mood':
        return { bg: 'bg-yellow-50', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-500' };
      default:
        return { bg: 'bg-gray-50', iconBg: 'bg-gray-100', iconColor: 'text-gray-500' };
    }
  };
  
  const { bg, iconBg, iconColor } = getCategoryColors(achievement.category);
  
  return (
    <Card className={`shadow-sm ${achievement.unlocked ? bg : 'bg-gray-50'}`}>
      <CardContent className="p-6">
        <div className="flex items-center mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${achievement.unlocked ? iconBg : 'bg-gray-100'}`}>
            <FontAwesomeIcon 
              icon={achievement.unlocked ? achievement.icon : 'lock'} 
              className={achievement.unlocked ? iconColor : 'text-gray-400'} 
              size="lg" 
            />
          </div>
          <div>
            <h3 className="font-semibold">{achievement.title}</h3>
            <div className="flex items-center text-sm text-gray-500 mt-1">
              <span className="capitalize">{achievement.category}</span>
              {achievement.unlocked && (
                <Badge variant="outline" className="ml-2 text-xs">Unlocked</Badge>
              )}
            </div>
          </div>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">{achievement.description}</p>
        
        {achievement.progress !== undefined && achievement.goal !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span>{achievement.progress}/{achievement.goal}</span>
            </div>
            <Progress value={(achievement.progress / achievement.goal) * 100} />
          </div>
        )}
        
        {achievement.unlocked && achievement.unlockedAt && (
          <div className="text-xs text-gray-500 mt-4">
            Unlocked on {new Date(achievement.unlockedAt).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AchievementsPage;
