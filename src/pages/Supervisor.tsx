import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

export default function Supervisor() {
  const { user, signOut, loading } = useAuth();
  const name = user?.name || 'Supervisor';

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });
  const userId = session?.user?.id;

  const { data: allAssignments = [], refetch } = useQuery({
    queryKey: ['supervisor-assignments', userId],
    queryFn: async () => {
      if (!userId) return [] as any[];
      
      // Get all assignments where supervisor is either the trainer OR the trainee
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
        
        // Determine if this supervisor is the trainer or trainee
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

  // Separate trainer vs trainee assignments
  const trainerAssignments = allAssignments.filter(a => a.isTrainer);
  const traineeAssignments = allAssignments.filter(a => a.isTrainee);
  
  // Categorize trainee assignments (My Trainings)
  const myAssigned = traineeAssignments.filter(a => a.status === 'assigned');
  const myInProgress = traineeAssignments.filter(a => a.status === 'in_progress' && !a.completion?.id);
  const myCompleted = traineeAssignments.filter(a => a.completion?.id && !a.signoff?.id);
  const myApproved = traineeAssignments.filter(a => a.completion?.id && a.signoff?.id);
  
  // Categorize trainer assignments (Trainer Sign-offs)
  const pendingSignoffs = trainerAssignments.filter(a => a.completion?.id && !a.signoff?.id);
  const approvedSignoffs = trainerAssignments.filter(a => a.completion?.id && a.signoff?.id);
  const allTrainerAssignments = trainerAssignments;
  

  React.useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`trainer-dashboard-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trainer_signoffs' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, refetch]);

  const [signingOff, setSigningOff] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingAssignment, setPendingAssignment] = React.useState<any | null>(null);
  
  // Tab and filter state
  const [activeTab, setActiveTab] = React.useState<'mytrainings' | 'trainersignoffs'>('mytrainings');
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'assigned' | 'inprogress' | 'completed' | 'pending' | 'approved' | 'allassigned'>('assigned');
  
  // Sign-off dialog state
  const [signOpen, setSignOpen] = React.useState(false);
  const [pendingCompletion, setPendingCompletion] = React.useState<any | null>(null);
  const [signedName, setSignedName] = React.useState('');
  
  // Help toggle state
  const [showHelp, setShowHelp] = React.useState(false);

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

      // Update assignment status to 'in_progress' if it's currently 'assigned'
      if (assignment.status === 'assigned') {
        console.log('Updating assignment status to in_progress');
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
          console.log('Assignment status updated to in_progress');
          // Refetch data to update the UI
          await refetch();
        }
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

  return (
    <div className="min-h-screen bg-background">
      <Header userType="supervisor" userName={name} onLogout={signOut} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Supervisor Panel</h2>
            <p className="text-muted-foreground">Manage your training progress and trainer responsibilities.</p>
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

        {/* Tab Navigation */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
              <Button
                variant={activeTab === 'mytrainings' ? 'default' : 'ghost'}
                onClick={() => {
                  setActiveTab('mytrainings');
                  setActiveFilter('assigned');
                }}
                className="flex items-center gap-2"
              >
                🔰 My Trainings
              </Button>
              <Button
                variant={activeTab === 'trainersignoffs' ? 'default' : 'ghost'}
                onClick={() => {
                  setActiveTab('trainersignoffs');
                  setActiveFilter('allassigned');
                }}
                className="flex items-center gap-2"
              >
                ✍️ Trainer Sign-offs
              </Button>
            </div>
            
            {/* Help Toggle Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-2 transition-all duration-200"
            >
              💡 Need clarity? Let's make this easier!
              <span className={`transform transition-transform duration-200 ${showHelp ? 'rotate-180' : 'rotate-0'}`}>
                ▼
              </span>
            </Button>
          </div>
          
          {/* Collapsible Tab Information */}
          <div 
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              showHelp ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            {activeTab === 'mytrainings' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">📚 My Trainings - Your Learning Journey</h3>
                <p className="text-sm text-blue-800 mb-2">
                  This section shows training modules assigned to you as a trainee. Track your progress through different stages:
                </p>
                <ul className="text-xs text-blue-700 space-y-1 ml-4">
                  <li>• <strong>Assigned:</strong> New training modules ready to start</li>
                  <li>• <strong>In Progress:</strong> Training modules you've started but not yet completed</li>
                  <li>• <strong>Completed:</strong> Training finished - waiting for trainer approval</li>
                  <li>• <strong>Approved:</strong> Training completed and approved by your trainer</li>
                </ul>
              </div>
            )}
            
            {activeTab === 'trainersignoffs' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-2">👨‍🏫 Trainer Sign-offs - Your Supervisory Role</h3>
                <p className="text-sm text-purple-800 mb-2">
                  This section shows training modules where you are the trainer responsible for supervising and approving trainee completions:
                </p>
                <ul className="text-xs text-purple-700 space-y-1 ml-4">
                  <li>• <strong>Pending Sign-offs:</strong> Trainees have completed training - awaiting your approval</li>
                  <li>• <strong>Approved:</strong> Training completions you have already signed off on</li>
                  <li>• <strong>All Assigned:</strong> Complete overview of all training modules you're supervising</li>
                </ul>
              </div>
            )}
          </div>
        </div>


        {/* Dynamic Status Cards based on active tab */}
        {activeTab === 'mytrainings' ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            {/* My Assigned Card */}
            <Card 
              className={`cursor-pointer shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 border-0 ${
                activeFilter === 'assigned' 
                  ? 'bg-gradient-to-r from-slate-100 to-slate-200 ring-2 ring-slate-500' 
                  : 'bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200'
              }`}
              onClick={() => setActiveFilter('assigned')}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">Assigned</h2>
                  <p className="text-3xl font-bold text-slate-800">{myAssigned.length}</p>
                </div>
                <div className="bg-slate-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </CardContent>
            </Card>

            {/* My In Progress Card */}
            <Card 
              className={`cursor-pointer shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 border-0 ${
                activeFilter === 'inprogress' 
                  ? 'bg-gradient-to-r from-amber-100 to-amber-200 ring-2 ring-amber-500' 
                  : 'bg-gradient-to-r from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200'
              }`}
              onClick={() => setActiveFilter('inprogress')}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">In Progress</h2>
                  <p className="text-3xl font-bold text-amber-800">{myInProgress.length}</p>
                </div>
                <div className="bg-amber-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </CardContent>
            </Card>

            {/* My Completed Card */}
            <Card 
              className={`cursor-pointer shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 border-0 ${
                activeFilter === 'completed' 
                  ? 'bg-gradient-to-r from-purple-100 to-purple-200 ring-2 ring-purple-500' 
                  : 'bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200'
              }`}
              onClick={() => setActiveFilter('completed')}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">
                    Completed:
                    Awaiting Sign Off
                  </h2>
                  <p className="text-3xl font-bold text-purple-800">{myCompleted.length}</p>
                </div>
                <div className="bg-purple-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </CardContent>
            </Card>

            {/* My Approved Card */}
            <Card 
              className={`cursor-pointer shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 border-0 ${
                activeFilter === 'approved' 
                  ? 'bg-gradient-to-r from-green-100 to-green-200 ring-2 ring-green-500' 
                  : 'bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200'
              }`}
              onClick={() => setActiveFilter('approved')}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">Approved</h2>
                  <p className="text-3xl font-bold text-green-800">{myApproved.length}</p>
                </div>
                <div className="bg-green-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            {/* Pending Sign-offs Card */}
            <Card 
              className={`cursor-pointer shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 border-0 ${
                activeFilter === 'pending' 
                  ? 'bg-gradient-to-r from-red-100 to-red-200 ring-2 ring-red-500' 
                  : 'bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200'
              }`}
              onClick={() => setActiveFilter('pending')}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">Pending Sign-offs</h2>
                  <p className="text-3xl font-bold text-red-800">{pendingSignoffs.length}</p>
                </div>
                <div className="bg-red-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </CardContent>
            </Card>

            {/* Approved Card */}
            <Card 
              className={`cursor-pointer shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 border-0 ${
                activeFilter === 'approved' 
                  ? 'bg-gradient-to-r from-green-100 to-green-200 ring-2 ring-green-500' 
                  : 'bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200'
              }`}
              onClick={() => setActiveFilter('approved')}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">Approved</h2>
                  <p className="text-3xl font-bold text-green-800">{approvedSignoffs.length}</p>
                </div>
                <div className="bg-green-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </CardContent>
            </Card>

            {/* All Assigned Card */}
            <Card 
              className={`cursor-pointer shadow-md rounded-2xl hover:shadow-lg transition-all duration-300 border-0 ${
                activeFilter === 'allassigned' 
                  ? 'bg-gradient-to-r from-purple-100 to-purple-200 ring-2 ring-purple-500' 
                  : 'bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200'
              }`}
              onClick={() => setActiveFilter('allassigned')}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">All Assigned</h2>
                  <p className="text-3xl font-bold text-purple-800">{allTrainerAssignments.length}</p>
                </div>
                <div className="bg-purple-200 p-3 rounded-full">
                  <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtered Training Modules */}
        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === 'mytrainings' && (
                <>
                  {activeFilter === 'assigned' && '📋 Assigned Training Modules'}
                  {activeFilter === 'inprogress' && '⏳ Training Modules In Progress'}
                  {activeFilter === 'completed' && (
                    <>
                      ✅ Completed
                      – Awaiting Sign-Off
                    </>
                  )}
                  {activeFilter === 'approved' && '✅ Approved Training Modules'}
                </>
              )}
              {activeTab === 'trainersignoffs' && (
                <>
                  {activeFilter === 'pending' && '⚠️ Pending Sign-Offs'}
                  {activeFilter === 'approved' && '✅ Approved Sign-Offs'}
                  {activeFilter === 'allassigned' && '📝 All Assigned Training Modules'}
                </>
              )}
            </CardTitle>
            <div className="text-sm text-muted-foreground mt-2">
              {activeTab === 'mytrainings' && (
                <>
                  {activeFilter === 'assigned' && 'Click "Open" to start your training. The status will automatically update to "In Progress".'}
                  {activeFilter === 'inprogress' && 'Continue your training by clicking "Open". When finished, click "Mark Complete" to submit for approval.'}
                  {activeFilter === 'completed' && 'Your training is complete and waiting for your trainer to approve it. You\'ll be notified once approved.'}
                  {activeFilter === 'approved' && 'Congratulations! These training modules have been completed and approved by your trainer.'}
                </>
              )}
              {activeTab === 'trainersignoffs' && (
                <>
                  {activeFilter === 'pending' && 'Trainees have completed their training and are waiting for your approval. Click "Trainer Sign-Off" to review and approve.'}
                  {activeFilter === 'approved' && 'These are training completions you have already reviewed and approved.'}
                  {activeFilter === 'allassigned' && 'Complete overview of all training modules you\'re supervising. Includes all statuses: not started, in progress, completed, and approved.'}
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              let filteredAssignments = [];
              
              if (activeTab === 'mytrainings') {
                // My Trainings tab - show trainee assignments
                if (activeFilter === 'assigned') {
                  filteredAssignments = myAssigned;
                } else if (activeFilter === 'inprogress') {
                  filteredAssignments = myInProgress;
                } else if (activeFilter === 'completed') {
                  filteredAssignments = myCompleted;
                } else if (activeFilter === 'approved') {
                  filteredAssignments = myApproved;
                }
              } else {
                // Trainer Sign-offs tab - show trainer assignments
                if (activeFilter === 'pending') {
                  filteredAssignments = pendingSignoffs;
                } else if (activeFilter === 'approved') {
                  filteredAssignments = approvedSignoffs;
                } else if (activeFilter === 'allassigned') {
                  filteredAssignments = allTrainerAssignments;
                }
              }
              
              if (filteredAssignments.length === 0) {
                return (
                  <div className="text-sm text-muted-foreground">
                    {activeTab === 'mytrainings' && (
                      <>
                        {activeFilter === 'assigned' && 'No assigned training modules.'}
                        {activeFilter === 'inprogress' && 'No training modules in progress.'}
                        {activeFilter === 'completed' && 'No completed training modules awaiting sign-off.'}
                        {activeFilter === 'approved' && 'No approved training modules yet.'}
                      </>
                    )}
                    {activeTab === 'trainersignoffs' && (
                      <>
                        {activeFilter === 'pending' && 'No pending sign-offs waiting for your review.'}
                        {activeFilter === 'approved' && 'No approved sign-offs yet.'}
                        {activeFilter === 'allassigned' && 'No training modules assigned to you as trainer.'}
                      </>
                    )}
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
                  
                  let statusLabel = 'Not Started';
                  let badgeVariant: "default" | "destructive" | "outline" | "secondary" = 'outline';
                  
                  if (isCompleted) {
                    statusLabel = 'Completed';
                    badgeVariant = 'default';
                  } else if (needsSignoff) {
                    statusLabel = 'Awaiting Sign-Off';
                    badgeVariant = 'secondary';
                  } else if (a.status === 'in_progress') {
                    statusLabel = 'In Progress';
                    badgeVariant = 'secondary';
                  } else if (a.status === 'assigned') {
                    statusLabel = 'Not Started';
                    badgeVariant = 'outline';
                  }
                  
                  return (
                    <div key={a.id} className="flex items-center justify-between border rounded-lg p-4">
                      <div>
                        <div className="font-semibold">{a.module?.title || 'Module Title Not Available'}</div>
                        {activeTab === 'trainersignoffs' && a.isTrainer && (
                          <div className="text-xs text-muted-foreground">
                            👤 Trainee: {a.trainee?.first_name || 'N/A'} {a.trainee?.last_name || ''} • {a.trainee?.email || 'N/A'} ({a.trainee?.role || 'N/A'})
                          </div>
                        )}
                        {activeTab === 'mytrainings' && a.isTrainee && (
                          <div className="text-xs text-muted-foreground">
                            👨‍🏫 Trainer: {a.trainer?.first_name || 'N/A'} {a.trainer?.last_name || ''} • {a.trainer?.email || 'N/A'} ({a.trainer?.role || 'N/A'})
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
                        {activeTab === 'mytrainings' && a.isTrainee && !hasCompletion && a.status === 'in_progress' && (
                          <Button onClick={() => { setPendingAssignment(a); setConfirmOpen(true); }}>Mark Complete</Button>
                        )}
                        {activeTab === 'trainersignoffs' && a.isTrainer && needsSignoff && (
                          <Button onClick={() => { setPendingCompletion(a); setSignOpen(true); }}>Trainer Sign-Off</Button>
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

        <Dialog open={signOpen} onOpenChange={setSignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Trainer Sign-Off</DialogTitle>
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
      </main>
    </div>
  );
}


