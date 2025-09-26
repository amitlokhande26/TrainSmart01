import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';

export default function AdminDashboard() {
  const [name, setName] = React.useState<string>('Admin');
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const display = (u?.user_metadata as any)?.full_name || u?.email || 'Admin';
      setName(display);
    });
  }, []);

  const { data: employeeProgress } = useQuery({
    queryKey: ['v_employee_progress'],
    queryFn: async () => (await supabase.from('v_employee_progress').select('*')).data || [],
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    refetchInterval: 10000,
  });

  const { data: moduleCoverage } = useQuery({
    queryKey: ['v_module_coverage'],
    queryFn: async () => (await supabase.from('v_module_coverage').select('*')).data || [],
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    refetchInterval: 10000,
  });

  const totalEmployees = employeeProgress?.length || 0;
  const avgPct = totalEmployees > 0 ? Math.round((employeeProgress as any[]).reduce((a, e: any) => a + (Number(e.pct_complete) || 0), 0) / totalEmployees) : 0;
  const totalModules = moduleCoverage?.length || 0;
  const totalAssigned = (moduleCoverage as any[] | undefined)?.reduce((a, m: any) => a + Number(m.assigned_count || 0), 0) || 0;
  const totalCompleted = (moduleCoverage as any[] | undefined)?.reduce((a, m: any) => a + Number(m.completed_count || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={async () => supabase.auth.signOut()} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Analytics Dashboard</h2>
    
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle>Total Employees</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{totalEmployees}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Avg Completion %</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{avgPct}%</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total Modules</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{totalModules}</CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle>Assignments</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{totalAssigned}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Completions</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{totalCompleted}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Remaining</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{Math.max(totalAssigned - totalCompleted, 0)}</CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}


