import React from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings } from 'lucide-react';
import companyBanner from '@/assets/company-banner.png';
import { supabase } from '@/integrations/supabase/client';

interface HeaderProps {
  userType: 'admin' | 'employee';
  userName: string;
  onLogout: () => void;
}

export function Header({ userType, userName, onLogout }: HeaderProps) {
  // Ensure sidecar profile exists for admins to satisfy FK constraints (e.g., assignments.assigned_by)
  React.useEffect(() => {
    if (userType !== 'admin') return;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const u = authData.user;
      if (!u) return;
      const { data: row } = await supabase.from('users').select('id').eq('id', u.id).single();
      if (!row) {
        const first = (u.user_metadata as any)?.first_name || 'Manager';
        const last = (u.user_metadata as any)?.last_name || 'User';
        await supabase.from('users').insert({ id: u.id, first_name: first, last_name: last, email: u.email, role: 'manager' });
      }
    })();
  }, [userType]);

  return (
    <header className="bg-card border-b border-border shadow-card">
      {/* Company Banner */}
      <div className="w-full bg-gray-100">
        <img 
          src={companyBanner} 
          alt="Company Banner" 
          className="w-full h-24 object-cover"
          onError={(e) => {
            console.error('Banner image failed to load:', e);
            e.currentTarget.style.display = 'block';
            e.currentTarget.style.backgroundColor = '#f3f4f6';
            e.currentTarget.style.border = '2px dashed #d1d5db';
          }}
        />
      </div>
      
      {/* Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* TrainSmart Brand */}
          <div className="flex items-center">
            <span className="text-2xl font-bold text-primary">Train</span>
            <span className="text-2xl font-bold text-accent">Smart</span>
          </div>
          {/* Admin Nav */}
          {userType === 'admin' && (
            <nav className="hidden md:flex items-center gap-4 text-sm">
              <a className="hover:underline" href="/admin">Dashboard</a>
              <a className="hover:underline" href="/admin/library">Library</a>
              <a className="hover:underline" href="/admin/assignments">Assignments</a>
              <a className="hover:underline" href="/admin/users">Users</a>
              <a className="hover:underline" href="/admin/reports">Reports</a>
            </nav>
          )}

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