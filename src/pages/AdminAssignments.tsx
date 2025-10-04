import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Clock, AlertCircle, Users, BookOpen, Calendar, User } from 'lucide-react';

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
  const [editingAssignment, setEditingAssignment] = React.useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [assignmentsSearch, setAssignmentsSearch] = React.useState<string>('');
  const [debouncedAssignmentsSearch, setDebouncedAssignmentsSearch] = React.useState<string>('');

  // Reset trainer when employee changes
  React.useEffect(() => {
    setTrainerId(null);
  }, [employeeId]);

  // Debounce assignments search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAssignmentsSearch(assignmentsSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [assignmentsSearch]);

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

  // Get all available trainers for edit modal
  const { data: allTrainers } = useQuery({
    queryKey: ['all-trainers-for-edit'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, role')
          .in('role', ['supervisor', 'manager', 'admin'])
          .eq('is_active', true)
          .order('first_name');
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching all trainers:', error);
        return [];
      }
    }
  });

  // Get all available modules for edit modal
  const { data: allModules } = useQuery({
    queryKey: ['all-modules-for-edit'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('modules')
          .select(`
            id, title, version, line_id, category_id,
            lines!inner(name),
            categories!inner(name)
          `)
          .eq('is_active', true)
          .order('title');
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching all modules:', error);
        return [];
      }
    }
  });

  // Get all assignments with related data
  const { data: assignments } = useQuery({
    queryKey: ['assignments-with-details'],
    queryFn: async () => {
      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('assignments')
          .select(`
            id,
            status,
            due_date,
            assigned_at,
            assigned_to,
            assigned_by,
            trainer_user_id,
            module_id,
            modules!inner(
              id,
              title,
              version,
              line_id,
              category_id,
              lines!inner(name),
              categories!inner(name)
            )
          `)
          .order('assigned_at', { ascending: false });

        if (assignmentsError) throw assignmentsError;

        // Get user details for assigned_to, assigned_by, and trainer_user_id
        const userIds = new Set();
        assignmentsData?.forEach(assignment => {
          userIds.add(assignment.assigned_to);
          userIds.add(assignment.assigned_by);
          if (assignment.trainer_user_id) userIds.add(assignment.trainer_user_id);
        });

        const { data: usersData } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, role')
          .in('id', Array.from(userIds));

        // Get completion status
        const { data: completionsData } = await supabase
          .from('completions')
          .select('id, assignment_id, completed_at');

        // Get trainer signoffs
        const { data: signoffsData } = await supabase
          .from('trainer_signoffs')
          .select('completion_id, signed_at');

        // Combine all data
        return assignmentsData?.map(assignment => {
          const assignedToUser = usersData?.find(u => u.id === assignment.assigned_to);
          const assignedByUser = usersData?.find(u => u.id === assignment.assigned_by);
          const trainerUser = usersData?.find(u => u.id === assignment.trainer_user_id);
          const completion = completionsData?.find(c => c.assignment_id === assignment.id);
          const signoff = signoffsData?.find(s => s.completion_id === completion?.id);

          // Determine display status based on database status, completion, and signoff
          let displayStatus = assignment.status; // Start with database status
          
          if (completion && signoff) {
            displayStatus = 'approved';
          } else if (completion && !signoff) {
            displayStatus = 'awaiting_signoff';
          } else if (assignment.status === 'in_progress') {
            displayStatus = 'in_progress';
          } else if (assignment.status === 'assigned') {
            displayStatus = 'not_started';
          }

          return {
            ...assignment,
            assigned_to_user: assignedToUser,
            assigned_by_user: assignedByUser,
            trainer_user: trainerUser,
            completion: completion,
            signoff: signoff,
            displayStatus: displayStatus
          };
        }) || [];
      } catch (error) {
        console.error('Error fetching assignments:', error);
        return [];
      }
    }
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

  const handleEditAssignment = (assignment: any) => {
    setEditingAssignment(assignment);
    setIsEditModalOpen(true);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  };

  const updateAssignment = async (assignmentId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update(updates)
        .eq('id', assignmentId);
      
      if (error) throw error;
      
      setMessage('Assignment updated successfully');
      setIsEditModalOpen(false);
      setEditingAssignment(null);
      
      // Restore body scroll
      document.body.style.overflow = 'unset';
      
      // Refresh the assignments data
      window.location.reload(); // Simple refresh for now
    } catch (e: any) {
      setMessage(e?.message || 'Failed to update assignment');
    }
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingAssignment(null);
    // Restore body scroll
    document.body.style.overflow = 'unset';
  };

  // Filter assignments based on search
  const filteredAssignments = React.useMemo(() => {
    if (!assignments || !debouncedAssignmentsSearch) return assignments || [];
    
    const searchLower = debouncedAssignmentsSearch.toLowerCase();
    return assignments.filter((assignment: any) => {
      const employeeName = `${assignment.assigned_to_user?.first_name || ''} ${assignment.assigned_to_user?.last_name || ''}`.toLowerCase();
      const employeeEmail = assignment.assigned_to_user?.email?.toLowerCase() || '';
      const moduleTitle = assignment.modules?.title?.toLowerCase() || '';
      const lineName = assignment.modules?.lines?.name?.toLowerCase() || '';
      const categoryName = assignment.modules?.categories?.name?.toLowerCase() || '';
      const trainerName = `${assignment.trainer_user?.first_name || ''} ${assignment.trainer_user?.last_name || ''}`.toLowerCase();
      const trainerEmail = assignment.trainer_user?.email?.toLowerCase() || '';
      const assignedByName = `${assignment.assigned_by_user?.first_name || ''} ${assignment.assigned_by_user?.last_name || ''}`.toLowerCase();
      const status = assignment.status?.toLowerCase() || '';
      
      return (
        employeeName.includes(searchLower) ||
        employeeEmail.includes(searchLower) ||
        moduleTitle.includes(searchLower) ||
        lineName.includes(searchLower) ||
        categoryName.includes(searchLower) ||
        trainerName.includes(searchLower) ||
        trainerEmail.includes(searchLower) ||
        assignedByName.includes(searchLower) ||
        status.includes(searchLower)
      );
    });
  }, [assignments, debouncedAssignmentsSearch]);

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
              <div className="text-sm font-medium text-gray-700 mb-1">
                Production Line <span className="text-red-500">*</span>
              </div>
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
              <div className="text-sm font-medium text-gray-700 mb-1">
                Module <span className="text-red-500">*</span>
              </div>
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
              <div className="text-sm font-medium text-gray-700 mb-1">
                Trainee <span className="text-red-500">*</span>
              </div>
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
              <div className="text-sm font-medium text-gray-700 mb-1">
                Trainer <span className="text-red-500">*</span>
              </div>
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
              <Button 
                onClick={assignModule} 
                disabled={!moduleId || !employeeId || !trainerId || assigning}
                className={(!moduleId || !employeeId || !trainerId) ? "opacity-50 cursor-not-allowed" : ""}
              >
                {assigning ? 'Assigning...' : 'Assign Module'}
              </Button>
              {message && <span className="text-sm text-gray-600">{message}</span>}
            </div>
          </CardContent>
        </Card>

        {/* Assigned Modules Section */}
        <Card className="shadow-md border-0 rounded-2xl">
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                Assigned Modules
                <Badge variant="secondary" className="ml-2">
                  {filteredAssignments?.length || 0} of {assignments?.length || 0} assignments
                </Badge>
              </CardTitle>
              
              {/* Search Input */}
              <div className="w-full lg:w-80 relative">
                <Input
                  placeholder="Search assignments by employee, module, line, trainer..."
                  value={assignmentsSearch}
                  onChange={(e) => setAssignmentsSearch(e.target.value)}
                  className="w-full pl-4 pr-10"
                />
                {assignmentsSearch !== debouncedAssignmentsSearch && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
                )}
                {assignmentsSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAssignmentsSearch('')}
                    className="absolute right-8 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  >
                    ✕
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {assignments && assignments.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Line & Category</TableHead>
                      <TableHead>Trainer</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((assignment: any) => (
                      <TableRow 
                        key={assignment.id}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleEditAssignment(assignment)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium">
                                {assignment.assigned_to_user?.first_name} {assignment.assigned_to_user?.last_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {assignment.assigned_to_user?.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{assignment.modules?.title}</div>
                            <div className="text-sm text-gray-500">v{assignment.modules?.version}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="outline" className="text-xs">
                              {assignment.modules?.lines?.name}
                            </Badge>
                            <div className="text-xs text-gray-500">
                              {assignment.modules?.categories?.name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {assignment.trainer_user ? (
                            <div>
                              <div className="font-medium">
                                {assignment.trainer_user.first_name} {assignment.trainer_user.last_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {assignment.trainer_user.email}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">No trainer assigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {assignment.due_date ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">
                                {new Date(assignment.due_date).toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">No due date</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {assignment.displayStatus === 'approved' ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approved
                            </Badge>
                          ) : assignment.displayStatus === 'awaiting_signoff' ? (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                              <Clock className="h-3 w-3 mr-1" />
                              Awaiting Sign-Off
                            </Badge>
                          ) : assignment.displayStatus === 'in_progress' ? (
                            <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                              <Clock className="h-3 w-3 mr-1" />
                              In Progress
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800 border-gray-200">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Not Started
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {assignment.assigned_by_user?.first_name} {assignment.assigned_by_user?.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(assignment.assigned_at).toLocaleDateString()}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : filteredAssignments && filteredAssignments.length === 0 && assignments && assignments.length > 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
                <p className="text-gray-500 mb-4">
                  No assignments match your search for "{assignmentsSearch}"
                </p>
                <Button
                  variant="outline"
                  onClick={() => setAssignmentsSearch('')}
                  className="mt-2"
                >
                  Clear Search
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments yet</h3>
                <p className="text-gray-500 mb-4">Create your first training assignment using the form above</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Assignment Modal */}
        {isEditModalOpen && editingAssignment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ position: 'relative' }}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Assignment</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeEditModal}
                  >
                    ✕
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Current Assignment Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Current Assignment</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Employee:</span>
                        <div className="font-medium">
                          {editingAssignment.assigned_to_user?.first_name} {editingAssignment.assigned_to_user?.last_name}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Module:</span>
                        <div className="font-medium">
                          {editingAssignment.modules?.title} (v{editingAssignment.modules?.version})
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Line:</span>
                        <div className="font-medium">{editingAssignment.modules?.lines?.name}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Category:</span>
                        <div className="font-medium">{editingAssignment.modules?.categories?.name}</div>
                      </div>
                    </div>
                  </div>

                  {/* Edit Form */}
                  <EditAssignmentForm
                    assignment={editingAssignment}
                    onUpdate={updateAssignment}
                    onCancel={closeEditModal}
                    trainers={allTrainers || []}
                    modules={allModules || []}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Edit Assignment Form Component
function EditAssignmentForm({ assignment, onUpdate, onCancel, trainers, modules }: any) {
  const [selectedTrainer, setSelectedTrainer] = React.useState(assignment.trainer_user_id || '');
  const [selectedModule, setSelectedModule] = React.useState(assignment.module_id || '');
  const [newDueDate, setNewDueDate] = React.useState(assignment.due_date ? assignment.due_date.split('T')[0] : '');
  const [updating, setUpdating] = React.useState(false);

  // Update state when assignment changes
  React.useEffect(() => {
    setSelectedTrainer(assignment.trainer_user_id || '');
    setSelectedModule(assignment.module_id || '');
    setNewDueDate(assignment.due_date ? assignment.due_date.split('T')[0] : '');
  }, [assignment]);

  const handleUpdate = async () => {
    if (!selectedTrainer) {
      alert('Please select a trainer');
      return;
    }

    // Prevent self-assignment as both trainee and trainer
    if (selectedTrainer === assignment.assigned_to) {
      alert('Error: The trainee cannot be assigned as their own trainer.');
      return;
    }

    setUpdating(true);
    try {
      const updates: any = {
        trainer_user_id: selectedTrainer
      };

      if (selectedModule !== assignment.module_id) {
        updates.module_id = selectedModule;
      }

      if (newDueDate !== assignment.due_date) {
        updates.due_date = newDueDate || null;
      }

      await onUpdate(assignment.id, updates);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Trainer <span className="text-red-500">*</span>
          </label>
          <Select value={selectedTrainer} onValueChange={setSelectedTrainer}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={selectedTrainer ? "Select Trainer" : "No trainer assigned"} />
            </SelectTrigger>
            <SelectContent className="z-[60]" position="popper" sideOffset={4}>
              {trainers && trainers.length > 0 ? (
                trainers.map((trainer: any) => (
                  <SelectItem 
                    key={trainer.id} 
                    value={trainer.id}
                    disabled={trainer.id === assignment.assigned_to}
                  >
                    {trainer.first_name} {trainer.last_name} • {trainer.email} ({trainer.role})
                    {trainer.id === assignment.assigned_to && ' (Cannot train yourself)'}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="loading" disabled>
                  Loading trainers...
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {trainers && trainers.length === 0 && (
            <p className="text-xs text-red-500 mt-1">No trainers available</p>
          )}
          {selectedTrainer === assignment.assigned_to && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ Cannot assign trainee as their own trainer
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Module
          </label>
          <Select value={selectedModule} onValueChange={setSelectedModule}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Module" />
            </SelectTrigger>
            <SelectContent className="z-[60]" position="popper" sideOffset={4}>
              {modules && modules.length > 0 ? (
                modules.map((module: any) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.title} (v{module.version}) - {module.lines?.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="loading" disabled>
                  Loading modules...
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {modules && modules.length === 0 && (
            <p className="text-xs text-red-500 mt-1">No modules available</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Due Date
          </label>
          <Input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t">
        <Button
          onClick={handleUpdate}
          disabled={!selectedTrainer || updating}
          className="flex-1"
        >
          {updating ? 'Updating...' : 'Update Assignment'}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}


