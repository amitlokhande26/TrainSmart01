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
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'assigned' | 'inprogress' | 'completed' | 'signoffs'>('signoffs');

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
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
            className="hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
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

          {/* Sign Offs Card */}
          <Card 
            className={`cursor-pointer shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 border-0 ${
              activeFilter === 'signoffs' 
                ? 'bg-gradient-to-r from-purple-100 to-purple-200 ring-2 ring-purple-500' 
                : 'bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200'
            }`}
            onClick={() => setActiveFilter('signoffs')}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">Sign Offs</h2>
                <p className="text-3xl font-bold text-purple-800">{toSign.length}</p>
              </div>
              <div className="bg-purple-200 p-3 rounded-full">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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
        <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-white to-gray-50">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-2xl">
            <CardTitle className="text-xl font-bold text-gray-800">
              {activeFilter === 'all' && 'My Assigned Training Modules'}
              {activeFilter === 'assigned' && 'Assigned Training Modules'}
              {activeFilter === 'inprogress' && 'Training Modules In Progress'}
              {activeFilter === 'completed' && 'Completed Training Modules'}
              {activeFilter === 'signoffs' && 'Pending Sign-Offs'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
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
                <div className="space-y-4">
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
                    <div key={a.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300">
                      <div className="flex-1">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-lg mb-2">{a.module?.title || 'Module Title Not Available'}</div>
                            <div className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">Trainee:</span> {a.user?.first_name || 'N/A'} {a.user?.last_name || ''} • {a.user?.email || 'N/A'} 
                              <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                {a.user?.role || 'N/A'}
                              </span>
                            </div>
                            {hasCompletion && (
                              <div className="text-sm text-gray-500 mb-1">
                                <span className="font-medium">Completed:</span> {a.completion?.completed_at ? new Date(a.completion.completed_at).toLocaleString() : '—'}
                              </div>
                            )}
                            {hasSignoff && (
                              <div className="text-sm text-gray-500">
                                <span className="font-medium">Signed Off:</span> {a.signoff?.signed_at ? new Date(a.signoff.signed_at).toLocaleString() : '—'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
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
                        {activeFilter === 'signoffs' && needsSignoff && (
                          <Button 
                            onClick={() => { setPendingCompletion(a); setSignOpen(true); }}
                            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                          >
                            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Manager Sign-Off
                          </Button>
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
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <DialogTitle className="text-xl font-bold text-gray-900">Confirm Manager Sign-Off</DialogTitle>
              <p className="text-sm text-gray-600 mt-2">Please type your full name as your digital signature to acknowledge training completion.</p>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Digital Signature</label>
                <Input 
                  placeholder="Enter your full name" 
                  value={signedName} 
                  onChange={(e) => setSignedName(e.target.value)}
                  className="border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setSignOpen(false)} 
                  disabled={signingOff}
                  className="px-6 py-2"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSignoff} 
                  disabled={!signedName || signingOff}
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium px-6 py-2 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  {signingOff ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing Off...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Sign Off
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
