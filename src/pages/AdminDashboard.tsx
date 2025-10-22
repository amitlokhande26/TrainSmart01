import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [name, setName] = React.useState<string>('Admin');
  React.useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (u) {
        // Try to get first_name and last_name from the users table
        const { data: userData } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', u.id)
          .single();
        
        if (userData && userData.first_name && userData.last_name) {
          setName(`${userData.first_name} ${userData.last_name}`);
        } else {
          // Fallback to user metadata or email
          const display = (u?.user_metadata as any)?.full_name || u?.email || 'Admin';
          setName(display);
        }
      }
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

  const { data: moduleCoverage, refetch: refetchModuleCoverage } = useQuery({
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
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground mb-2">Analytics Dashboard</h2>
          <button 
            onClick={() => {
              refetchModuleCoverage();
              console.log('Module coverage data:', moduleCoverage);
            }}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            Refresh Data
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Employees */}
          <Card 
            className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-blue-50 to-blue-100 border-0 cursor-pointer hover:scale-105"
            onClick={() => navigate('/admin/users#users-list')}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">Total Employees</h2>
                <p className="text-3xl font-bold text-blue-800">{totalEmployees}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-blue-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* Avg Completion % */}
          <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-green-50 to-green-100 border-0">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">Avg Completion %</h2>
                <p className="text-3xl font-bold text-green-800">{avgPct}%</p>
              </div>
              <div className="bg-green-200 p-3 rounded-full">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* Total Modules */}
          <Card 
            className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-purple-50 to-purple-100 border-0 cursor-pointer hover:scale-105"
            onClick={() => navigate('/admin/library')}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">Total Modules</h2>
                <p className="text-3xl font-bold text-purple-800">{totalModules}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-purple-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <svg className="h-4 w-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* Assignments */}
          <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-orange-50 to-orange-100 border-0">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">Assignments</h2>
                <p className="text-3xl font-bold text-orange-800">{totalAssigned}</p>
              </div>
              <div className="bg-orange-200 p-3 rounded-full">
                <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* Completions */}
          <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-teal-50 to-teal-100 border-0">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">Completions</h2>
                <p className="text-3xl font-bold text-teal-800">{totalCompleted}</p>
              </div>
              <div className="bg-teal-200 p-3 rounded-full">
                <svg className="h-6 w-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* Remaining */}
          <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-red-50 to-red-100 border-0">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">Remaining</h2>
                <p className="text-3xl font-bold text-red-800">{Math.max(totalAssigned - totalCompleted, 0)}</p>
              </div>
              <div className="bg-red-200 p-3 rounded-full">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs */}
          <Card 
            className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-slate-50 to-slate-100 border-0 cursor-pointer hover:scale-105"
            onClick={() => navigate('/admin/audit-logs')}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">Audit Logs</h2>
                <p className="text-sm text-slate-700 mt-1">Track Activity</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-slate-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}


