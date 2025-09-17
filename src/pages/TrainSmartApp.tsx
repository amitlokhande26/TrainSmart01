import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { LoginForm } from '@/components/auth/LoginForm';
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';
import logo from '@/assets/logo.png';

type UserType = 'admin' | 'employee' | null;

export function TrainSmartApp() {
  const [user, setUser] = useState<{
    type: UserType;
    name: string;
  }>({ type: null, name: '' });

  const handleLogin = (userType: 'admin' | 'employee', userName: string) => {
    setUser({ type: userType, name: userName });
  };

  const handleLogout = () => {
    setUser({ type: null, name: '' });
  };

  if (!user.type) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Large Brand Banner */}
      <div className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-b-2 border-primary/20">
        <div className="w-full">
          {/* Stretched Logo */}
          <div className="w-full h-56 bg-primary/5 flex items-center justify-center overflow-hidden">
            <img 
              src={logo} 
              alt="TrainSmart Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Brand Name and Description Below Logo */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex items-center">
                <span className="text-4xl font-bold text-primary">Train</span>
                <span className="text-4xl font-bold text-accent">Smart</span>
              </div>
              <div className="text-base font-medium text-muted-foreground">
                Professional Training Management System
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Header
        userType={user.type}
        userName={user.name}
        onLogout={handleLogout}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user.type === 'employee' ? (
          <EmployeeDashboard userName={user.name} />
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Admin Dashboard</h2>
            <p className="text-muted-foreground mb-8">
              Admin features will be available once you connect Supabase for backend functionality.
            </p>
            <div className="bg-gradient-card rounded-lg p-8 max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold mb-4">Coming Soon: Admin Features</h3>
              <ul className="text-left space-y-2 text-muted-foreground">
                <li>• Upload and manage SOPs</li>
                <li>• Assign training modules to employees</li>
                <li>• Generate progress reports</li>
                <li>• Export data to Excel</li>
                <li>• Send email notifications</li>
                <li>• Track employee completion rates</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}