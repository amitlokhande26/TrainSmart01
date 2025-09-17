import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { LoginForm } from '@/components/auth/LoginForm';
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import logo from '@/assets/logo.png';

type UserType = 'admin' | 'employee' | null;

export function TrainSmartApp() {
  const [user, setUser] = useState<{
    type: UserType;
    name: string;
  }>({ type: null, name: '' });
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session?.user) {
          // For authenticated users, set as admin
          setUser({ type: 'admin', name: session.user.email || 'Admin User' });
        } else if (user.type === 'admin') {
          // Only clear admin users on logout, keep employee sessions
          setUser({ type: null, name: '' });
        }
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser({ type: 'admin', name: session.user.email || 'Admin User' });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (userType: 'admin' | 'employee', userName: string) => {
    if (userType === 'employee') {
      // Employee login doesn't use Supabase
      setUser({ type: userType, name: userName });
    }
    // Admin login is handled by Supabase auth state change
  };

  const handleLogout = async () => {
    if (user.type === 'admin') {
      // Logout admin from Supabase
      await supabase.auth.signOut();
    } else {
      // Logout employee (mock auth)
      setUser({ type: null, name: '' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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