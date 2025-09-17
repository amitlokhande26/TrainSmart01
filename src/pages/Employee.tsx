import React from 'react';
import { Header } from '@/components/layout/Header';
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';
import { supabase } from '@/integrations/supabase/client';

export default function Employee() {
  const [name, setName] = React.useState<string>('Employee');

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const display = (u?.user_metadata as any)?.full_name || u?.email || 'Employee';
      setName(display);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header userType="employee" userName={name} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EmployeeDashboard userName={name} />
      </main>
    </div>
  );
}


