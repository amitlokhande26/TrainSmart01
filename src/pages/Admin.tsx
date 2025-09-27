import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, FileCheck, Settings } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function Admin() {
  const [name, setName] = React.useState<string>('Admin');

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const display = (u?.user_metadata as any)?.full_name || u?.email || 'Admin';
      setName(display);
    });
  }, []);

  // Fetch analytics data
  const { data: analyticsData } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      // Get total employees
      const { count: totalEmployees } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'employee');

      // Get total modules
      const { count: totalModules } = await supabase
        .from('modules')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get total assignments
      const { count: totalAssignments } = await supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true });

      // Get completed assignments
      const { count: completedAssignments } = await supabase
        .from('completions')
        .select('*', { count: 'exact', head: true });

      // Calculate completion percentage
      const completionPercentage = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

      return {
        totalEmployees: totalEmployees || 0,
        totalModules: totalModules || 0,
        totalAssignments: totalAssignments || 0,
        completedAssignments: completedAssignments || 0,
        remainingAssignments: (totalAssignments || 0) - (completedAssignments || 0),
        completionPercentage
      };
    }
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-4">Admin Dashboard</h2>
          <p className="text-muted-foreground text-lg">Choose a management area to get started</p>
        </div>

        {/* Analytics Dashboard */}
        <div className="space-y-6 mb-8">
          <h1 className="text-xl font-bold mb-4">Analytics Dashboard</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Total Employees */}
            <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-blue-50 to-blue-100 border-0">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">Total Employees</h2>
                  <p className="text-3xl font-bold text-blue-800">{analyticsData?.totalEmployees || 0}</p>
                </div>
                <div className="bg-blue-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
              </CardContent>
            </Card>

            {/* Avg Completion % */}
            <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-green-50 to-green-100 border-0">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">Avg Completion %</h2>
                  <p className="text-3xl font-bold text-green-800">{analyticsData?.completionPercentage || 0}%</p>
                </div>
                <div className="bg-green-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </CardContent>
            </Card>

            {/* Total Modules */}
            <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-purple-50 to-purple-100 border-0">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">Total Modules</h2>
                  <p className="text-3xl font-bold text-purple-800">{analyticsData?.totalModules || 0}</p>
                </div>
                <div className="bg-purple-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </CardContent>
            </Card>

            {/* Assignments */}
            <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-orange-50 to-orange-100 border-0">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">Assignments</h2>
                  <p className="text-3xl font-bold text-orange-800">{analyticsData?.totalAssignments || 0}</p>
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
                  <p className="text-3xl font-bold text-teal-800">{analyticsData?.completedAssignments || 0}</p>
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
                  <p className="text-3xl font-bold text-red-800">{analyticsData?.remainingAssignments || 0}</p>
                </div>
                <div className="bg-red-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl">Assignments</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">Manage training assignments for employees and supervisors</p>
              <Button asChild className="w-full">
                <a href="/admin/assignments">Manage Assignments</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-xl">Users</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">Manage user accounts and permissions</p>
              <Button asChild className="w-full">
                <a href="/admin/users">Manage Users</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle className="text-xl">Reports</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">View training completion reports and analytics</p>
              <Button asChild className="w-full">
                <a href="/admin/reports">View Reports</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <FileCheck className="h-6 w-6 text-orange-600" />
              </div>
              <CardTitle className="text-xl">Sign Offs</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">Review and approve training completions</p>
              <Button asChild className="w-full">
                <a href="/admin/signoffs">Manage Sign Offs</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <Settings className="h-6 w-6 text-gray-600" />
              </div>
              <CardTitle className="text-xl">Library</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">Manage training modules and materials</p>
              <Button asChild className="w-full">
                <a href="/admin/library">Manage Library</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}


