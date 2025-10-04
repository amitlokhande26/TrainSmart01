import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EmployeeDashboardProps {
  userName: string;
}

export function EmployeeDashboard({ userName }: EmployeeDashboardProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingAssignment, setPendingAssignment] = React.useState<any | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'assigned' | 'inprogress' | 'completed'>('all');
  const queryClient = useQueryClient();
  const { data: sessionData } = useQuery({
    queryKey: ['session'],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });

  const userId = sessionData?.user?.id;

  const { data: assignments = [], refetch } = useQuery({
    queryKey: ['my-assignments', userId],
    queryFn: async () => {
      // First get assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
          id,status,due_date,trainer_user_id,
          module:modules(id,title,storage_path,type,version),
          completion:completions(id,completed_at,signature:signatures(signed_name_snapshot,signed_email_snapshot,signed_at))
        `)
        .eq('assigned_to', userId as any)
        .order('assigned_at', { ascending: false });
      
      if (assignmentsError) {
        console.error('EmployeeDashboard assignments query error:', assignmentsError);
        throw assignmentsError;
      }

      // Get unique trainer IDs
      const trainerIds = [...new Set(assignmentsData?.map(a => a.trainer_user_id).filter(Boolean) || [])];
      
      // Fetch trainer data separately
      let trainers: any[] = [];
      if (trainerIds.length > 0) {
        const { data: trainersData, error: trainersError } = await supabase
          .from('users')
          .select('id,first_name,last_name,email,role')
          .in('id', trainerIds);
        
        if (trainersError) {
          console.error('EmployeeDashboard trainers query error:', trainersError);
        } else {
          trainers = trainersData || [];
        }
      }

      // Combine the data
      const result = assignmentsData?.map(assignment => ({
        ...assignment,
        trainer: trainers.find(t => t.id === assignment.trainer_user_id) || null
      })) || [];

      return result;
    },
    enabled: !!userId,
  });

  React.useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`assignments-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
          filter: `assigned_to=eq.${userId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  const totalAssigned = assignments.length;
  const completedAssigned = assignments.filter((a: any) => (a?.completion?.id || a.status === 'completed')).length;
  const inProgressAssigned = assignments.filter((a: any) => a.status === 'in_progress').length;
  const progressAssigned = totalAssigned > 0 ? (completedAssigned / totalAssigned) * 100 : 0;

  // Define categories like in Supervisor/AdminMyTraining
  const assigned = assignments.filter((a: any) => a.status === 'assigned');
  const inProgress = assignments.filter((a: any) => a.status === 'in_progress');
  const completed = assignments.filter((a: any) => (a?.completion?.id || a.status === 'completed'));

  // Filter assignments based on active filter
  let filteredAssignments = assignments;
  if (activeFilter === 'assigned') {
    filteredAssignments = assigned;
  } else if (activeFilter === 'inprogress') {
    filteredAssignments = inProgress;
  } else if (activeFilter === 'completed') {
    filteredAssignments = completed;
  }

  const openAssignmentMaterial = async (assignment: any) => {
    console.log('Opening assignment:', assignment.id, 'Current status:', assignment.status);
    
    // Update assignment status to 'in_progress' if it's currently 'assigned'
    if (assignment.status === 'assigned') {
      console.log('Updating assignment status to in_progress for assignment:', assignment.id);
      const { error: updateError } = await supabase
        .from('assignments')
        .update({ 
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', assignment.id);
      
      if (updateError) {
        console.error('Error updating assignment status:', updateError);
        // Continue with opening the material even if status update fails
      } else {
        console.log('Assignment status updated to in_progress successfully');
        // Invalidate and refetch data to update the UI
        await queryClient.invalidateQueries({ queryKey: ['my-assignments', userId] });
        await refetch();
        console.log('Data refetched after status update');
        console.log('Current assignments after refetch:', assignments);
        console.log('Assignments with in_progress status:', assignments.filter((a: any) => a.status === 'in_progress'));
        console.log('Assignments with assigned status:', assignments.filter((a: any) => a.status === 'assigned'));
      }
    } else {
      console.log('Assignment is not in assigned status, skipping status update');
    }

    const path = assignment?.module?.storage_path as string;
    if (!path) return;
    const { data, error } = await supabase.storage.from('training-materials').createSignedUrl(path, 300);
    if (error) return;
    if (data?.signedUrl) {
      const res = await fetch(data.signedUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  };

  const markComplete = async (assignment: any) => {
    try {
      const signedName = userName;
      const signedEmail = sessionData?.user?.email || '';
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
        console.error('Trainer notification failed:', e);
      }
      await refetch();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-card rounded-lg p-6 shadow-card">
        <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, {userName}!</h1>
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">{completedAssigned}/{totalAssigned} modules completed</span>
          </div>
          <Progress value={progressAssigned} className="h-2" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
              <p className="text-3xl font-bold text-gray-800">{totalAssigned}</p>
            </div>
            <div className="bg-gray-200 p-3 rounded-full">
              <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </CardContent>
        </Card>

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
      </div>

      <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-t-2xl">
          <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            My Assigned Modules
            {filteredAssignments.length > 0 && (
              <span className="ml-2 px-2 py-1 bg-indigo-200 text-indigo-800 rounded-full text-sm font-medium">
                {filteredAssignments.length} modules
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {totalAssigned === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments yet</h3>
              <p className="text-gray-500">Check back soon for new training modules assigned to you.</p>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No modules in this category</h3>
              <p className="text-gray-500">Try selecting a different filter to view your modules.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssignments.map((a: any) => {
                const hasEmployeeCompletion = Boolean(a?.completion?.id) || a.status === 'completed';
                const requiresTrainer = Boolean(a?.trainer?.id);
                const fullyCompleted = hasEmployeeCompletion && (!requiresTrainer || (requiresTrainer && Boolean(a?.completion?.id)));
                
                let statusLabel = 'Not Started';
                let badgeVariant: "default" | "destructive" | "outline" | "secondary" = 'outline';
                
                if (fullyCompleted) {
                  statusLabel = 'Completed';
                  badgeVariant = 'default';
                } else if (hasEmployeeCompletion && requiresTrainer) {
                  statusLabel = 'Awaiting Trainer Sign-Off';
                  badgeVariant = 'secondary';
                } else if (a.status === 'in_progress') {
                  statusLabel = 'In Progress';
                  badgeVariant = 'secondary';
                } else if (a.status === 'assigned') {
                  statusLabel = 'Not Started';
                  badgeVariant = 'outline';
                }
                
                return (
                  <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300 group">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center">
                          <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-lg mb-2 group-hover:text-indigo-600 transition-colors">
                          {a.module?.title || 'Module Title Not Available'}
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                            v{a.module?.version || '1.0'}
                          </span>
                          {a.module?.type && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              a.module.type === 'video' ? 'bg-red-100 text-red-800' :
                              a.module.type === 'ppt' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {a.module.type.toUpperCase()}
                            </span>
                          )}
                        </div>
                        {hasEmployeeCompletion && (
                          <div className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Completed:</span> {a?.completion?.completed_at ? new Date(a.completion.completed_at).toLocaleString() : '—'}
                          </div>
                        )}
                        <div className="text-sm text-gray-800 mb-3">
                          <span className="font-medium">Trainer:</span>{' '}
                          {a.trainer?.id
                            ? <>{a.trainer?.first_name} {a.trainer?.last_name} • {a.trainer?.email}</>
                            : 'Not assigned'}
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={badgeVariant}
                            className={`px-3 py-1 text-sm font-medium ${
                              badgeVariant === 'default' ? 'bg-green-100 text-green-800' :
                              badgeVariant === 'secondary' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {statusLabel}
                          </Badge>
                          <Button 
                            variant="outline" 
                            onClick={async () => {
                              console.log('Open button clicked for assignment:', a.id, 'Status:', a.status);
                              
                              // If status is 'assigned', update it to 'in_progress' when user opens
                              if (a.status === 'assigned') {
                                console.log('Updating assignment status from assigned to in_progress...');
                                try {
                                  const { data, error } = await supabase
                                    .from('assignments')
                                    .update({ status: 'in_progress' })
                                    .eq('id', a.id)
                                    .select();
                                  
                                  console.log('Update result:', { data, error });
                                  
                                  if (error) {
                                    console.error('Error updating assignment status:', error);
                                  } else {
                                    console.log('Assignment status updated to in_progress successfully');
                                    // Refetch data to update the UI
                                    await refetch();
                                    console.log('Data refetched after status update');
                                  }
                                } catch (err) {
                                  console.error('Error updating assignment status:', err);
                                }
                              } else {
                                console.log('Assignment status is not assigned, skipping status update. Current status:', a.status);
                              }
                              
                              openAssignmentMaterial(a);
                            }}
                            className="bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-blue-200 text-blue-700 hover:text-blue-800 transition-all duration-200"
                          >
                            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open
                          </Button>
                          {!hasEmployeeCompletion && a.status === 'in_progress' && (
                            <Button 
                              onClick={() => { setPendingAssignment(a); setConfirmOpen(true); }}
                              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                            >
                              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900">Confirm Completion</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <p className="text-sm text-gray-600 text-center">
              Congratulations on completing this training! Do you feel confident to move forward and apply what you've learned?
            </p>
            <div className="flex gap-3 justify-center">
              <Button 
                variant="outline" 
                onClick={async () => {
                  const a = pendingAssignment;
                  setConfirmOpen(false);
                  if (a) await openAssignmentMaterial(a);
                }}
                className="px-6 py-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                No, Take Me Back
              </Button>
              <Button 
                onClick={async () => {
                  const a = pendingAssignment;
                  setConfirmOpen(false);
                  if (a) await markComplete(a);
                  setPendingAssignment(null);
                }}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Yes, Mark Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}