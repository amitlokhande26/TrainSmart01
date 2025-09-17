import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';

export default function Admin() {
  const [name, setName] = React.useState<string>('Admin');

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const display = (u?.user_metadata as any)?.full_name || u?.email || 'Admin';
      setName(display);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Admin Dashboard</h2>
          <p className="text-muted-foreground">Manager features will appear here.</p>
        </div>
      </main>
    </div>
  );
}


