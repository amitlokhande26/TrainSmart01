import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { User, Shield } from 'lucide-react';
import logo from '@/assets/logo.png';

interface LoginFormProps {
  onLogin: (userType: 'admin' | 'employee', userName: string) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });
  const [employeeForm, setEmployeeForm] = useState({ name: '', employeeId: '' });

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminForm.email && adminForm.password) {
      onLogin('admin', 'Admin Manager');
    }
  };

  const handleEmployeeLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeForm.name && employeeForm.employeeId) {
      onLogin('employee', employeeForm.name);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={logo} alt="Company Logo" className="h-16 w-auto mx-auto mb-4" />
          <div className="flex items-center justify-center mb-2">
            <span className="text-4xl font-bold text-white">Train</span>
            <span className="text-4xl font-bold text-accent">Smart</span>
          </div>
          <p className="text-white/80 text-lg">Professional Training Management System</p>
        </div>

        <Card className="shadow-brand">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Welcome Back</CardTitle>
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
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="manager@company.com"
                      value={adminForm.email}
                      onChange={(e) => setAdminForm(prev => ({ ...prev, email: e.target.value }))}
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
                      required
                    />
                  </div>
                  <Button type="submit" variant="accent" className="w-full" size="lg">
                    Access Admin Panel
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}