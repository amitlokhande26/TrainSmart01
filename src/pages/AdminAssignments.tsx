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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const { data: lines } = useQuery({
    queryKey: ['lines'],
    queryFn: async () => (await supabase.from('lines').select('*').order('name')).data || []
  });

  const [selectedLine, setSelectedLine] = React.useState<string | null>(null);
  const [selectedUserRole, setSelectedUserRole] = React.useState<string | null>(null);
  const [moduleId, setModuleId] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState<string | null>(null);
  const [trainerId, setTrainerId] = React.useState<string | null>(null);
  const [dueDate, setDueDate] = React.useState<string>('');
  const [assigning, setAssigning] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  // Reset trainer when employee changes
  React.useEffect(() => {
    setTrainerId(null);
  }, [employeeId]);

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
    queryFn: async () => (await supabase.from('users').select('id,first_name,last_name,email,role').in('role',['employee','supervisor','manager','admin']).order('first_name')).data || []
  });

  const { data: trainers } = useQuery({
    queryKey: ['trainers', selectedUserRole, employeeId],
    queryFn: async () => {
      // Get current logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      
      console.log('Debug - employeeId:', employeeId, 'currentUserId:', currentUserId, 'selectedUserRole:', selectedUserRole);
      
      // If selected user is supervisor, only show managers and admins as trainers
      // If selected user is employee, show supervisors, managers, and admins
      // If selected user is manager, show managers and admins
      // If selected user is admin, show managers and admins
      const roles = selectedUserRole === 'supervisor' ? ['manager', 'admin'] : 
                   selectedUserRole === 'manager' ? ['manager', 'admin'] : 
                   selectedUserRole === 'admin' ? ['manager', 'admin'] :
                   ['supervisor', 'manager', 'admin'];
      
      const allTrainers = await supabase.from('users').select('id,first_name,last_name,email,role').in('role', roles).order('first_name');
      
      if (allTrainers.data) {
        console.log('All trainers before filtering:', allTrainers.data.map(t => ({ id: t.id, name: t.first_name, email: t.email })));
        
        // Always exclude the selected trainee from trainer list to prevent self-assignment
        const filtered = allTrainers.data.filter(trainer => trainer.id !== employeeId);
        console.log('Filtered trainers (excluding selected trainee):', filtered.map(t => ({ id: t.id, name: t.first_name, email: t.email })));
        console.log('Excluded trainee ID:', employeeId);
        return filtered;
      }
      
      return [];
    },
    enabled: !!selectedUserRole && !!employeeId
  });

  const assignModule = async () => {
    if (!moduleId || !employeeId) return;
    setAssigning(true);
    setMessage(null);
    try {
      const { data: me } = await supabase.auth.getUser();
      const assignedBy = me.user?.id as string;
      
      // Prevent self-assignment as both trainee and trainer
      if (employeeId === assignedBy && trainerId === assignedBy) {
        setMessage('Error: You cannot assign yourself as both trainee and trainer in the same assignment.');
        setAssigning(false);
        return;
      }
      
      const payload: any = { module_id: moduleId, assigned_to: employeeId, assigned_by: assignedBy };
      if (dueDate) payload.due_date = dueDate;
      if (trainerId) payload.trainer_user_id = trainerId;
      const { error } = await supabase.from('assignments').insert(payload);
      if (error) throw error;
      setMessage('Assigned successfully');
    } catch (e: any) {
      // Check for duplicate assignment error and show friendly message
      if (e?.message?.includes('duplicate key value violates unique constraint "assignments_module_id_assigned_to_key"')) {
        setMessage('🤔 Hey, they\'ve already got this training. Wanna pick another?');
      } else {
        setMessage(e?.message || 'Failed to assign');
      }
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType="admin" userName={name} onLogout={handleLogout} />
      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Assignments</h1>
          <p className="text-gray-600">Assign training modules to users and choose appropriate trainers by role.</p>
        </div>

        <Card className="shadow-md border-0 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-gray-900">Create Assignment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-1">
              <div className="text-sm font-medium text-gray-700 mb-1">Production Line</div>
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
            </div>

            <div className="md:col-span-1">
              <div className="text-sm font-medium text-gray-700 mb-1">Module</div>
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
            </div>

            <div className="md:col-span-1">
              <div className="text-sm font-medium text-gray-700 mb-1">Trainee</div>
              <Select value={employeeId ?? undefined} onValueChange={(v) => {
                setEmployeeId(v);
                setTrainerId(null);
                const selectedUser = employees?.find((e: any) => e.id === v);
                setSelectedUserRole(selectedUser?.role || null);
                console.log('Employee selected:', v, 'Role:', selectedUser?.role);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select User" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} • {e.email} ({e.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1">
              <div className="text-sm font-medium text-gray-700 mb-1">Trainer</div>
              <Select value={trainerId ?? undefined} onValueChange={(v) => {
                if (v === employeeId) {
                  console.log('Preventing self-assignment as trainer');
                  setMessage('Error: You cannot assign yourself as both trainee and trainer.');
                  return;
                }
                setTrainerId(v);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    selectedUserRole === 'supervisor'
                      ? 'Select Trainer (Manager/Admin)'
                      : selectedUserRole === 'manager'
                      ? 'Select Trainer (Manager/Admin)'
                      : selectedUserRole === 'admin'
                      ? 'Select Trainer (Manager/Admin)'
                      : 'Select Trainer (Supervisor/Manager/Admin)'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {trainers && trainers.length > 0 ? (
                    trainers.map((t: any) => (
                      <SelectItem
                        key={t.id}
                        value={t.id}
                        disabled={t.id === employeeId}
                      >
                        {t.first_name} {t.last_name} • {t.email} ({t.role})
                        {t.id === employeeId ? ' (Cannot train yourself)' : ''}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-trainers" disabled>
                      {selectedUserRole === 'manager' && employeeId
                        ? 'No other managers available (you cannot train yourself)'
                        : 'No trainers available'}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1">
              <div className="text-sm font-medium text-gray-700 mb-1">Due Date</div>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            {selectedUserRole === 'manager' && employeeId && (
              <div className="md:col-span-4">
                <div className="rounded-lg bg-yellow-50 text-yellow-800 px-3 py-2 text-xs">
                  💡 Note: You can assign yourself as the trainer for other managers, but you cannot assign yourself as both trainee and trainer in the same assignment.
                  {trainers && trainers.length === 0 && (
                    <span className="block text-yellow-900 mt-1">
                      ⚠️ No other managers available for training. You cannot train yourself.
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="md:col-span-4 flex items-center gap-3 pt-2">
              <Button onClick={assignModule} disabled={!moduleId || !employeeId || assigning}>
                {assigning ? 'Assigning...' : 'Assign Module'}
              </Button>
              {message && <span className="text-sm text-gray-600">{message}</span>}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


