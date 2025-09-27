import React, { useState } from 'react';
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
  const roleToPath = (u: any) => {
    const r = (u?.app_metadata as any)?.role || (u?.user_metadata as any)?.role;
    if (r === 'admin' || r === 'manager') return '/admin';
    if (r === 'supervisor') return '/supervisor';
    return '/employee';
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
        
        // Determine user type based on role
        let userType: 'admin' | 'employee' | 'supervisor' = 'employee';
        if (finalRole === 'admin' || finalRole === 'manager') {
          userType = 'admin';
        } else if (finalRole === 'supervisor') {
          userType = 'supervisor';
        }
        
        onLogin(userType, displayName);
        navigate(roleToPath(userForNav), { replace: true });
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Large Brand Banner */}
      <div className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-b-2 border-primary/20">
        <div className="w-full">
          {/* Stretched Logo */}
          <div className="w-full h-56 bg-primary/5 flex items-center justify-center overflow-hidden py-2">
            <img 
              src={logo} 
              alt="TrainSmart Logo" 
              className="w-full h-56 object-cover"
            />
          </div>
          
          {/* Brand Name and Description Below Logo */}
          <div className="w-full h-20 bg-primary/5 flex items-center justify-center overflow-hidden">
            <img 
              src="/images/trainsmart-logo.png" 
              alt="TrainSmart™ - Smart Training Management" 
              className="h-40 w-auto"
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
    </div>
  );
}