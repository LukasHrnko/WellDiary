import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import { IconProp } from "@fortawesome/fontawesome-svg-core";

interface Tip {
  id: string;
  category: string;
  title: string;
  description: string;
  icon: IconProp;
  bgColor: string;
  textColor: string;
  iconBgColor: string;
  iconColor: string;
}

const AITips: React.FC = () => {
  const { data, isLoading } = useQuery<{ tips: any[] }>({
    queryKey: ['/api/tips'],
  });
  
  const tips = data?.tips || [];
  
  // Category styling map
  const categoryStyles: Record<string, { 
    bgColor: string, 
    textColor: string, 
    iconBgColor: string, 
    iconColor: string 
  }> = {
    sleep: {
      bgColor: "bg-blue-50",
      textColor: "text-blue-800",
      iconBgColor: "bg-blue-100",
      iconColor: "text-blue-600"
    },
    activity: {
      bgColor: "bg-green-50",
      textColor: "text-green-800",
      iconBgColor: "bg-green-100",
      iconColor: "text-green-600"
    },
    stress: {
      bgColor: "bg-purple-50",
      textColor: "text-purple-800",
      iconBgColor: "bg-purple-100",
      iconColor: "text-purple-600"
    },
    mood: {
      bgColor: "bg-yellow-50",
      textColor: "text-yellow-800",
      iconBgColor: "bg-yellow-100",
      iconColor: "text-yellow-600"
    },
    nutrition: {
      bgColor: "bg-red-50",
      textColor: "text-red-800",
      iconBgColor: "bg-red-100",
      iconColor: "text-red-600"
    }
  };

  // Icon map
  const categoryIcons: Record<string, IconProp> = {
    sleep: "moon",
    activity: "walking",
    stress: "brain",
    mood: "heart",
    nutrition: "apple-alt"
  };
  
  // Apply styling to each tip
  const styledTips = tips.map((tip: any) => ({
    ...tip,
    ...categoryStyles[tip.category] || categoryStyles.mood,
    icon: categoryIcons[tip.category] || "lightbulb"
  }));
  
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <h2 className="font-semibold mb-4">AI Recommendations</h2>
        
        {isLoading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : styledTips.length > 0 ? (
          <div className="space-y-4">
            {styledTips.map((tip: Tip) => (
              <div key={tip.id} className={`p-3 ${tip.bgColor} rounded-lg`}>
                <div className="flex items-start">
                  <div className={`${tip.iconBgColor} ${tip.iconColor} p-2 rounded-lg mr-3`}>
                    <FontAwesomeIcon icon={tip.icon} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-medium ${tip.textColor}`}>{tip.title}</h3>
                    <p className={`text-xs ${tip.iconColor} mt-1`}>{tip.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 text-gray-500">
            <FontAwesomeIcon icon="lightbulb" className="text-2xl mb-2 text-gray-400" />
            <p className="text-sm">No recommendations available yet. Keep using the app to get personalized tips.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AITips;
