import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { User, Shield, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';

interface LoginFormProps {
  onLogin: (userType: 'admin' | 'employee', userName: string) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });
  const [employeeForm, setEmployeeForm] = useState({ name: '', employeeId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminForm.email,
        password: adminForm.password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        onLogin('admin', data.user.email || 'Admin User');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeForm.name && employeeForm.employeeId) {
      onLogin('employee', employeeForm.name);
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
                <span className="text-4xl font-bold text-accent">Smart</span>
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
          {/* Welcome Message */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-2">Welcome Back</h2>
            <p className="text-muted-foreground">Please sign in to access your training portal</p>
          </div>

        <Card className="shadow-brand">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="employee" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="employee" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Employee
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Manager
                </TabsTrigger>
              </TabsList>

              <TabsContent value="employee" className="space-y-4">
                <form onSubmit={handleEmployeeLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your full name"
                      value={employeeForm.name}
                      onChange={(e) => setEmployeeForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeId">Employee ID</Label>
                    <Input
                      id="employeeId"
                      type="text"
                      placeholder="Enter your employee ID"
                      value={employeeForm.employeeId}
                      onChange={(e) => setEmployeeForm(prev => ({ ...prev, employeeId: e.target.value }))}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" size="lg">
                    Access Training Portal
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="admin" className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="manager@company.com"
                      value={adminForm.email}
                      onChange={(e) => setAdminForm(prev => ({ ...prev, email: e.target.value }))}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={adminForm.password}
                      onChange={(e) => setAdminForm(prev => ({ ...prev, password: e.target.value }))}
                      disabled={loading}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="accent" 
                    className="w-full" 
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Access Admin Panel'}
                  </Button>
                </form>
                
                <div className="text-sm text-muted-foreground text-center">
                  <p>Admin accounts are managed by system administrators.</p>
                  <p>Contact your system admin if you need access.</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}