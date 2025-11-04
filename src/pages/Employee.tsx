import React from 'react';
import { Header } from '@/components/layout/Header';
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';
import { useAuth } from '@/contexts/AuthContext';

export default function Employee() {
  const { user, signOut } = useAuth();
  const name = user?.name || 'Employee';

  return (
    <div className="min-h-screen bg-background">
      <Header userType={user?.type || 'employee'} userName={name} onLogout={signOut} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EmployeeDashboard userName={name} />
      </main>
    </div>
  );
}


