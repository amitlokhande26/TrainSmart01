import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AdminUsers() {
  const [name, setName] = React.useState<string>('Admin');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

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

  const { data: employees, refetch } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => (await supabase.from('users').select('*').eq('role','employee').order('first_name')).data || []
  });

  const [selectedEmployee, setSelectedEmployee] = React.useState<any | null>(null);
  const { data: selectedAssignments = [] } = useQuery({
    queryKey: ['employee-assignments', selectedEmployee?.id],
    queryFn: async () => {
      if (!selectedEmployee?.id) return [] as any[];
      const { data, error } = await supabase
        .from('assignments')
        .select('id,status,due_date,module:modules(id,title,version)')
        .eq('assigned_to', selectedEmployee.id)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedEmployee?.id,
  });

  const createEmployee = async () => {
    if (!firstName || !lastName || !email) return;
    setCreating(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('create_employee_user', {
        body: { first_name: firstName, last_name: lastName, email, default_password: 'EmployeeTrain1*', initial_module_ids: [] }
      });
      if (error) throw error;
      setMessage(`Created user ${email}`);
      setFirstName(''); setLastName(''); setEmail('');
      await refetch();
    } catch (e: any) {
      setMessage(e?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">User Management</h2>
          <p className="text-muted-foreground">Create employee accounts with default password.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Employee</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <Input type="email" placeholder="email@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button onClick={createEmployee} disabled={creating || !firstName || !lastName || !email}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
            {message && <div className="md:col-span-4 text-sm text-muted-foreground">{message}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employees</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(employees || []).map((u: any) => (
              <div key={u.id} className="border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/40" onClick={() => setSelectedEmployee(u)}>
                <div>
                  <div className="font-medium">{u.first_name} {u.last_name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="text-xs text-muted-foreground">{u.role}</div>
              </div>
            ))}
            {(employees || []).length === 0 && (
              <div className="text-sm text-muted-foreground">No employees yet.</div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Employee Assignments</DialogTitle>
            </DialogHeader>
            {!selectedEmployee ? null : (
              <div className="space-y-4">
                <div>
                  <div className="font-semibold">{selectedEmployee.first_name} {selectedEmployee.last_name}</div>
                  <div className="text-xs text-muted-foreground">{selectedEmployee.email}</div>
                </div>
                <div className="space-y-2">
                  {(selectedAssignments || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No assignments for this employee.</div>
                  ) : (
                    (selectedAssignments || []).map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between border rounded-lg p-3">
                        <div>
                          <div className="font-medium">{a.module?.title}</div>
                          <div className="text-xs text-muted-foreground">v{a.module?.version}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{a.status}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}


