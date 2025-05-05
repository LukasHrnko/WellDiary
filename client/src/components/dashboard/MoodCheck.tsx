import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Mood types
type MoodType = "bad" | "okay" | "good" | "great" | "amazing";

// Mood data with emoji and value
const moodData: Record<MoodType, { emoji: string, value: number, label: string }> = {
  bad: { emoji: "😢", value: 20, label: "Bad" },
  okay: { emoji: "😐", value: 40, label: "Okay" },
  good: { emoji: "🙂", value: 60, label: "Good" },
  great: { emoji: "😄", value: 80, label: "Great" },
  amazing: { emoji: "🤩", value: 100, label: "Amazing" }
};

const MoodCheck: React.FC = () => {
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const moodMutation = useMutation({
    mutationFn: async (mood: MoodType) => {
      const response = await apiRequest("POST", "/api/mood", {
        value: moodData[mood].value,
        date: new Date().toISOString()
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Mood Saved",
        description: "Your mood has been recorded successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mood'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Save Mood",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const handleMoodSelect = (mood: MoodType) => {
    setSelectedMood(mood);
    moodMutation.mutate(mood);
  };
  
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <h2 className="font-semibold mb-4">How are you feeling today?</h2>
        <div className="flex justify-between space-x-2">
          {(Object.keys(moodData) as MoodType[]).map((mood) => (
            <button
              key={mood}
              className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg
                ${selectedMood === mood 
                  ? 'bg-gray-50 border border-gray-200' 
                  : 'hover:bg-gray-50 transition-colors'}`}
              onClick={() => handleMoodSelect(mood)}
              disabled={moodMutation.isPending}
            >
              <div className="text-2xl mb-1">{moodData[mood].emoji}</div>
              <span className={`text-xs ${selectedMood === mood ? 'font-medium' : ''}`}>
                {moodData[mood].label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default MoodCheck;
