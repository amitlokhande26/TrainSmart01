import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

interface CreateEmployeePayload {
  first_name: string;
  last_name: string;
  email: string;
  default_password?: string; // if omitted, use EmployeeTrain1*
  initial_module_ids?: string[];
}

const DEFAULT_PASSWORD = 'EmployeeTrain1*';

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
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
    if (userErr || !user) return new Response('Unauthorized', { status: 401 });
    const role = (user.app_metadata as any)?.role || (user.user_metadata as any)?.role;
    if (!['admin','manager'].includes(role)) return new Response('Forbidden', { status: 403 });

    const body = await req.json() as CreateEmployeePayload;
    const pwd = body.default_password || DEFAULT_PASSWORD;

    // Create auth user with default password
    const adminClient = (await import('npm:@supabase/supabase-js')).createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: pwd,
      email_confirm: true,
      app_metadata: { role: 'employee' },
      user_metadata: { first_name: body.first_name, last_name: body.last_name }
    });
    if (createErr) return new Response(createErr.message, { status: 400 });

    const newUserId = created.user?.id as string;

    // Insert sidecar profile
    const { error: profileErr } = await adminClient
      .from('users')
      .insert({ id: newUserId, first_name: body.first_name, last_name: body.last_name, email: body.email, role: 'employee' });
    if (profileErr) return new Response(profileErr.message, { status: 400 });

    // Optional initial assignments
    if (body.initial_module_ids && body.initial_module_ids.length > 0) {
      const assigns = body.initial_module_ids.map((mid) => ({ module_id: mid, assigned_to: newUserId, assigned_by: user.id }));
      const { error: assignErr } = await adminClient.from('assignments').insert(assigns);
      if (assignErr) return new Response(assignErr.message, { status: 400 });
    }

    return new Response(JSON.stringify({ user_id: newUserId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(`Error: ${e}`, { status: 500 });
  }
}

Deno.serve(handler);





