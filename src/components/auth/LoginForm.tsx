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
                <span className="text-4xl font-bold text-accent">Smart™</span>
              </div>
              <div className="text-base font-medium text-muted-foreground">
                Professional Training Management System
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-200px)]">
        <div className="w-full max-w-md">
          <Card className="shadow-brand">
            <CardHeader>
              <CardTitle className="text-center text-2xl">Sign In</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={form.email}
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                      required
                      disabled={loading}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
                
                <div className="text-center text-sm text-muted-foreground mt-4">
                  <p>Don't have an account? Contact your manager to create your employee login.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}