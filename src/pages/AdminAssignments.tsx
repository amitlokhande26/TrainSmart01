import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';

export default function AdminAssignments() {
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

  const { data: lines } = useQuery({
    queryKey: ['lines'],
    queryFn: async () => (await supabase.from('lines').select('*').order('name')).data || []
  });

  const [selectedLine, setSelectedLine] = React.useState<string | null>(null);
  const { data: modules } = useQuery({
    queryKey: ['modules-for-assign', selectedLine],
    queryFn: async () => {
      if (!selectedLine) return [] as any[];
      const { data } = await supabase.from('modules').select('id,title,version').eq('line_id', selectedLine).eq('is_active', true).order('title');
      return data || [];
    },
    enabled: !!selectedLine
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => (await supabase.from('users').select('id,first_name,last_name,email,role').eq('role','employee').order('first_name')).data || []
  });

  const { data: trainers } = useQuery({
    queryKey: ['trainers'],
    queryFn: async () => (await supabase.from('users').select('id,first_name,last_name,email,role').in('role',['supervisor','manager']).order('first_name')).data || []
  });

  const [moduleId, setModuleId] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState<string | null>(null);
  const [trainerId, setTrainerId] = React.useState<string | null>(null);
  const [dueDate, setDueDate] = React.useState<string>('');
  const [assigning, setAssigning] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const assignModule = async () => {
    if (!moduleId || !employeeId) return;
    setAssigning(true);
    setMessage(null);
    try {
      const { data: me } = await supabase.auth.getUser();
      const assignedBy = me.user?.id as string;
      const payload: any = { module_id: moduleId, assigned_to: employeeId, assigned_by: assignedBy };
      if (dueDate) payload.due_date = dueDate;
      if (trainerId) payload.trainer_user_id = trainerId;
      const { error } = await supabase.from('assignments').insert(payload);
      if (error) throw error;
      setMessage('Assigned successfully');
    } catch (e: any) {
      setMessage(e?.message || 'Failed to assign');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Assignments</h2>
          <p className="text-muted-foreground">Assign training modules to employees and set due dates.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Assignment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <Select onValueChange={(v) => { setSelectedLine(v); setModuleId(null); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select Line" />
              </SelectTrigger>
              <SelectContent>
                {lines?.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={moduleId ?? undefined} onValueChange={(v) => setModuleId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select Module" />
              </SelectTrigger>
              <SelectContent>
                {modules?.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>{m.title} (v{m.version})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={employeeId ?? undefined} onValueChange={(v) => setEmployeeId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                {employees?.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name} • {e.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={trainerId ?? undefined} onValueChange={(v) => setTrainerId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select Trainer (Supervisor/Manager)" />
              </SelectTrigger>
              <SelectContent>
                {trainers?.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name} • {t.email} ({t.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

            <div className="md:col-span-4">
              <Button onClick={assignModule} disabled={!moduleId || !employeeId || assigning}>
                {assigning ? 'Assigning...' : 'Assign Module'}
              </Button>
              {message && <span className="ml-3 text-sm text-muted-foreground">{message}</span>}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


