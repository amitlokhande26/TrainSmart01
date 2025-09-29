import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [name, setName] = React.useState<string>('Admin');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  
  // Supervisor creation state
  const [supervisorFirstName, setSupervisorFirstName] = React.useState('');
  const [supervisorLastName, setSupervisorLastName] = React.useState('');
  const [supervisorEmail, setSupervisorEmail] = React.useState('');
  const [creatingSupervisor, setCreatingSupervisor] = React.useState(false);
  const [supervisorMessage, setSupervisorMessage] = React.useState<string | null>(null);

  // Search functionality
  const [searchTerm, setSearchTerm] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<'all' | 'employee' | 'supervisor' | 'manager'>('all');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('all');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [isUsersListExpanded, setIsUsersListExpanded] = React.useState(false);

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

  // Auto-expand users list when navigating from dashboard
  React.useEffect(() => {
    if (window.location.hash === '#users-list') {
      setIsUsersListExpanded(true);
    }
  }, []);

  // Debounced search effect
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 800);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Combined users query with search and filtering
  const { data: allUsers, refetch: refetchAllUsers } = useQuery({
    queryKey: ['all-users', debouncedSearch, roleFilter, statusFilter],
    queryFn: async () => {
      let query = supabase.from('users').select('id,first_name,last_name,email,role,is_active,created_at');
      
      // Apply role filter
      if (roleFilter !== 'all') {
        if (roleFilter === 'manager') {
          query = query.in('role', ['manager', 'admin']);
        } else {
          query = query.eq('role', roleFilter);
        }
      }
      
      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('is_active', statusFilter === 'active');
      }
      
      // Apply search filter
      if (debouncedSearch) {
        query = query.or(`first_name.ilike.%${debouncedSearch}%,last_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`);
      }
      
      const { data } = await query.order('first_name');
      return data || [];
    }
  });

  // Keep original queries for backward compatibility
  const { data: employees, refetch } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => (await supabase.from('users').select('*').eq('role','employee').order('first_name')).data || []
  });

  const { data: supervisors, refetch: refetchSupervisors } = useQuery({
    queryKey: ['supervisors-list'],
    queryFn: async () => (await supabase.from('users').select('*').eq('role','supervisor').order('first_name')).data || []
  });


  const createEmployee = async () => {
    if (!firstName || !lastName || !email) return;
    setCreating(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('create_employee_user', {
        body: { first_name: firstName, last_name: lastName, email, default_password: 'EmployeeTrain1*', initial_module_ids: [] }
      });
      if (error) throw error;
      setMessage(`Created employee ${email} with password: EmployeeTrain1*`);
      setFirstName(''); setLastName(''); setEmail('');
      await refetch();
    } catch (e: any) {
      setMessage(e?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const createSupervisor = async () => {
    if (!supervisorFirstName || !supervisorLastName || !supervisorEmail) return;
    setCreatingSupervisor(true);
    setSupervisorMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('create_supervisor_user', {
        body: { first_name: supervisorFirstName, last_name: supervisorLastName, email: supervisorEmail, default_password: 'SuperTrain1*' }
      });
      if (error) throw error;
      setSupervisorMessage(`Created supervisor ${supervisorEmail} with password: SuperTrain1*`);
      setSupervisorFirstName(''); setSupervisorLastName(''); setSupervisorEmail('');
      await refetchSupervisors();
    } catch (e: any) {
      setSupervisorMessage(e?.message || 'Failed to create supervisor');
    } finally {
      setCreatingSupervisor(false);
    }
  };

  const resetSupervisorPassword = async (email: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('reset_supervisor_password', {
        body: { email, new_password: 'SuperTrain1*' }
      });
      if (error) throw error;
      alert(`Password reset for ${email}. New password: SuperTrain1*`);
      await refetchSupervisors();
    } catch (e: any) {
      alert(`Failed to reset password: ${e?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">User Management</h2>
          <p className="text-muted-foreground">Create employee and supervisor accounts with default passwords.</p>
        </div>

        {/* Create User Cards - Side by Side */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-orange-200 bg-orange-50/30">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <span className="text-xl">👤</span>
                Create Employee
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <Input 
                  placeholder="First name" 
                  value={firstName} 
                  onChange={(e) => setFirstName(e.target.value)}
                  className="border-orange-200 focus:border-orange-400"
                />
                <Input 
                  placeholder="Last name" 
                  value={lastName} 
                  onChange={(e) => setLastName(e.target.value)}
                  className="border-orange-200 focus:border-orange-400"
                />
                <Input 
                  type="email" 
                  placeholder="email@company.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-orange-200 focus:border-orange-400"
                />
              </div>
              <Button 
                onClick={createEmployee} 
                disabled={creating || !firstName || !lastName || !email}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {creating ? 'Creating...' : 'Create Employee'}
              </Button>
              {message && (
                <div className={`text-sm p-3 rounded-md ${
                  message.includes('Created') 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {message}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-green-900">
                <span className="text-xl">🛡️</span>
                Create Supervisor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <Input 
                  placeholder="First name" 
                  value={supervisorFirstName} 
                  onChange={(e) => setSupervisorFirstName(e.target.value)}
                  className="border-green-200 focus:border-green-400"
                />
                <Input 
                  placeholder="Last name" 
                  value={supervisorLastName} 
                  onChange={(e) => setSupervisorLastName(e.target.value)}
                  className="border-green-200 focus:border-green-400"
                />
                <Input 
                  type="email" 
                  placeholder="supervisor@company.com" 
                  value={supervisorEmail} 
                  onChange={(e) => setSupervisorEmail(e.target.value)}
                  className="border-green-200 focus:border-green-400"
                />
              </div>
              <Button 
                onClick={createSupervisor} 
                disabled={creatingSupervisor || !supervisorFirstName || !supervisorLastName || !supervisorEmail}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {creatingSupervisor ? 'Creating...' : 'Create Supervisor'}
              </Button>
              {supervisorMessage && (
                <div className={`text-sm p-3 rounded-md ${
                  supervisorMessage.includes('Created') 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {supervisorMessage}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Section */}
        <Card className="border-gray-200 bg-gray-50/30">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <span className="text-xl">🔍</span>
              Search Users
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Input 
              placeholder="Search by name or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border-gray-200 focus:border-gray-400"
            />
            <Select value={roleFilter} onValueChange={(value: 'all' | 'employee' | 'supervisor' | 'manager') => setRoleFilter(value)}>
              <SelectTrigger className="border-gray-200 focus:border-gray-400">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="employee">Employees Only</SelectItem>
                <SelectItem value="supervisor">Supervisors Only</SelectItem>
                <SelectItem value="manager">Managers Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
              <SelectTrigger className="border-gray-200 focus:border-gray-400">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Search Results */}
        <Card id="users-list" className="border-gray-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <span className="text-xl">👥</span>
                Users
                {allUsers && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    ({allUsers.length} found{debouncedSearch && ` for "${debouncedSearch}"`})
                  </span>
                )}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUsersListExpanded(!isUsersListExpanded)}
                className="flex items-center gap-2"
              >
                {isUsersListExpanded ? (
                  <>
                    <span>−</span>
                    Collapse
                  </>
                ) : (
                  <>
                    <span>+</span>
                    Expand
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {isUsersListExpanded && (
            <CardContent className="space-y-3">
              {allUsers?.map((u: any) => (
                <div key={u.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div 
                    className="flex-1 cursor-pointer" 
                    onClick={() => u.role === 'employee' ? navigate(`/admin/users/${u.id}`) : null}
                  >
                    <div className="font-semibold text-gray-900">{u.first_name} {u.last_name}</div>
                    <div className="text-sm text-gray-600">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end gap-1">
                      <div className={`text-xs font-medium px-3 py-1 rounded-full ${
                        u.role === 'supervisor' 
                          ? 'bg-green-100 text-green-800 border border-green-200' 
                          : u.role === 'manager' || u.role === 'admin'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-orange-100 text-orange-800 border border-orange-200'
                      }`}>
                        {u.role === 'supervisor' 
                          ? '🛡️ Supervisor' 
                          : u.role === 'manager' || u.role === 'admin'
                          ? '👑 Manager'
                          : '👤 Employee'}
                      </div>
                      <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        u.is_active 
                          ? 'bg-green-100 text-green-700 border border-green-200' 
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {u.is_active ? '✓ Active' : '✗ Inactive'}
                      </div>
                    </div>
                    {u.role === 'supervisor' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => resetSupervisorPassword(u.email)}
                        className="text-xs border-gray-300 hover:bg-gray-50"
                      >
                        Reset Password
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(!allUsers || allUsers.length === 0) && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🔍</div>
                  <div className="text-gray-600 font-medium">
                    {debouncedSearch ? `No users found for "${debouncedSearch}"` : 'No users created yet.'}
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    {debouncedSearch ? 'Try adjusting your search terms' : 'Create your first employee or supervisor above'}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
}


