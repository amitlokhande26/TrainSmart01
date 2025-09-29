import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AdminMyTraining() {
  const [name, setName] = React.useState<string>('Manager');
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'assigned' | 'inprogress' | 'completed'>('all');

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
          const display = (u?.user_metadata as any)?.full_name || u?.email || 'Manager';
          setName(display);
        }
      }
    });
  }, []);

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });
  const userId = session?.user?.id;

  const { data: allAssignments = [], refetch } = useQuery({
    queryKey: ['admin-mytraining-assignments', userId],
    queryFn: async () => {
      if (!userId) return [] as any[];
      
      // Get all assignments where manager is either the trainer OR the trainee
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
        .or(`trainer_user_id.eq.${userId},assigned_to.eq.${userId}`)
        .order('assigned_at', { ascending: false });
      
      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError);
        console.error('Assignments error details:', assignmentsError);
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
      
      // Get users for these assignments (both trainees and trainers)
      const traineeIds = [...new Set(assignments?.map(a => a.assigned_to) || [])];
      const trainerIds = [...new Set(assignments?.map(a => a.trainer_user_id).filter(Boolean) || [])];
      const allUserIds = [...new Set([...traineeIds, ...trainerIds])];
      let users: any[] = [];
      if (allUserIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, role')
          .in('id', allUserIds);
        
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
        const trainee = users.find(u => u.id === assignment.assigned_to);
        const trainer = users.find(u => u.id === assignment.trainer_user_id);
        
        // Determine if this manager is the trainer or trainee
        const isTrainer = assignment.trainer_user_id === userId;
        const isTrainee = assignment.assigned_to === userId;
        
        return {
          id: assignment.id,
          module_id: assignment.module_id,
          status: assignment.status,
          due_date: assignment.due_date,
          assigned_at: assignment.assigned_at,
          module: module || null,
          trainee: trainee || null,
          trainer: trainer || null,
          trainer_user_id: assignment.trainer_user_id,
          completion: completion || null,
          hasSignoff: hasSignoff,
          signoff: signoff || null,
          needsSignoff: !!completion && !hasSignoff,
          isCompleted: !!completion && hasSignoff,
          isInProgress: !!completion && !hasSignoff,
          isTrainer: isTrainer,
          isTrainee: isTrainee
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
  
  // Separate trainer vs trainee assignments
  const trainerAssignments = allAssignments.filter(a => a.isTrainer);
  const traineeAssignments = allAssignments.filter(a => a.isTrainee);

  React.useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`admin-mytraining-dashboard-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trainer_signoffs' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, refetch]);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingAssignment, setPendingAssignment] = React.useState<any | null>(null);

  const markComplete = async (assignment: any) => {
    try {
      const signedName = name;
      const signedEmail = session?.user?.email || '';
      const { data: c, error: cErr } = await supabase
        .from('completions')
        .insert({ assignment_id: assignment.id })
        .select('id')
        .single();
      if (cErr) throw cErr;
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
      const { error: sErr } = await supabase.from('signatures').insert({
        completion_id: c.id,
        signer_user_id: userId,
        signed_name_snapshot: signedName,
        signed_email_snapshot: signedEmail,
        user_agent: ua,
      });
      if (sErr) throw sErr;
      // Notify trainer if set
      try {
        console.log('Calling trainer_notify_signoff with:', { completion_id: c.id, assignment_id: assignment.id, trainer_user_id: assignment.trainer_user_id });
        const result = await supabase.functions.invoke('trainer_notify_signoff', { body: { completion_id: c.id, assignment_id: assignment.id } });
        console.log('Trainer notification result:', result);
      } catch (e) {
        console.error('Failed to notify trainer:', e);
      }
      await refetch();
    } catch (error) {
      console.error('Failed to mark complete:', error);
      alert(`Failed to mark complete: ${error}`);
    }
  };

  const openAssignmentMaterial = async (assignment: any) => {
    try {
      console.log('Opening assignment material for:', assignment);
      console.log('Assignment module_id:', assignment.module_id);
      console.log('Assignment type:', typeof assignment.module_id);
      
      if (!assignment.module_id) {
        console.error('No module_id found in assignment');
        alert('Error: No module ID found for this assignment');
        return;
      }
      
      const { data: module, error: moduleError } = await supabase
        .from('modules')
        .select('storage_path, type')
        .eq('id', assignment.module_id)
        .single();
      
      if (moduleError) {
        console.error('Error fetching module:', moduleError);
        alert(`Error fetching module: ${moduleError.message}`);
        return;
      }
      
      console.log('Module data:', module);
      
      if (module?.storage_path) {
        console.log('Downloading file:', module.storage_path);
        const { data, error: downloadError } = await supabase.storage
          .from('training-materials')
          .download(module.storage_path);
          
        if (downloadError) {
          console.error('Error downloading file:', downloadError);
          alert(`Error downloading file: ${downloadError.message}`);
          return;
        }
        
        if (data) {
          console.log('File downloaded successfully, opening...');
          const url = URL.createObjectURL(data);
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 30000);
        } else {
          console.error('No data received from download');
          alert('No data received from download');
        }
      } else {
        console.error('No storage path found for module');
        alert('No storage path found for this module');
      }
    } catch (error) {
      console.error('Failed to open material:', error);
      alert(`Failed to open material: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={async () => supabase.auth.signOut()} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">My Training</h2>
            <p className="text-muted-foreground">View your assigned training modules and track your progress.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {/* Assigned Card */}
          <Card 
            className={`cursor-pointer shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 border-0 ${
              activeFilter === 'assigned' 
                ? 'bg-gradient-to-r from-blue-100 to-blue-200 ring-2 ring-blue-500' 
                : 'bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200'
            }`}
            onClick={() => setActiveFilter('assigned')}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">Assigned</h2>
                <p className="text-3xl font-bold text-blue-800">{assigned.length}</p>
              </div>
              <div className="bg-blue-200 p-3 rounded-full">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* In Progress Card */}
          <Card 
            className={`cursor-pointer shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 border-0 ${
              activeFilter === 'inprogress' 
                ? 'bg-gradient-to-r from-orange-100 to-orange-200 ring-2 ring-orange-500' 
                : 'bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200'
            }`}
            onClick={() => setActiveFilter('inprogress')}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">In Progress</h2>
                <p className="text-3xl font-bold text-orange-800">{inProgress.length}</p>
              </div>
              <div className="bg-orange-200 p-3 rounded-full">
                <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* Completed Card */}
          <Card 
            className={`cursor-pointer shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 border-0 ${
              activeFilter === 'completed' 
                ? 'bg-gradient-to-r from-green-100 to-green-200 ring-2 ring-green-500' 
                : 'bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200'
            }`}
            onClick={() => setActiveFilter('completed')}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">Completed</h2>
                <p className="text-3xl font-bold text-green-800">{completed.length}</p>
              </div>
              <div className="bg-green-200 p-3 rounded-full">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* All Card */}
          <Card 
            className={`cursor-pointer shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 border-0 ${
              activeFilter === 'all' 
                ? 'bg-gradient-to-r from-gray-100 to-gray-200 ring-2 ring-gray-500' 
                : 'bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200'
            }`}
            onClick={() => setActiveFilter('all')}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">All</h2>
                <p className="text-3xl font-bold text-gray-800">{allAssignments.length}</p>
              </div>
              <div className="bg-gray-200 p-3 rounded-full">
                <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtered Training Modules */}
        <Card>
          <CardHeader>
            <CardTitle>
              {activeFilter === 'all' && 'My Training Modules'}
              {activeFilter === 'assigned' && 'Assigned Training Modules'}
              {activeFilter === 'inprogress' && 'Training Modules In Progress'}
              {activeFilter === 'completed' && 'Completed Training Modules'}
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
              }
              
              if (filteredAssignments.length === 0) {
                return (
                  <div className="text-sm text-muted-foreground">
                    {activeFilter === 'all' && 'No training modules assigned yet.'}
                    {activeFilter === 'assigned' && 'No assigned training modules.'}
                    {activeFilter === 'inprogress' && 'No training modules in progress.'}
                    {activeFilter === 'completed' && 'No completed training modules.'}
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
                        {a.isTrainer && (
                          <div className="text-xs text-muted-foreground">
                            Trainee: {a.trainee?.first_name || 'N/A'} {a.trainee?.last_name || ''} • {a.trainee?.email || 'N/A'} ({a.trainee?.role || 'N/A'})
                          </div>
                        )}
                        {a.isTrainee && (
                          <div className="text-xs text-muted-foreground">
                            Trainer: {a.trainer?.first_name || 'N/A'} {a.trainer?.last_name || ''} • {a.trainer?.email || 'N/A'} ({a.trainer?.role || 'N/A'})
                          </div>
                        )}
                        {hasCompletion && (
                          <div className="text-xs text-muted-foreground">Completed: {a.completion?.completed_at ? new Date(a.completion.completed_at).toLocaleString() : '—'}</div>
                        )}
                        {hasSignoff && (
                          <div className="text-xs text-muted-foreground">Signed Off: {a.signoff?.signed_at ? new Date(a.signoff.signed_at).toLocaleString() : '—'}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={badgeVariant}>{statusLabel}</Badge>
                        <Button variant="outline" onClick={() => openAssignmentMaterial(a)}>Open</Button>
                        {a.isTrainee && !hasCompletion && (
                          <Button onClick={() => { setPendingAssignment(a); setConfirmOpen(true); }}>Mark Complete</Button>
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

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Completion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Congratulations on completing this training! Do you feel confident to move forward and apply what you've learned?
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={async () => {
                  const a = pendingAssignment;
                  setConfirmOpen(false);
                  if (a) await openAssignmentMaterial(a);
                }}>No, Take Me Back</Button>
                <Button onClick={async () => {
                  const a = pendingAssignment;
                  setConfirmOpen(false);
                  if (a) await markComplete(a);
                  setPendingAssignment(null);
                }}>Yes, Mark Complete</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
