import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function AdminSignOffs() {
  const [name, setName] = React.useState<string>('Admin');
  const [signOpen, setSignOpen] = React.useState(false);
  const [pendingCompletion, setPendingCompletion] = React.useState<any | null>(null);
  const [signedName, setSignedName] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'assigned' | 'inprogress' | 'completed' | 'signoffs'>('all');

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const display = (u?.user_metadata as any)?.full_name || u?.email || 'Admin';
      setName(display);
    });
  }, []);

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });
  const userId = session?.user?.id;

  const { data: allAssignments = [], refetch } = useQuery({
    queryKey: ['admin-trainer-assignments', userId],
    queryFn: async () => {
      if (!userId) return [] as any[];
      
      // Get all assignments for this admin/manager as trainer
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          id,
          status,
          due_date,
          assigned_at,
          trainer_user_id,
          module_id,
          assigned_to
        `)
        .eq('trainer_user_id', userId)
        .order('assigned_at', { ascending: false });
      
      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError);
        throw assignmentsError;
      }
      
      // Get modules for these assignments
      const moduleIds = [...new Set(assignments?.map(a => a.module_id) || [])];
      let modules: any[] = [];
      if (moduleIds.length > 0) {
        const { data: modulesData, error: modulesError } = await supabase
          .from('modules')
          .select('id, title, version')
          .in('id', moduleIds);
        
        if (modulesError) {
          console.error('Error fetching modules:', modulesError);
        } else {
          modules = modulesData || [];
        }
      }
      
      // Get users for these assignments
      const userIds = [...new Set(assignments?.map(a => a.assigned_to) || [])];
      let users: any[] = [];
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, role')
          .in('id', userIds);
        
        if (usersError) {
          console.error('Error fetching users:', usersError);
        } else {
          users = usersData || [];
        }
      }
      
      // Get completions for these assignments
      const assignmentIds = assignments?.map(a => a.id) || [];
      let completions: any[] = [];
      if (assignmentIds.length > 0) {
        const { data: completionsData, error: completionsError } = await supabase
          .from('completions')
          .select('id, assignment_id, completed_at')
          .in('assignment_id', assignmentIds);
        
        if (completionsError) {
          console.error('Error fetching completions:', completionsError);
        } else {
          completions = completionsData || [];
        }
      }
      
      // Get trainer signoffs for these completions
      const completionIds = completions?.map(c => c.id) || [];
      let signoffs: any[] = [];
      if (completionIds.length > 0) {
        const { data: signoffsData, error: signoffsError } = await supabase
          .from('trainer_signoffs')
          .select('id, completion_id, signed_at')
          .in('completion_id', completionIds);
        
        if (signoffsError) {
          console.error('Error fetching signoffs:', signoffsError);
        } else {
          signoffs = signoffsData || [];
        }
      }
      
      // Combine the data and categorize
      const result = assignments?.map(assignment => {
        const completion = completions?.find(c => c.assignment_id === assignment.id);
        const hasSignoff = signoffs.some(s => s.completion_id === completion?.id);
        const signoff = signoffs.find(s => s.completion_id === completion?.id);
        const module = modules.find(m => m.id === assignment.module_id);
        const user = users.find(u => u.id === assignment.assigned_to);
        
        return {
          id: assignment.id,
          status: assignment.status,
          due_date: assignment.due_date,
          assigned_at: assignment.assigned_at,
          module: module || null,
          user: user || null,
          trainer_user_id: assignment.trainer_user_id,
          completion: completion || null,
          hasSignoff: hasSignoff,
          signoff: signoff || null,
          needsSignoff: !!completion && !hasSignoff,
          isCompleted: !!completion && hasSignoff,
          isInProgress: !!completion && !hasSignoff
        };
      }) || [];
      
      return result;
    },
    enabled: !!userId,
  });

  // Categorize assignments
  const assigned = allAssignments.filter(a => !a.completion);
  const inProgress = allAssignments.filter(a => a.isInProgress);
  const completed = allAssignments.filter(a => a.isCompleted);
  const toSign = allAssignments.filter(a => a.needsSignoff);

  React.useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`admin-trainer-dashboard-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trainer_signoffs' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, refetch]);

  const [signingOff, setSigningOff] = React.useState(false);

  const handleSignoff = async () => {
    if (!pendingCompletion || !userId || !signedName) return;
    
    setSigningOff(true);
    try {
      const email = session?.user?.email || '';
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
      const completionId = pendingCompletion.completion?.id;
      
      if (!completionId) {
        console.error('No completion ID found for sign-off');
        alert('Error: No completion ID found');
        return;
      }
      
      console.log('Creating trainer sign-off for completion:', completionId);
      
      const { error } = await supabase.from('trainer_signoffs').insert({
        completion_id: completionId,
        trainer_user_id: userId,
        signed_name_snapshot: signedName || name,
        signed_email_snapshot: email,
        user_agent: ua,
      });
      
      if (error) {
        console.error('Error creating trainer sign-off:', error);
        alert(`Error: ${error.message}`);
        return;
      }
      
      console.log('Trainer sign-off created successfully');
      alert('Sign-off completed successfully!');
      setSignOpen(false);
      setPendingCompletion(null);
      setSignedName('');
      await refetch();
    } catch (error) {
      console.error('Failed to create trainer sign-off:', error);
      alert(`Failed to sign off: ${error}`);
    } finally {
      setSigningOff(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-background overflow-y-scroll">
      <Header userType="admin" userName={name} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Manager Sign-Offs</h2>
            <p className="text-muted-foreground">Manage your trainer sign-offs for assigned training modules.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              console.log('Manual refetch triggered');
              refetch();
            }}
          >
            Refresh
          </Button>
          </div>

          {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card 
            className={`cursor-pointer hover:bg-muted/50 transition-colors ${activeFilter === 'assigned' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveFilter('assigned')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Assigned</span>
                <span className="text-2xl font-bold">{assigned.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer hover:bg-muted/50 transition-colors ${activeFilter === 'inprogress' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveFilter('inprogress')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Progress</span>
                <span className="text-2xl font-bold">{inProgress.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer hover:bg-muted/50 transition-colors ${activeFilter === 'completed' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveFilter('completed')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Completed</span>
                <span className="text-2xl font-bold">{completed.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer hover:bg-muted/50 transition-colors ${activeFilter === 'signoffs' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveFilter('signoffs')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sign Offs</span>
                <span className="text-2xl font-bold">{toSign.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer hover:bg-muted/50 transition-colors ${activeFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">All</span>
                <span className="text-2xl font-bold">{allAssignments.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

          {/* Filtered Training Modules */}
        <Card>
          <CardHeader>
            <CardTitle>
              {activeFilter === 'all' && 'My Assigned Training Modules'}
              {activeFilter === 'assigned' && 'Assigned Training Modules'}
              {activeFilter === 'inprogress' && 'Training Modules In Progress'}
              {activeFilter === 'completed' && 'Completed Training Modules'}
              {activeFilter === 'signoffs' && 'Pending Sign-Offs'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              let filteredAssignments = allAssignments;
              
              if (activeFilter === 'assigned') {
                filteredAssignments = assigned;
              } else if (activeFilter === 'inprogress') {
                filteredAssignments = inProgress;
              } else if (activeFilter === 'completed') {
                filteredAssignments = completed;
              } else if (activeFilter === 'signoffs') {
                filteredAssignments = toSign;
              }
              
              if (filteredAssignments.length === 0) {
                return (
                  <div className="text-sm text-muted-foreground">
                    {activeFilter === 'all' && 'No training modules assigned yet.'}
                    {activeFilter === 'assigned' && 'No assigned training modules.'}
                    {activeFilter === 'inprogress' && 'No training modules in progress.'}
                    {activeFilter === 'completed' && 'No completed training modules.'}
                    {activeFilter === 'signoffs' && 'No items awaiting sign-off.'}
                  </div>
                );
              }
              
              return (
                <div className="space-y-3">
                  {filteredAssignments.map((a: any) => {
                  const hasCompletion = Boolean(a?.completion?.id);
                  const hasSignoff = Boolean(a?.signoff?.id);
                  const needsSignoff = hasCompletion && !hasSignoff;
                  const isCompleted = hasCompletion && hasSignoff;
                  const isInProgress = hasCompletion && !hasSignoff;
                  
                  let statusLabel = 'Not Started';
                  let badgeVariant: "default" | "destructive" | "outline" | "secondary" = 'outline';
                  
                  if (isCompleted) {
                    statusLabel = 'Completed';
                    badgeVariant = 'default';
                  } else if (needsSignoff) {
                    statusLabel = 'Awaiting Sign-Off';
                    badgeVariant = 'secondary';
                  } else if (hasCompletion) {
                    statusLabel = 'Completed';
                    badgeVariant = 'default';
                  }
                  
                  return (
                    <div key={a.id} className="flex items-center justify-between border rounded-lg p-4">
                      <div>
                        <div className="font-semibold">{a.module?.title || 'Module Title Not Available'}</div>
                        <div className="text-xs text-muted-foreground">
                          Trainee: {a.user?.first_name || 'N/A'} {a.user?.last_name || ''} • {a.user?.email || 'N/A'} ({a.user?.role || 'N/A'})
                        </div>
                        {hasCompletion && (
                          <div className="text-xs text-muted-foreground">Completed: {a.completion?.completed_at ? new Date(a.completion.completed_at).toLocaleString() : '—'}</div>
                        )}
                        {hasSignoff && (
                          <div className="text-xs text-muted-foreground">Signed Off: {a.signoff?.signed_at ? new Date(a.signoff.signed_at).toLocaleString() : '—'}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={badgeVariant}>{statusLabel}</Badge>
                        {activeFilter === 'signoffs' && needsSignoff && (
                          <Button onClick={() => { setPendingCompletion(a); setSignOpen(true); }}>Manager Sign-Off</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
            })()}
          </CardContent>
        </Card>

          <Dialog open={signOpen} onOpenChange={setSignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Manager Sign-Off</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Please type your full name as your digital signature to acknowledge training completion.</p>
              <Input placeholder="Full name" value={signedName} onChange={(e) => setSignedName(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSignOpen(false)} disabled={signingOff}>Cancel</Button>
                <Button onClick={handleSignoff} disabled={!signedName || signingOff}>
                  {signingOff ? 'Signing Off...' : 'Sign Off'}
                </Button>
              </div>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
