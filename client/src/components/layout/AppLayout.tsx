import React from "react";
import { Sidebar, MobileNavigation } from "@/components/ui/sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  
  // Extract page title from location
  const getPageTitle = () => {
    if (location === "/" || location === "") return "Dashboard";
    if (location === "/auth") return "Přihlášení";
    return location.substring(1).charAt(0).toUpperCase() + location.substring(2);
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.username) return "?";
    return user.username.substring(0, 2).toUpperCase();
  };

  // Handle logout
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // If on auth page, render children without layout
  if (location === "/auth") {
    return <>{children}</>;
  }
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar for desktop */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        {/* Top Bar */}
        <div className="bg-white dark:bg-gray-950 p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center">
            <button className="lg:hidden mr-4 text-gray-500">
              <FontAwesomeIcon icon="bars" />
            </button>
            <h1 className="text-xl font-semibold">{getPageTitle()}</h1>
          </div>
          
          {user && (
            <div className="flex items-center space-x-4">
              <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <FontAwesomeIcon icon="bell" className="text-gray-500" />
              </button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                      <span>{getUserInitials()}</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.username}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        Uživatel aplikace WellDiary
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/settings" className="cursor-pointer flex w-full">
                      <User className="mr-2 h-4 w-4" />
                      <span>Nastavení profilu</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="cursor-pointer text-red-600 focus:text-red-600"
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{logoutMutation.isPending ? "Odhlašování..." : "Odhlásit se"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        
        {/* Page Content */}
        <main>
          {children}
        </main>
      </div>
      
      {/* Mobile Navigation */}
      <MobileNavigation />
    </div>
  );
};

export default AppLayout;
