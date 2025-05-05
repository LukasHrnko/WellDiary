import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const settingsFormSchema = z.object({
  profile: z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters." }),
    email: z.string().email({ message: "Please enter a valid email." }),
  }),
  preferences: z.object({
    weeklyReminders: z.boolean().default(true),
    journalPrompts: z.boolean().default(true),
    uploadDay: z.string().default("sunday"),
  }),
  goals: z.object({
    sleepHours: z.coerce.number().min(4).max(12),
    dailySteps: z.coerce.number().min(1000).max(25000),
    journalFrequency: z.string()
  })
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

const Settings: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  
  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/settings'],
  });
  
  // Form setup
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      profile: {
        name: "",
        email: "",
      },
      preferences: {
        weeklyReminders: true,
        journalPrompts: true,
        uploadDay: "sunday",
      },
      goals: {
        sleepHours: 8,
        dailySteps: 10000,
        journalFrequency: "weekly",
      }
    }
  });
  
  // Update form when settings are loaded
  React.useEffect(() => {
    if (settings) {
      form.reset({
        profile: {
          name: settings.profile.name,
          email: settings.profile.email,
        },
        preferences: {
          weeklyReminders: settings.preferences.weeklyReminders,
          journalPrompts: settings.preferences.journalPrompts,
          uploadDay: settings.preferences.uploadDay,
        },
        goals: {
          sleepHours: settings.goals.sleepHours,
          dailySteps: settings.goals.dailySteps,
          journalFrequency: settings.goals.journalFrequency,
        }
      });
    }
  }, [settings, form]);
  
  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      const response = await apiRequest("PUT", "/api/settings", values);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Your settings have been successfully updated.",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (values: SettingsFormValues) => {
    saveSettingsMutation.mutate(values);
  };
  
  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="flex justify-center p-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            Edit Settings
          </Button>
        )}
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="profile.name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Your name" 
                        {...field} 
                        disabled={!isEditing}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="profile.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="your.email@example.com" 
                        type="email" 
                        {...field} 
                        disabled={!isEditing}
                      />
                    </FormControl>
                    <FormDescription>
                      We'll use this email for notifications and reminders.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Notifications & Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="preferences.weeklyReminders"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Weekly Journal Reminders</FormLabel>
                      <FormDescription>
                        Receive reminders to upload your journal each week
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!isEditing}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <Separator />
              
              <FormField
                control={form.control}
                name="preferences.journalPrompts"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Daily Journal Prompts</FormLabel>
                      <FormDescription>
                        Receive daily prompts to help with your journaling
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!isEditing}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <Separator />
              
              <FormField
                control={form.control}
                name="preferences.uploadDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Journal Upload Day</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={!isEditing}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sunday">Sunday</SelectItem>
                        <SelectItem value="monday">Monday</SelectItem>
                        <SelectItem value="tuesday">Tuesday</SelectItem>
                        <SelectItem value="wednesday">Wednesday</SelectItem>
                        <SelectItem value="thursday">Thursday</SelectItem>
                        <SelectItem value="friday">Friday</SelectItem>
                        <SelectItem value="saturday">Saturday</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the day you want to upload your physical journal
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Health Goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="goals.sleepHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Sleep Hours</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="4" 
                        max="12" 
                        step="0.5" 
                        {...field} 
                        disabled={!isEditing}
                      />
                    </FormControl>
                    <FormDescription>
                      Set your daily sleep goal (hours)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="goals.dailySteps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Daily Steps</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1000" 
                        max="25000" 
                        step="500" 
                        {...field} 
                        disabled={!isEditing}
                      />
                    </FormControl>
                    <FormDescription>
                      Set your daily step goal
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="goals.journalFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Journal Frequency</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={!isEditing}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How often you plan to journal
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Export Your Data</h3>
                <p className="text-sm text-gray-500">
                  Download all your journal entries, mood data, and health metrics
                </p>
                <Button variant="outline" type="button" disabled={!isEditing}>
                  Export Data
                </Button>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-destructive">Delete Account</h3>
                <p className="text-sm text-gray-500">
                  Permanently delete your account and all your data
                </p>
                <Button variant="destructive" type="button" disabled={!isEditing}>
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {isEditing && (
            <div className="flex justify-end space-x-4">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => {
                  setIsEditing(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saveSettingsMutation.isPending}
              >
                {saveSettingsMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
};

export default Settings;
