import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

interface CreateSupervisorPayload {
  first_name: string;
  last_name: string;
  email: string;
  default_password?: string; // if omitted, use SuperTrain1*
  initial_module_ids?: string[];
}

const DEFAULT_SUPERVISOR_PASSWORD = 'SuperTrain1*';

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

    const body = await req.json() as CreateSupervisorPayload;
    const pwd = body.default_password || DEFAULT_SUPERVISOR_PASSWORD;

    // Create auth user with supervisor password - simplified approach
    const adminClient = (await import('npm:@supabase/supabase-js')).createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Creating supervisor user:', body.email);

    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: pwd,
      email_confirm: true,
      user_metadata: {
        full_name: `${body.first_name} ${body.last_name}`,
        first_name: body.first_name,
        last_name: body.last_name,
        role: 'supervisor'
      },
      app_metadata: {
        role: 'supervisor'
      }
    });

    if (authError) {
      console.error('Auth user creation failed:', authError);
      return new Response(JSON.stringify({ error: authError.message }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Auth user created, ID:', authUser.user.id);

    // Create profile in users table
    const { error: profileError } = await adminClient
      .from('users')
      .insert({
        id: authUser.user.id,
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email,
        role: 'supervisor'
      });

    if (profileError) {
      console.error('Profile creation failed:', profileError);
      // Try to clean up auth user if profile creation fails
      try {
        await adminClient.auth.admin.deleteUser(authUser.user.id);
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
      return new Response(JSON.stringify({ error: profileError.message }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Profile created successfully');

    // Log the creation
    await adminClient
      .from('audit_log')
      .insert({
        user_id: user.id,
        action: 'create_supervisor',
        details: { 
          supervisor_email: body.email,
          supervisor_name: `${body.first_name} ${body.last_name}`,
          created_by: user.email
        },
        ip_addr: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });

    console.log('Audit log created');

    return new Response(JSON.stringify({ 
      success: true, 
      user: { 
        id: authUser.user.id, 
        email: body.email,
        password: pwd
      } 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Error in create_supervisor_user:', error);
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