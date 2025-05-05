import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";

interface Theme {
  id: string;
  text: string;
  bgColor: string;
  textColor: string;
}

interface Correlation {
  id: string;
  text: string;
  positive: boolean;
}

const JournalInsights: React.FC = () => {
  const { data, isLoading } = useQuery<{ themes: Theme[], correlations: Correlation[] }>({
    queryKey: ['/api/journal/insights'],
  });
  
  const themes = data?.themes || [];
  const correlations = data?.correlations || [];
  
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">Journal Insights</h2>
          <button className="text-gray-400 hover:text-gray-600">
            <FontAwesomeIcon icon="ellipsis-h" />
          </button>
        </div>
        
        {isLoading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-100 rounded-lg p-3">
              <h3 className="text-sm font-medium mb-2">Common Themes</h3>
              {themes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {themes.map((theme: Theme) => (
                    <span 
                      key={theme.id} 
                      className={`${theme.bgColor} ${theme.textColor} text-xs py-1 px-2 rounded-full`}
                    >
                      {theme.text}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No themes detected yet. Continue journaling to see patterns.</p>
              )}
            </div>
            
            <div className="border border-gray-100 rounded-lg p-3">
              <h3 className="text-sm font-medium mb-2">Mood Correlations</h3>
              {correlations.length > 0 ? (
                <ul className="text-xs space-y-2">
                  {correlations.map((correlation: Correlation) => (
                    <li key={correlation.id} className="flex items-center">
                      <FontAwesomeIcon 
                        icon={correlation.positive ? "arrow-up" : "arrow-down"} 
                        className={correlation.positive ? "text-green-500 mr-2" : "text-red-500 mr-2"} 
                      />
                      <span>{correlation.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">No correlations detected yet. Continue tracking to see patterns.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JournalInsights;
