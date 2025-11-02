import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { LoginForm } from '@/components/auth/LoginForm';
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';
import { supabase } from '@/integrations/supabase/client';
// Avoid importing types to prevent tooling issues in some environments
import logo from '@/assets/logo.png';

type UserType = 'admin' | 'employee' | 'supervisor' | null;

export function TrainSmartApp() {
  const [user, setUser] = useState<{
    type: UserType;
    name: string;
  }>({ type: null, name: '' });
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);

  useEffect(() => {
    const deriveUserFromSession = async (session: any | null) => {
      if (!session?.user) {
        setUser({ type: null, name: '' });
        setNeedsPasswordReset(false);
        return;
      }
      
      // Check if user needs password reset
      const needsPasswordReset = (session.user.app_metadata as any)?.needs_password_reset;
      console.log('🔍 TrainSmartApp: needsPasswordReset =', needsPasswordReset);
      
      if (needsPasswordReset) {
        console.log('🔍 TrainSmartApp: User needs password reset, keeping LoginForm visible');
        setNeedsPasswordReset(true);
        setUser({ type: null, name: '' }); // Keep user as null so LoginForm stays visible
        return;
      }
      
      setNeedsPasswordReset(false);
      
      // Check if user is active
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_active')
        .eq('id', session.user.id)
        .single();

      if (userError || !userData?.is_active) {
        console.log('🔍 TrainSmartApp: User account is inactive, logging out');
        await supabase.auth.signOut();
        setUser({ type: null, name: '' });
        return;
      }
      
      const role: string | undefined = (session.user.app_metadata as any)?.role || (session.user.user_metadata as any)?.role;
      const email = session.user.email || '';
      // Try to get first_name and last_name from the users table
      let displayName = 'User';
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', session.user.id)
          .single();
        
        if (userData && userData.first_name && userData.last_name) {
          displayName = `${userData.first_name} ${userData.last_name}`;
        } else {
          // Fallback to user metadata or email
          displayName = (session.user.user_metadata as any)?.full_name || email || 'User';
        }
      } catch (error) {
        // Fallback to user metadata or email
        displayName = (session.user.user_metadata as any)?.full_name || email || 'User';
      }
      const mappedRole: UserType = role === 'admin' || role === 'manager' ? 'admin' : role === 'supervisor' ? 'supervisor' : 'employee';
      setUser({ type: mappedRole, name: displayName });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      deriveUserFromSession(newSession);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      deriveUserFromSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (_userType: 'admin' | 'employee' | 'supervisor', _userName: string) => {
    // No-op: the auth state listener will set the user based on Supabase session and role
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser({ type: null, name: '' });
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

  if (!user.type || needsPasswordReset) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Large Brand Banner */}
      <div className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-b-2 border-primary/20">
        <div className="w-full">
          {/* Stretched Logo */}
          <div className="w-full h-[226px] bg-primary/5 flex items-center justify-center overflow-hidden py-2">
            <img 
              src={logo} 
              alt="TrainSmart Logo" 
              className="w-full h-[236px] object-cover"
              style={{ objectPosition: '0% 41%' }}
            />
          </div>
          
          {/* Brand Name and Description Below Logo */}
          <div className="w-full h-[70px] bg-primary/5 flex items-center justify-center overflow-hidden">
            <img 
              src="/images/trainsmart-logo.png" 
              alt="TrainSmart™ - Smart Training Management" 
              className="h-[75px] w-auto"
              onError={(e) => {
                console.error('Main logo failed to load. Using fallback...');
                e.currentTarget.src = '/images/trainsmart-logo.png';
              }}
            />
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
        ) : user.type === 'supervisor' ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Supervisor</h2>
            <p className="text-muted-foreground mb-6">Use the Sign Offs tab in the top navigation to approve your trainees.</p>
            <a href="/supervisor" className="underline">Open Sign Offs</a>
          </div>
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