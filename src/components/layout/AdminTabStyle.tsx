import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface AdminTabStyleProps {
  className?: string;
}

export function AdminTabStyle({ className }: AdminTabStyleProps) {
  const location = useLocation();
  
  // Check if current path matches the tab
  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(path);
  };

  const tabs = [
    { path: '/admin', label: 'Dashboard' },
    { path: '/admin/library', label: 'Library' },
    { path: '/admin/assignments', label: 'Assignments' },
    { path: '/admin/users', label: 'Users' },
    { path: '/admin/signoffs', label: 'Sign Offs' },
    { path: '/admin/mytraining', label: 'My Training' },
    { path: '/admin/reports', label: 'Reports' },
  ];

  return (
    <div className={cn("relative inline-flex items-center gap-2 p-1 rounded-lg bg-gray-100 shadow-sm", className)}>
      {/* Tab links */}
      <nav className="relative flex gap-2 p-1 whitespace-nowrap">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                "relative z-10 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0",
                active 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}