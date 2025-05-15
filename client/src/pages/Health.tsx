import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, BarChart, ProgressCircle } from "@/components/ui/chart";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";

const Health: React.FC = () => {
  const startDate = format(subMonths(new Date(), 1), "yyyy-MM-dd");
  const endDate = format(new Date(), "yyyy-MM-dd");
  
  const { data: sleepData, isLoading: loadingSleep } = useQuery({
    queryKey: ['/api/sleep/monthly', startDate, endDate],
  });
  
  const { data: activityData, isLoading: loadingActivity } = useQuery({
    queryKey: ['/api/activity/monthly', startDate, endDate],
  });
  
  const { data: moodData, isLoading: loadingMood } = useQuery({
    queryKey: ['/api/mood/monthly', startDate, endDate],
  });
  
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Health Tracking</h1>
      
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sleep">Sleep</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="mood">Mood</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3">
                      <FontAwesomeIcon icon="moon" />
                    </div>
                    <div>
                      <h3 className="font-medium">Sleep</h3>
                      <p className="text-sm text-gray-500">Last 30 days</p>
                    </div>
                  </div>
                  <ProgressCircle 
                    percentage={sleepData?.goalPercentage || 0} 
                    value={`${sleepData?.average?.toFixed(1) || 0}h`}
                    color="#4AAED9"
                    size={60}
                    strokeWidth={6}
                  />
                </div>
                <div className="h-20">
                  {loadingSleep ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    <BarChart 
                      data={sleepData?.sleep ? sleepData.sleep.slice(-7) : []} 
                      barKey="hours" 
                      height={80}
                      color="#4AAED9"
                      showXAxis={false}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center">
                    <div className="bg-green-100 text-green-600 p-2 rounded-lg mr-3">
                      <FontAwesomeIcon icon="walking" />
                    </div>
                    <div>
                      <h3 className="font-medium">Activity</h3>
                      <p className="text-sm text-gray-500">Last 30 days</p>
                    </div>
                  </div>
                  <ProgressCircle 
                    percentage={activityData?.goalPercentage || 0} 
                    value={activityData?.average?.toLocaleString() || 0}
                    label="steps"
                    color="#4ADE80"
                    size={60}
                    strokeWidth={6}
                  />
                </div>
                <div className="h-20">
                  {loadingActivity ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-spin h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    <AreaChart 
                      data={activityData?.activity ? activityData.activity.slice(-7) : []} 
                      areaKey="steps" 
                      height={80}
                      color="#4ADE80"
                      showXAxis={false}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center">
                    <div className="bg-yellow-100 text-yellow-600 p-2 rounded-lg mr-3">
                      <FontAwesomeIcon icon="heart" />
                    </div>
                    <div>
                      <h3 className="font-medium">Mood</h3>
                      <p className="text-sm text-gray-500">Last 30 days</p>
                    </div>
                  </div>
                  <ProgressCircle 
                    percentage={moodData?.average || 0} 
                    value={`${moodData?.average || 0}%`}
                    color="#FACC15"
                    size={60}
                    strokeWidth={6}
                  />
                </div>
                <div className="h-20">
                  {loadingMood ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-spin h-5 w-5 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    <BarChart 
                      data={moodData?.moods ? moodData.moods.slice(-7) : []} 
                      barKey="value" 
                      height={80}
                      color="#FACC15"
                      showXAxis={false}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Weekly Health Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {loadingSleep || loadingActivity || loadingMood ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <AreaChart 
                    data={moodData?.moods ? moodData.moods : []} 
                    areaKey="value" 
                    height={256}
                    showGrid
                    showXAxis
                    showYAxis
                  />
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Health Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-start">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3">
                      <FontAwesomeIcon icon="moon" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-blue-800">Sleep Pattern</h3>
                      <p className="text-xs text-blue-600 mt-1">
                        You sleep best on weekends. Try maintaining a consistent sleep schedule throughout the week.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-start">
                    <div className="bg-green-100 text-green-600 p-2 rounded-lg mr-3">
                      <FontAwesomeIcon icon="walking" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-green-800">Activity Impact</h3>
                      <p className="text-xs text-green-600 mt-1">
                        Days with 8,000+ steps show a 25% improvement in your reported mood.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-start">
                    <div className="bg-purple-100 text-purple-600 p-2 rounded-lg mr-3">
                      <FontAwesomeIcon icon="brain" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-purple-800">Stress Reduction</h3>
                      <p className="text-xs text-purple-600 mt-1">
                        Journal entries mentioning meditation show reduced stress indicators the following day.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sleep">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Sleep Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {loadingSleep ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <BarChart 
                    data={sleepData?.sleep || []} 
                    barKey="hours" 
                    color="#4AAED9"
                    height={320}
                    showGrid
                    tooltipFormatter={(value) => `${value} hours`}
                  />
                )}
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sleep Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center py-6">
                  <ProgressCircle 
                    percentage={sleepData?.qualityScore || 0} 
                    value={`${sleepData?.qualityScore || 0}%`}
                    label="Quality"
                    color="#4AAED9"
                    size={160}
                  />
                </div>
                
                <div className="space-y-3 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Duration</span>
                    <span className="text-sm font-medium">{sleepData?.average?.toFixed(1) || 0}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Consistency</span>
                    <span className="text-sm font-medium">{sleepData?.consistency || 0}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Optimal Nights</span>
                    <span className="text-sm font-medium">{sleepData?.optimalNights || 0} of 30</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Sleep Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3 mt-0.5">
                      <FontAwesomeIcon icon="clock" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Consistent Schedule</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Go to bed and wake up at the same time every day, even on weekends.
                      </p>
                    </div>
                  </li>
                  
                  <li className="flex items-start">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3 mt-0.5">
                      <FontAwesomeIcon icon="mobile" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Limit Screen Time</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Avoid screens at least 1 hour before bedtime to improve sleep quality.
                      </p>
                    </div>
                  </li>
                  
                  <li className="flex items-start">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3 mt-0.5">
                      <FontAwesomeIcon icon="coffee" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Watch Caffeine Intake</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Avoid caffeine at least 6 hours before bedtime.
                      </p>
                    </div>
                  </li>
                  
                  <li className="flex items-start">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3 mt-0.5">
                      <FontAwesomeIcon icon="moon" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Create a Sleep Environment</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Keep your bedroom cool, dark, and quiet for optimal sleep.
                      </p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="activity">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Activity Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {loadingActivity ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <AreaChart 
                    data={activityData?.activity || []} 
                    areaKey="steps" 
                    color="#4ADE80"
                    height={320}
                    showGrid
                    tooltipFormatter={(value) => `${value.toLocaleString()} steps`}
                  />
                )}
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center">
                  <div className="bg-green-100 text-green-600 p-3 rounded-full mb-4">
                    <FontAwesomeIcon icon="walking" className="text-xl" />
                  </div>
                  <h3 className="text-lg font-semibold">{activityData?.average?.toLocaleString() || 0}</h3>
                  <p className="text-sm text-gray-500">Avg. Daily Steps</p>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                    <div 
                      className="bg-green-500 rounded-full h-2" 
                      style={{ width: `${activityData?.goalPercentage || 0}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {activityData?.goalPercentage || 0}% of 10,000 goal
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center">
                  <div className="bg-blue-100 text-blue-600 p-3 rounded-full mb-4">
                    <FontAwesomeIcon icon="fire" className="text-xl" />
                  </div>
                  <h3 className="text-lg font-semibold">{activityData?.caloriesBurned || 0}</h3>
                  <p className="text-sm text-gray-500">Avg. Daily Calories</p>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                    <div 
                      className="bg-blue-500 rounded-full h-2" 
                      style={{ width: `${(activityData?.caloriesBurned || 0) / 5}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Based on step count
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center">
                  <div className="bg-purple-100 text-purple-600 p-3 rounded-full mb-4">
                    <FontAwesomeIcon icon="trophy" className="text-xl" />
                  </div>
                  <h3 className="text-lg font-semibold">{activityData?.activeDays || 0}</h3>
                  <p className="text-sm text-gray-500">Active Days</p>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                    <div 
                      className="bg-purple-500 rounded-full h-2" 
                      style={{ width: `${((activityData?.activeDays || 0) / 30) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Last 30 days
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="mood">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Mood Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {loadingMood ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <BarChart 
                    data={moodData?.moods || []} 
                    barKey="value" 
                    height={320}
                    showGrid
                    tooltipFormatter={(value) => `Mood: ${value}/100`}
                  />
                )}
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Mood Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center py-4">
                  <ProgressCircle 
                    percentage={moodData?.average || 0} 
                    value={`${moodData?.average || 0}%`}
                    label="Average Mood"
                    color="#6366F1"
                    size={140}
                  />
                </div>
                
                <div className="space-y-3 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Best Day</span>
                    <span className="text-sm font-medium">{moodData?.bestDay || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Mood Stability</span>
                    <span className="text-sm font-medium">{moodData?.stability || 0}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Good Days</span>
                    <span className="text-sm font-medium">{moodData?.goodDays || 0} of 30</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Mood Influences</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <div className="bg-green-100 text-green-600 p-2 rounded-lg mr-3 mt-0.5">
                      <FontAwesomeIcon icon="walking" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Exercise</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Days with physical activity show 30% higher mood ratings.
                      </p>
                    </div>
                  </li>
                  
                  <li className="flex items-start">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3 mt-0.5">
                      <FontAwesomeIcon icon="moon" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Sleep Quality</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Each additional hour of sleep correlates with 8% mood improvement.
                      </p>
                    </div>
                  </li>
                  
                  <li className="flex items-start">
                    <div className="bg-yellow-100 text-yellow-600 p-2 rounded-lg mr-3 mt-0.5">
                      <FontAwesomeIcon icon="sun" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Outdoor Time</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Journal entries mentioning outdoor activities show 25% higher mood.
                      </p>
                    </div>
                  </li>
                  
                  <li className="flex items-start">
                    <div className="bg-purple-100 text-purple-600 p-2 rounded-lg mr-3 mt-0.5">
                      <FontAwesomeIcon icon="users" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Social Interaction</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Social activities correlate with 20% mood improvement.
                      </p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Health;
