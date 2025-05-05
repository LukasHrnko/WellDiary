import * as React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";

type SidebarProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
};

interface NavItemProps {
  href: string;
  icon: IconProp;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const NavItem = ({ href, icon, label, active, onClick }: NavItemProps) => {
  return (
    <Link 
      href={href}
      className={cn(
        "flex items-center px-6 py-3 hover:bg-gray-50",
        active ? "text-primary border-r-4 border-primary" : "text-gray-500"
      )}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} className="w-5 h-5 mr-3" />
      <span className={active ? "font-medium" : ""}>{label}</span>
    </Link>
  );
};

export function Sidebar({ className, children, ...props }: SidebarProps) {
  const [location] = useLocation();
  const [showAIAssistant, setShowAIAssistant] = React.useState(true);
  
  return (
    <div className={cn("w-64 h-full bg-white shadow-lg z-10 hidden lg:block", className)} {...props}>
      <div className="p-6">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-5 h-5 bg-primary rounded-full"></div>
            <div className="w-5 h-5 bg-secondary rounded-full"></div>
          </div>
          <h1 className="text-xl font-semibold">WellDiary</h1>
        </div>
      </div>
      
      <nav className="mt-6">
        <NavItem
          href="/"
          icon="th-large"
          label="Dashboard"
          active={location === "/" || location === ""}
        />
        <NavItem
          href="/journal"
          icon="book"
          label="Journal"
          active={location === "/journal"}
        />
        <NavItem
          href="/health"
          icon="heart"
          label="Health"
          active={location === "/health"}
        />
        <NavItem
          href="/tips"
          icon="lightbulb"
          label="Tips"
          active={location === "/tips"}
        />
        <NavItem
          href="/achievements"
          icon="trophy"
          label="Achievements"
          active={location === "/achievements"}
        />
        <NavItem
          href="/settings"
          icon="cog"
          label="Settings"
          active={location === "/settings"}
        />
      </nav>
      
      {/* AI Assistant */}
      {showAIAssistant && (
        <div className="absolute bottom-4 left-4 right-4 bg-purple-50 p-4 rounded-xl">
          <div className="flex justify-between items-start">
            <h3 className="text-sm font-semibold text-purple-800">AI Assistant</h3>
            <button 
              className="text-purple-400 hover:text-purple-600"
              onClick={() => setShowAIAssistant(false)}
            >
              <FontAwesomeIcon icon="times" />
            </button>
          </div>
          <p className="text-xs text-purple-700 mt-2">
            Based on your sleep patterns, try going to bed 30 minutes earlier tonight.
          </p>
          <div className="mt-3 flex justify-end">
            <button className="text-xs text-purple-700 hover:text-purple-900">
              View more
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MobileNavigation() {
  const [location] = useLocation();
  
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white shadow-lg z-20">
      <div className="flex justify-around py-3">
        <Link 
          href="/"
          className={cn(
            "flex flex-col items-center",
            location === "/" || location === "" ? "text-primary" : "text-gray-500"
          )}
        >
          <FontAwesomeIcon icon="th-large" />
          <span className="text-xs mt-1">Dashboard</span>
        </Link>
        <Link 
          href="/journal"
          className={cn(
            "flex flex-col items-center",
            location === "/journal" ? "text-primary" : "text-gray-500"
          )}
        >
          <FontAwesomeIcon icon="book" />
          <span className="text-xs mt-1">Journal</span>
        </Link>
        <Link 
          href="/health"
          className={cn(
            "flex flex-col items-center",
            location === "/health" ? "text-primary" : "text-gray-500"
          )}
        >
          <FontAwesomeIcon icon="heart" />
          <span className="text-xs mt-1">Health</span>
        </Link>
        <Link 
          href="/achievements"
          className={cn(
            "flex flex-col items-center",
            location === "/achievements" ? "text-primary" : "text-gray-500"
          )}
        >
          <FontAwesomeIcon icon="trophy" />
          <span className="text-xs mt-1">Progress</span>
        </Link>
      </div>
    </div>
  );
}

export default Sidebar;
