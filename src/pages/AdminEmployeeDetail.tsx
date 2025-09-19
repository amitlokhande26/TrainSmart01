import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';

export default function AdminEmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = React.useState<string>('Admin');

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const display = (u?.user_metadata as any)?.full_name || u?.email || 'Admin';
      setName(display);
    });
  }, []);

  const { data: employee } = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase.from('users').select('*').eq('id', id).single();
      return data as any;
    },
    enabled: !!id,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['employee-assignments', id],
    queryFn: async () => {
      if (!id) return [] as any[];
      const { data, error } = await supabase
        .from('assignments')
        .select('id,status,due_date,assigned_at,module:modules(id,title,version)')
        .eq('assigned_to', id)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={async () => supabase.auth.signOut()} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Employee Assignments</h2>
            <p className="text-muted-foreground">View training modules assigned to this employee.</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/admin/users')}>Back to Users</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {employee ? (
                <span>{employee.first_name} {employee.last_name} <span className="text-sm text-muted-foreground">({employee.email})</span></span>
              ) : (
                'Loading employee...'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(assignments || []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No assignments for this employee.</div>
            ) : (
              <div className="grid gap-3">
                {(assignments || []).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between border rounded-lg p-4">
                    <div>
                      <div className="font-semibold">{a.module?.title}</div>
                      <div className="text-xs text-muted-foreground">v{a.module?.version}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{a.status}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


