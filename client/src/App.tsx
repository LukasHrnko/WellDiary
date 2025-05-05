import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Journal from "@/pages/Journal";
import Health from "@/pages/Health";
import Tips from "@/pages/Tips";
import AchievementsPage from "@/pages/AchievementsPage";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/journal" component={Journal} />
      <Route path="/health" component={Health} />
      <Route path="/tips" component={Tips} />
      <Route path="/achievements" component={AchievementsPage} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>
        <Router />
      </AppLayout>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
