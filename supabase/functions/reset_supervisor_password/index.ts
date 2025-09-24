import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

interface ResetPasswordPayload {
  email: string;
  new_password: string;
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    const authHeader = req.headers.get('authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');

    const supabase = (await import('npm:@supabase/supabase-js')).createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );

    // Verify caller is admin/manager
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const role = (user.app_metadata as any)?.role || (user.user_metadata as any)?.role;
    if (!['admin','manager'].includes(role)) return new Response('Forbidden', { status: 403, headers: corsHeaders });

    const body = await req.json() as ResetPasswordPayload;

    // Use admin client to update password and role
    const adminClient = (await import('npm:@supabase/supabase-js')).createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // First, find the user by email
    const { data: users, error: findError } = await adminClient.auth.admin.listUsers();
    if (findError) {
      return new Response(JSON.stringify({ error: 'Failed to find users' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const targetUser = users.users.find(u => u.email === body.email);
    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Update user password and ensure supervisor role
    const { data: updateData, error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUser.id,
      {
        password: body.new_password,
        user_metadata: {
          ...targetUser.user_metadata,
          role: 'supervisor'
        },
        app_metadata: {
          ...targetUser.app_metadata,
          role: 'supervisor'
        }
      }
    );

    if (updateError) {
      console.error('Password update failed:', updateError);
      return new Response(JSON.stringify({ error: updateError.message }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Also update the users table role
    await adminClient
      .from('users')
      .update({ role: 'supervisor' })
      .eq('email', body.email);

    // Log the action
    await adminClient
      .from('audit_log')
      .insert({
        user_id: user.id,
        action: 'reset_supervisor_password',
        details: { 
          supervisor_email: body.email,
          updated_by: user.email
        },
        ip_addr: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Password updated for ${body.email}` 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Error in reset_supervisor_password:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json' 
      } 
    });
  }
}

Deno.serve(handler);
