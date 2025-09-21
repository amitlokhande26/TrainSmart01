import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

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
        .select(`
          id,status,due_date,assigned_at,
          module:modules(id,title,version),
          trainer:users!assignments_trainer_user_id_fkey(id,first_name,last_name,email,role),
          completion:completions(
            id,completed_at,
            signature:signatures(signed_name_snapshot,signed_email_snapshot,signed_at),
            trainer_signoff:trainer_signoffs(id,signed_name_snapshot,signed_email_snapshot,signed_at)
          )
        `)
        .eq('assigned_to', id)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    refetchInterval: 10000,
  });

  React.useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`admin-employee-assignments-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assignments', filter: `assigned_to=eq.${id}` },
        () => {
          // Force react-query to refetch by invalidating the query key
          // Using supabase realtime callback to keep UI in sync
          // Note: useQuery doesn't expose invalidate here; simplest is window focus trick or manual reload
          // Easiest: call select again via refetch by dispatching a custom event
          window.dispatchEvent(new Event('focus'));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

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
                {(assignments || []).map((a: any) => {
                  const hasCompletion = Boolean(a?.completion?.id) || a.status === 'completed';
                  const completedAtIso: string | undefined = a?.completion?.completed_at;
                  const completedAt = completedAtIso ? new Date(completedAtIso).toLocaleString() : undefined;
                  const signedName: string | undefined = a?.completion?.signature?.signed_name_snapshot;
                  const signedEmail: string | undefined = a?.completion?.signature?.signed_email_snapshot;
                  const trainerName = a?.trainer ? `${a.trainer.first_name} ${a.trainer.last_name}` : undefined;
                  const hasTrainerSignoff = Boolean(a?.completion?.trainer_signoff?.id);
                  const awaitingTrainer = hasCompletion && Boolean(a?.trainer?.id) && !hasTrainerSignoff;
                  const trainerSignedAt = a?.completion?.trainer_signoff?.signed_at ? new Date(a.completion.trainer_signoff.signed_at).toLocaleString() : undefined;
                  const trainerSignedName = a?.completion?.trainer_signoff?.signed_name_snapshot;
                  const trainerSignedEmail = a?.completion?.trainer_signoff?.signed_email_snapshot;
                  return (
                    <div key={a.id} className="flex items-center justify-between border rounded-lg p-4">
                      <div>
                        <div className="font-semibold">{a.module?.title}</div>
                        <div className="text-xs text-muted-foreground">v{a.module?.version}</div>
                        {hasCompletion && (
                          <div className="text-xs text-muted-foreground mt-1">Completed: {completedAt || '—'}</div>
                        )}
                        {awaitingTrainer && (
                          <div className="text-xs text-muted-foreground">Awaiting Trainer Sign-Off: {trainerName} • {a.trainer?.email}</div>
                        )}
                        {hasCompletion && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <BadgeCheck className="h-3 w-3 text-success" />
                                </TooltipTrigger>
                                <TooltipContent>Employee signature on completion</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <span>Signed: {signedName || '—'} • {signedEmail || '—'}</span>
                          </div>
                        )}
                        {hasTrainerSignoff && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <BadgeCheck className="h-3 w-3 text-blue-500" />
                                </TooltipTrigger>
                                <TooltipContent>Trainer sign-off on completion</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <span>Trainer Signed: {trainerSignedName || '—'} • {trainerSignedEmail || '—'} ({trainerSignedAt || '—'})</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <Badge variant={hasCompletion && !awaitingTrainer ? 'default' : (hasCompletion && awaitingTrainer) ? 'secondary' : a.status === 'in_progress' ? 'secondary' : 'outline'}>
                          {hasCompletion ? (awaitingTrainer ? 'Awaiting Trainer Sign-Off' : 'Completed') : a.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


