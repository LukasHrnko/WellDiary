import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { JournalUploader } from "@/components/journal/JournalUploader";
import JournalCalendar from "@/components/journal/JournalCalendar";

interface JournalEntry {
  id: string;
  date: string;
  content: string;
  mood: number;
  sleep: number;
  activities: string[];
}

const Journal: React.FC = () => {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [content, setContent] = useState("");
  const [mood, setMood] = useState(70);
  const [sleep, setSleep] = useState(7.5);
  const [activities, setActivities] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data, isLoading } = useQuery<{ entries: JournalEntry[] }>({
    queryKey: ['/api/journal/entries'],
  });
  
  const entries = data?.entries || [];
  
  // Add new journal entry mutation
  const addEntryMutation = useMutation({
    mutationFn: async (formData: any) => {
      const response = await apiRequest("POST", "/api/journal/entry", formData);
      return await response.json();
    },
    onSuccess: () => {
      // Reset the form
      setContent("");
      setMood(70);
      setSleep(7.5);
      setActivities("");
      
      // Invalidate the query to refetch data
      queryClient.invalidateQueries({ queryKey: ["/api/journal/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mood"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sleep"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/insights"] });
      
      toast({
        title: "Success",
        description: "Journal entry added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add entry: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const handleEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse activities into an array
    const activitiesArray = activities
      .split(",")
      .map(activity => activity.trim())
      .filter(activity => activity.length > 0);
    
    // Submit the form data
    addEntryMutation.mutate({
      content,
      mood: Number(mood),
      sleep: Number(sleep),
      activities: activitiesArray,
      date,
    });
  };
  
  // Handler pro úspěšné nahrání přes JournalUploader komponentu
  const handleUploaderSuccess = (data: { journalId: number, text: string }) => {
    // Aktualizace dat
    queryClient.invalidateQueries({ queryKey: ["/api/journal/entries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/mood"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sleep"] });
    queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
    queryClient.invalidateQueries({ queryKey: ["/api/journal/insights"] });
    
    toast({
      title: "Úspěch!",
      description: "Deníkový záznam byl úspěšně nahrán a zpracován",
    });
  };
  
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Journal</h1>
      
      <Tabs defaultValue="entries">
        <TabsList className="mb-6">
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="new">New Entry</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>
        
        <TabsContent value="entries">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-1">
              <JournalCalendar 
                onSelectDate={(date) => {
                  setDate(format(date, "yyyy-MM-dd"));
                  const tabsList = document.querySelector('[data-value="new"]');
                  if (tabsList) {
                    (tabsList as HTMLElement).click();
                  }
                }}
              />
            </div>
            <div className="md:col-span-2">
              {isLoading ? (
                <div className="flex justify-center p-12">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : entries.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {entries.map((entry: JournalEntry) => (
                    <Card key={entry.id} className="shadow-sm">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg">
                            {format(new Date(entry.date), "EEEE, MMMM d, yyyy")}
                          </CardTitle>
                          <div className="flex space-x-2">
                            <div className="text-xs rounded-full px-2 py-1 bg-blue-50 text-blue-700">
                              {entry.sleep}h sleep
                            </div>
                            <div 
                              className={`text-xs rounded-full px-2 py-1 
                                ${entry.mood >= 70 
                                  ? 'bg-green-50 text-green-700' 
                                  : entry.mood >= 40 
                                    ? 'bg-yellow-50 text-yellow-700' 
                                    : 'bg-orange-50 text-orange-700'
                                }`}
                            >
                              Mood: {entry.mood}/100
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-gray-600">{entry.content}</p>
                        
                        {entry.activities && entry.activities.length > 0 && (
                          <div className="mt-3">
                            <h4 className="text-xs font-semibold text-gray-500 mb-1">Activities</h4>
                            <div className="flex flex-wrap gap-1">
                              {entry.activities.map((activity, index) => (
                                <span 
                                  key={index} 
                                  className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5"
                                >
                                  {activity}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-12">
                    <FontAwesomeIcon icon="book" className="text-4xl text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-800">No journal entries yet</h3>
                    <p className="text-gray-500 text-center mt-2">
                      Start by adding a new entry or uploading your paper journal
                    </p>
                    <div className="mt-6 flex gap-4">
                      <Button variant="default">Create New Entry</Button>
                      <Button variant="outline">Upload Journal</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle>New Journal Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleEntrySubmit}>
                <div>
                  <label htmlFor="entry-date" className="block text-sm font-medium mb-1">
                    Date
                  </label>
                  <Input 
                    id="entry-date" 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="entry-content" className="block text-sm font-medium mb-1">
                    Journal Entry
                  </label>
                  <Textarea 
                    id="entry-content" 
                    placeholder="How was your day? What's on your mind?" 
                    rows={6} 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="entry-mood" className="block text-sm font-medium mb-1">
                      Mood (1-100)
                    </label>
                    <Input 
                      id="entry-mood" 
                      type="number" 
                      min="1" 
                      max="100" 
                      value={mood}
                      onChange={(e) => setMood(Number(e.target.value))}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="entry-sleep" className="block text-sm font-medium mb-1">
                      Sleep (hours)
                    </label>
                    <Input 
                      id="entry-sleep" 
                      type="number" 
                      min="0" 
                      max="24" 
                      step="0.5" 
                      value={sleep}
                      onChange={(e) => setSleep(Number(e.target.value))}
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="entry-activities" className="block text-sm font-medium mb-1">
                    Activities (comma separated)
                  </label>
                  <Input 
                    id="entry-activities" 
                    placeholder="e.g. walking, reading, meditation" 
                    value={activities}
                    onChange={(e) => setActivities(e.target.value)}
                  />
                </div>
                
                <div className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={addEntryMutation.isPending || !content.trim()}
                  >
                    {addEntryMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : "Save Entry"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="upload">
          {/* Používáme novou komponentu pro pokročilé rozpoznávání rukopisu */}
          <JournalUploader onSuccess={handleUploaderSuccess} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Journal;