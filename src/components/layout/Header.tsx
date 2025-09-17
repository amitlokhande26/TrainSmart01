import React from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings } from 'lucide-react';
import companyBanner from '@/assets/company-banner.png';

interface HeaderProps {
  userType: 'admin' | 'employee';
  userName: string;
  onLogout: () => void;
}

export function Header({ userType, userName, onLogout }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border shadow-card">
      {/* Company Banner */}
      <div className="w-full">
        <img src={companyBanner} alt="Company Banner" className="w-full h-auto object-cover" />
      </div>
      
      {/* Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* TrainSmart Brand */}
          <div className="flex items-center">
            <span className="text-2xl font-bold text-primary">Train</span>
            <span className="text-2xl font-bold text-accent">Smart</span>
          </div>

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{userName}</span>
              <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                {userType === 'admin' ? 'Manager' : 'Employee'}
              </span>
            </div>
            
            {userType === 'admin' && (
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            )}
            
            <Button variant="outline" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}