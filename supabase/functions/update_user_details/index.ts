import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

interface UpdateUserPayload {
  user_id: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
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

    const body = await req.json() as UpdateUserPayload;
    
    if (!body.user_id) {
      return new Response('User ID is required', { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    // Prepare update object with only provided fields
    const updateData: any = {};
    if (body.first_name !== undefined) updateData.first_name = body.first_name;
    if (body.last_name !== undefined) updateData.last_name = body.last_name;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    if (Object.keys(updateData).length === 0) {
      return new Response('No fields to update', { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    // Update user in database
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', body.user_id)
      .select()
      .single();

    if (error) {
      return new Response(error.message, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    // Log the update
    await supabase
      .from('audit_log')
      .insert({
        user_id: user.id,
        action: 'update_user_details',
        details: { 
          updated_user_id: body.user_id,
          updated_fields: updateData,
          updated_by: user.email
        },
        ip_addr: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });

    return new Response(JSON.stringify({ 
      success: true, 
      user: data 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Error in update_user_details:', error);
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
