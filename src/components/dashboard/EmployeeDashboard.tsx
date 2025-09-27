import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EmployeeDashboardProps {
  userName: string;
}

export function EmployeeDashboard({ userName }: EmployeeDashboardProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingAssignment, setPendingAssignment] = React.useState<any | null>(null);
  const { data: sessionData } = useQuery({
    queryKey: ['session'],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });

  const userId = sessionData?.user?.id;

  const { data: assignments = [], refetch } = useQuery({
    queryKey: ['my-assignments', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          id,status,due_date,
          module:modules(id,title,storage_path,type,version),
          completion:completions(id,completed_at,signature:signatures(signed_name_snapshot,signed_email_snapshot,signed_at)),
          trainer:users!assignments_trainer_user_id_fkey(id,first_name,last_name,email,role)
        `)
        .eq('assigned_to', userId as any)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
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
  const inProgressAssigned = assignments.filter((a: any) => !a?.completion?.id && a.status === 'in_progress').length;
  const progressAssigned = totalAssigned > 0 ? (completedAssigned / totalAssigned) * 100 : 0;

  const openAssignmentMaterial = async (assignment: any) => {
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Assigned Card */}
        <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-blue-50 to-blue-100 border-0">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-600">Assigned</h2>
              <p className="text-3xl font-bold text-blue-800">{totalAssigned}</p>
            </div>
            <div className="bg-blue-200 p-3 rounded-full">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </CardContent>
        </Card>

        {/* In Progress Card */}
        <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-orange-50 to-orange-100 border-0">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-600">In Progress</h2>
              <p className="text-3xl font-bold text-orange-800">{inProgressAssigned}</p>
            </div>
            <div className="bg-orange-200 p-3 rounded-full">
              <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </CardContent>
        </Card>

        {/* Completed Card */}
        <Card className="shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-green-50 to-green-100 border-0">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-600">Completed</h2>
              <p className="text-3xl font-bold text-green-800">{completedAssigned}</p>
            </div>
            <div className="bg-green-200 p-3 rounded-full">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Assigned Modules</CardTitle>
        </CardHeader>
        <CardContent>
          {totalAssigned === 0 ? (
            <div className="text-sm text-muted-foreground">No assignments yet. Check back soon.</div>
          ) : (
            <div className="space-y-3">
              {assignments.map((a: any) => {
                const hasEmployeeCompletion = Boolean(a?.completion?.id) || a.status === 'completed';
                const requiresTrainer = Boolean(a?.trainer?.id);
                const fullyCompleted = hasEmployeeCompletion && (!requiresTrainer || (requiresTrainer && Boolean(a?.completion?.id)));
                const statusLabel = fullyCompleted
                  ? 'Completed'
                  : hasEmployeeCompletion && requiresTrainer
                    ? 'Awaiting Trainer Sign-Off'
                    : a.status === 'in_progress' ? 'In Progress' : 'Not Started';
                const badgeVariant = fullyCompleted ? 'default' : (hasEmployeeCompletion && requiresTrainer) ? 'secondary' : (a.status === 'in_progress' ? 'secondary' : 'outline');
                return (
                  <div key={a.id} className="flex items-center justify-between border rounded-lg p-4">
                    <div>
                      <div className="font-semibold">{a.module?.title}</div>
                      <div className="text-xs text-muted-foreground">v{a.module?.version}</div>
                      {hasEmployeeCompletion && (
                        <div className="text-xs text-muted-foreground mt-1">Completed: {a?.completion?.completed_at ? new Date(a.completion.completed_at).toLocaleString() : '—'}</div>
                      )}
                      {hasEmployeeCompletion && requiresTrainer && (
                        <div className="text-xs text-muted-foreground">Trainer: {a.trainer?.first_name} {a.trainer?.last_name} • {a.trainer?.email}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={badgeVariant}>{statusLabel}</Badge>
                      <Button variant="outline" onClick={() => openAssignmentMaterial(a)}>Open</Button>
                      {!hasEmployeeCompletion && (
                        <Button onClick={() => { setPendingAssignment(a); setConfirmOpen(true); }}>Mark Complete</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
    </div>
  );
}