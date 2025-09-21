import { supabase } from '@/integrations/supabase/client';

export async function debugSupervisorCreation() {
  console.log('=== SUPERVISOR CREATION DEBUG ===');
  
  // 1. Check current user
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Current user:', user?.email, 'Role:', user?.user_metadata?.role || user?.app_metadata?.role);
  
  // 2. Check if function exists
  try {
    const { data, error } = await supabase.functions.invoke('create_supervisor_user', {
      body: { test: true }
    });
    console.log('Function test result:', { data, error });
  } catch (e) {
    console.log('Function test error:', e);
  }
  
  // 3. Check existing supervisors
  const { data: supervisors, error: supervisorError } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'supervisor');
  console.log('Existing supervisors:', supervisors, 'Error:', supervisorError);
  
  // 4. Check auth users with supervisor role
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  const supervisorUsers = users?.filter(u => 
    (u.user_metadata as any)?.role === 'supervisor' || 
    (u.app_metadata as any)?.role === 'supervisor'
  );
  console.log('Auth supervisor users:', supervisorUsers?.map(u => ({ email: u.email, role: (u.user_metadata as any)?.role || (u.app_metadata as any)?.role })));
  
  console.log('=== END DEBUG ===');
}

// Add to window for console access
if (typeof window !== 'undefined') {
  (window as any).debugSupervisor = debugSupervisorCreation;
}
