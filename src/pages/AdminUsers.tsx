import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';

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
              <div key={u.id} className="border rounded-lg p-3 flex items-center justify-between">
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
      </main>
    </div>
  );
}


