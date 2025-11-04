import React from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import companyBanner from '@/assets/idl-banner.png.png';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { AdminTabStyle } from './AdminTabStyle';

interface HeaderProps {
  userType: 'admin' | 'manager' | 'employee' | 'supervisor';
  userName: string;
  onLogout: () => void;
}

export function Header({ userType, userName, onLogout }: HeaderProps) {
  // Ensure sidecar profile exists for admins/managers to satisfy FK constraints (e.g., assignments.assigned_by)
  React.useEffect(() => {
    if (userType !== 'admin' && userType !== 'manager') return;
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
    <header className="bg-card border-b border-border shadow-card m-0 p-0">
      {/* Company Banner */}
      <div className="w-full bg-gray-100">
        <img 
          src={companyBanner} 
          alt="IDL - Every Drop Matters" 
          className="w-full h-60 object-cover"
          style={{
            objectPosition: 'center 45%'
          }}
          onError={(e) => {
            console.error('Banner image failed to load:', e);
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement!.innerHTML = '<div class="w-full bg-gradient-to-r from-orange-400 via-yellow-400 via-pink-400 to-purple-500 h-16 flex items-center justify-center"><div class="text-center"><div class="text-2xl font-bold text-white mb-1">IDL</div><div class="text-sm text-white font-semibold">EVERY DROP MATTERS</div></div></div>';
          }}
        />
      </div>
      
      {/* Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 -ml-20">
          {/* Left side: Logo and Tabs */}
          <div className="flex items-center gap-8">
            {/* TrainSmart Brand */}
            <div className="flex items-center">
              <img 
                src="/images/trainsmart-header-logo.png" 
                alt="TrainSmart™" 
                className="h-[160px] w-auto object-cover object-left"
                onError={(e) => {
                  console.error('Header logo failed to load. Using fallback text...');
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '<span class="text-3xl font-bold text-primary">Train</span><span class="text-3xl font-bold text-accent">Smart™</span>';
                  
                }}
              />
            </div>
            {/* Admin/Manager Nav */}
            {(userType === 'admin' || userType === 'manager') && (
              <div className="hidden md:flex items-center mr-5">
                <AdminTabStyle />
              </div>
            )}
          </div>

          {/* Right side: User Info and Actions */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="font-bold">{userName}</span>
              <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                {userType === 'admin' ? 'Admin' : userType === 'manager' ? 'Manager' : userType === 'supervisor' ? 'Supervisor' : 'Employee'}
              </span>
            </div>
            
            
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