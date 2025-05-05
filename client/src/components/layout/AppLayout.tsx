import React from "react";
import { Sidebar, MobileNavigation } from "@/components/ui/sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useLocation } from "wouter";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [location] = useLocation();
  
  // Extract page title from location
  const getPageTitle = () => {
    if (location === "/" || location === "") return "Dashboard";
    return location.substring(1).charAt(0).toUpperCase() + location.substring(2);
  };
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar for desktop */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        {/* Top Bar */}
        <div className="bg-white p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center">
            <button className="lg:hidden mr-4 text-gray-500">
              <FontAwesomeIcon icon="bars" />
            </button>
            <h1 className="text-xl font-semibold">{getPageTitle()}</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full hover:bg-gray-100">
              <FontAwesomeIcon icon="bell" className="text-gray-500" />
            </button>
            <div className="flex items-center">
              <span className="mr-2 text-sm hidden md:block">John Doe</span>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                <span>JD</span>
              </div>
            </div>
          </div>
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
