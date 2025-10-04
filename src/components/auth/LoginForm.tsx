import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';
import { useNavigate } from 'react-router-dom';

interface LoginFormProps {
  onLogin: (userType: 'admin' | 'employee' | 'supervisor', userName: string) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  
  // Create a wrapped setter to track all calls
  const setShowPasswordResetWithDebug = React.useCallback((value: boolean) => {
    console.log('🔍 setShowPasswordReset called with:', value);
    console.trace('🔍 STACK TRACE - setShowPasswordReset called');
    setShowPasswordReset(value);
  }, []);
  
  // Debug: Track all changes to showPasswordReset
  React.useEffect(() => {
    console.log('🔍 showPasswordReset changed to:', showPasswordReset);
    if (showPasswordReset) {
      console.log('🔍 Password reset modal should be visible');
    } else {
      console.log('🔍 Password reset modal should be hidden');
      console.trace('🔍 STACK TRACE - showPasswordReset set to false');
    }
  }, [showPasswordReset]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const roleToPath = (u: any) => {
    const r = (u?.app_metadata as any)?.role || (u?.user_metadata as any)?.role;
    if (r === 'admin' || r === 'manager') return '/admin';
    if (r === 'supervisor') return '/supervisor';
    return '/employee';
  };

  // Debug: Monitor onLogin calls
  const originalOnLogin = onLogin;
  const wrappedOnLogin = React.useCallback((userType: 'admin' | 'employee' | 'supervisor', displayName: string) => {
    console.log('🚨 onLogin called with:', { userType, displayName });
    console.log('🚨 Current showPasswordReset state:', showPasswordReset);
    console.log('🚨 Stack trace:', new Error().stack);
    if (showPasswordReset) {
      console.log('🚨 ERROR: onLogin called while password reset modal should be active! BLOCKING CALL.');
      return; // Don't call the original onLogin
    }
    return originalOnLogin(userType, displayName);
  }, [originalOnLogin, showPasswordReset]);

  // Prevent navigation when password reset is needed
  React.useEffect(() => {
    if (showPasswordReset) {
      console.log('Password reset modal is active - preventing navigation');
      // Override the navigate function to prevent navigation
      const originalNavigate = navigate;
      // Don't navigate anywhere when password reset is needed
    }
  }, [showPasswordReset, navigate]);

  // Debug effect to monitor showPasswordReset state
  React.useEffect(() => {
    console.log('showPasswordReset state changed to:', showPasswordReset);
    if (showPasswordReset) {
      console.log('Modal should be visible now - checking if it gets hidden...');
      // Check if something is hiding the modal
      setTimeout(() => {
        console.log('After 1 second - showPasswordReset is still:', showPasswordReset);
      }, 1000);
    }
  }, [showPasswordReset]);

  // Debug effect to monitor component re-renders
  React.useEffect(() => {
    console.log('🔍 LoginForm component rendered, showPasswordReset:', showPasswordReset);
  });

  // Debug effect to track component mount/unmount
  React.useEffect(() => {
    console.log('🔍 LoginForm component MOUNTED');
    return () => {
      console.log('🔍 LoginForm component UNMOUNTED');
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleLogin called - this should only happen once per login attempt');
    console.log('Current showPasswordReset state at start of handleLogin:', showPasswordReset);
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        let userForNav = data.user;
        const currentRole = (data.user.app_metadata as any)?.role || (data.user.user_metadata as any)?.role;
        
        if (!currentRole) {
          // Check if this is a supervisor email pattern
          const isSupervisor = data.user.email?.includes('supervisor');
          const defaultRole = isSupervisor ? 'supervisor' : 'employee';
          const { data: updated } = await supabase.auth.updateUser({ data: { role: defaultRole } });
          if (updated?.user) {
            userForNav = updated.user as any;
          }
        }
        
        const finalRole = (userForNav.app_metadata as any)?.role || (userForNav.user_metadata as any)?.role;
        const displayName = (userForNav.user_metadata as any)?.full_name || userForNav.email || 'User';
        const needsPasswordReset = (userForNav.app_metadata as any)?.needs_password_reset;
        
        // Debug logging
        console.log('Login debug:', {
          app_metadata: userForNav.app_metadata,
          user_metadata: userForNav.user_metadata,
          needsPasswordReset,
          finalRole,
          needsPasswordResetType: typeof needsPasswordReset,
          needsPasswordResetValue: needsPasswordReset
        });
        
        // Check if user needs to reset password
        if (needsPasswordReset) {
          console.log('Password reset required for user:', userForNav.email);
          console.log('Setting showPasswordReset to true');
          setLoading(false);
          setShowPasswordResetWithDebug(true);
          console.log('Password reset modal should now be visible');
          // Don't call onLogin or navigate - stay on login page for password reset
          return;
        }
        
        // Determine user type based on role
        let userType: 'admin' | 'employee' | 'supervisor' = 'employee';
        if (finalRole === 'admin' || finalRole === 'manager') {
          userType = 'admin';
        } else if (finalRole === 'supervisor') {
          userType = 'supervisor';
        }
        
        console.log('About to call onLogin and navigate - this should NOT happen for password reset');
        if (showPasswordReset) {
          console.log('BLOCKING onLogin and navigate - password reset modal is active!');
          return;
        }
        wrappedOnLogin(userType, displayName);
        navigate(roleToPath(userForNav), { replace: true });
        setLoading(false);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setResettingPassword(true);
    setError(null);

    try {
      // Update the user's password
      console.log('🔍 Updating password...');
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (passwordError) {
        console.error('🔍 Password update error:', passwordError);
        throw passwordError;
      }
      console.log('🔍 Password updated successfully');

      // Clear the password reset flag using Edge Function
      console.log('🔍 Clearing password reset flag...');
      try {
        const { data, error: flagError } = await supabase.functions.invoke('clear_password_reset_flag');
        if (flagError) {
          console.error('🔍 Failed to clear password reset flag:', flagError);
        } else {
          console.log('🔍 Password reset flag cleared successfully:', data);
        }
      } catch (e) {
        console.error('🔍 Exception clearing password reset flag:', e);
      }

      // Close the modal and proceed with login
      setShowPasswordResetWithDebug(false);
      setNewPassword('');
      setConfirmPassword('');
      
      // Trigger login flow again
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const finalRole = (user.app_metadata as any)?.role || (user.user_metadata as any)?.role;
        const displayName = (user.user_metadata as any)?.full_name || user.email || 'User';
        
        let userType: 'admin' | 'employee' | 'supervisor' = 'employee';
        if (finalRole === 'admin' || finalRole === 'manager') {
          userType = 'admin';
        } else if (finalRole === 'supervisor') {
          userType = 'supervisor';
        }
        
        wrappedOnLogin(userType, displayName);
        navigate(roleToPath(user), { replace: true });
      }
    } catch (err) {
      setError('Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

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
              className="h-[138px] w-auto"
              onError={(e) => {
                console.error('Main logo failed to load. Using fallback...');
                e.currentTarget.src = '/images/trainsmart-logo.png';
              }}
            />
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-200px)] bg-gradient-to-br from-background via-background to-muted/20">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
            <CardHeader className="space-y-2 pb-6">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              <CardTitle className="text-center text-2xl font-semibold">Welcome Back</CardTitle>
              <p className="text-center text-sm text-muted-foreground">Sign in to your account to continue</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={form.email}
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      required
                      disabled={loading}
                      className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                      required
                      disabled={loading}
                      className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-11 text-base font-medium transition-all duration-200 hover:shadow-lg" 
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Signing in...
                      </div>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
                
                <div className="text-center text-sm text-muted-foreground mt-6 pt-4 border-t border-border/50">
                  <p className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Don't have an account? Contact your manager to create your employee login.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Password Reset Modal */}
    {console.log('🔍 Modal render check - showPasswordReset:', showPasswordReset)}
    {showPasswordReset && (
      console.log('🔍 RENDERING MODAL - showPasswordReset is true')
    )}
    {showPasswordReset && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" 
          style={{
            zIndex: 2147483647, // Maximum z-index value to beat browser extensions
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200/50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Set Your Password</h2>
              <p className="text-blue-100 text-sm">
                Please create a secure password for your account
              </p>
            </div>

            {/* Form */}
            <div className="p-6">
              <form onSubmit={handlePasswordReset} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm font-semibold text-gray-700">
                    New Password
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter your new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={resettingPassword}
                    className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={resettingPassword}
                    className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                  />
                </div>

                {error && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-red-800">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPasswordResetWithDebug(false);
                      setNewPassword('');
                      setConfirmPassword('');
                      setError(null);
                    }}
                    disabled={resettingPassword}
                    className="flex-1 h-12 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={resettingPassword || !newPassword || !confirmPassword}
                    className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resettingPassword ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Setting Password...
                      </div>
                    ) : (
                      'Set Password'
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 text-center">
              <p className="text-xs text-gray-500">
                🔒 Your password is encrypted and secure
              </p>
            </div>
          </div>
        </div>,
      document.body
    )}
    </div>
  );
}