import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconProp } from "@fortawesome/fontawesome-svg-core";

interface Tip {
  id: string;
  category: string;
  title: string;
  description: string;
  content: string;
  icon: IconProp;
}

const Tips: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/tips/all'],
  });
  
  const tips = data?.tips || [];
  const categories = data?.categories || [];
  
  // Get icon for category
  const getCategoryIcon = (category: string): IconProp => {
    const iconMap: Record<string, IconProp> = {
      sleep: "moon",
      activity: "walking",
      stress: "brain", 
      mood: "heart",
      nutrition: "apple-alt",
      mindfulness: "leaf",
      productivity: "tasks",
      social: "users",
      default: "lightbulb"
    };
    
    return iconMap[category] || iconMap.default;
  };
  
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Wellness Tips</h1>
      
      <Tabs defaultValue="all">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Tips</TabsTrigger>
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
              {tips.map((tip: Tip) => (
                <Card key={tip.id} className="shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-start space-x-4">
                      <div className={`bg-${tip.category === 'sleep' ? 'blue' : tip.category === 'activity' ? 'green' : tip.category === 'stress' ? 'purple' : tip.category === 'mood' ? 'yellow' : 'gray'}-100 text-${tip.category === 'sleep' ? 'blue' : tip.category === 'activity' ? 'green' : tip.category === 'stress' ? 'purple' : tip.category === 'mood' ? 'yellow' : 'gray'}-600 p-3 rounded-full`}>
                        <FontAwesomeIcon icon={getCategoryIcon(tip.category)} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{tip.title}</CardTitle>
                        <p className="text-sm text-gray-500 mt-1">{tip.category.charAt(0).toUpperCase() + tip.category.slice(1)}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">{tip.description}</p>
                    {tip.content && (
                      <div className="mt-4 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {tip.content}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        {categories.map((category: string) => (
          <TabsContent key={category} value={category}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tips
                .filter((tip: Tip) => tip.category === category)
                .map((tip: Tip) => (
                  <Card key={tip.id} className="shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-start space-x-4">
                        <div className={`bg-${category === 'sleep' ? 'blue' : category === 'activity' ? 'green' : category === 'stress' ? 'purple' : category === 'mood' ? 'yellow' : 'gray'}-100 text-${category === 'sleep' ? 'blue' : category === 'activity' ? 'green' : category === 'stress' ? 'purple' : category === 'mood' ? 'yellow' : 'gray'}-600 p-3 rounded-full`}>
                          <FontAwesomeIcon icon={getCategoryIcon(category)} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{tip.title}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600">{tip.description}</p>
                      {tip.content && (
                        <div className="mt-4 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                          {tip.content}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Tips;
