import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { debugSupervisorCreation } from '@/utils/debugSupervisor';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [name, setName] = React.useState<string>('Admin');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  
  // Supervisor creation state
  const [supervisorFirstName, setSupervisorFirstName] = React.useState('');
  const [supervisorLastName, setSupervisorLastName] = React.useState('');
  const [supervisorEmail, setSupervisorEmail] = React.useState('');
  const [creatingSupervisor, setCreatingSupervisor] = React.useState(false);
  const [supervisorMessage, setSupervisorMessage] = React.useState<string | null>(null);

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

  const { data: supervisors, refetchSupervisors } = useQuery({
    queryKey: ['supervisors-list'],
    queryFn: async () => (await supabase.from('users').select('*').eq('role','supervisor').order('first_name')).data || []
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
      setMessage(`Created employee ${email} with password: EmployeeTrain1*`);
      setFirstName(''); setLastName(''); setEmail('');
      await refetch();
    } catch (e: any) {
      setMessage(e?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const createSupervisor = async () => {
    if (!supervisorFirstName || !supervisorLastName || !supervisorEmail) return;
    setCreatingSupervisor(true);
    setSupervisorMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('create_supervisor_user', {
        body: { first_name: supervisorFirstName, last_name: supervisorLastName, email: supervisorEmail, default_password: 'SuperTrain1*' }
      });
      if (error) throw error;
      setSupervisorMessage(`Created supervisor ${supervisorEmail} with password: SuperTrain1*`);
      setSupervisorFirstName(''); setSupervisorLastName(''); setSupervisorEmail('');
      await refetchSupervisors();
    } catch (e: any) {
      setSupervisorMessage(e?.message || 'Failed to create supervisor');
    } finally {
      setCreatingSupervisor(false);
    }
  };

  const resetSupervisorPassword = async (email: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('reset_supervisor_password', {
        body: { email, new_password: 'SuperTrain1*' }
      });
      if (error) throw error;
      alert(`Password reset for ${email}. New password: SuperTrain1*`);
      await refetchSupervisors();
    } catch (e: any) {
      alert(`Failed to reset password: ${e?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">User Management</h2>
            <p className="text-muted-foreground">Create employee accounts with default password.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => debugSupervisorCreation()}
          >
            Debug Supervisor
          </Button>
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
            <CardTitle>Create Supervisor</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <Input placeholder="First name" value={supervisorFirstName} onChange={(e) => setSupervisorFirstName(e.target.value)} />
            <Input placeholder="Last name" value={supervisorLastName} onChange={(e) => setSupervisorLastName(e.target.value)} />
            <Input type="email" placeholder="supervisor@company.com" value={supervisorEmail} onChange={(e) => setSupervisorEmail(e.target.value)} />
            <Button onClick={createSupervisor} disabled={creatingSupervisor || !supervisorFirstName || !supervisorLastName || !supervisorEmail}>
              {creatingSupervisor ? 'Creating...' : 'Create Supervisor'}
            </Button>
            {supervisorMessage && <div className="md:col-span-4 text-sm text-muted-foreground">{supervisorMessage}</div>}
          </CardContent>
        </Card>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Employees</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {(employees || []).map((u: any) => (
                <div key={u.id} className="border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/admin/users/${u.id}`)}>
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

          <Card>
            <CardHeader>
              <CardTitle>Supervisors</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {(supervisors || []).map((u: any) => (
                <div key={u.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{u.first_name} {u.last_name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground bg-primary/10 text-primary px-2 py-1 rounded">{u.role}</div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => resetSupervisorPassword(u.email)}
                      className="text-xs"
                    >
                      Reset Password
                    </Button>
                  </div>
                </div>
              ))}
              {(supervisors || []).length === 0 && (
                <div className="text-sm text-muted-foreground">No supervisors yet.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}


