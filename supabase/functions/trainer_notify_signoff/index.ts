import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

export default async function handler(req: Request): Promise<Response> {
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }
    const { createClient } = await import('npm:@supabase/supabase-js');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload = await req.json().catch(() => ({}));
    let completionId: string | undefined = payload?.completion_id;
    const assignmentId: string | undefined = payload?.assignment_id;
    if (!completionId && !assignmentId) return new Response('Missing completion_id or assignment_id', { status: 400, headers: corsHeaders });

    let data: any | null = null;
    if (completionId) {
      const res = await supabase
        .from('completions')
        .select(`
          id, completed_at,
          assignment:assignments(id, trainer_user_id, module:modules(title,version), user:users(first_name,last_name,email))
        `)
        .eq('id', completionId)
        .single();
      if (res.error) return new Response('Not found', { status: 404, headers: corsHeaders });
      data = res.data;
    } else if (assignmentId) {
      // Fallback: fetch latest completion for the assignment
      const res = await supabase
        .from('completions')
        .select(`
          id, completed_at,
          assignment:assignments(id, trainer_user_id, module:modules(title,version), user:users(first_name,last_name,email))
        `)
        .eq('assignment_id', assignmentId)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (res.error || !res.data) return new Response('Not found', { status: 404, headers: corsHeaders });
      data = res.data;
      completionId = data.id;
    }

    const trainerUserId = (data as any)?.assignment?.trainer_user_id as string | undefined;
    if (!trainerUserId) {
      await supabase.from('audit_log').insert({
        actor_user_id: null,
        action: 'email_trainer_signoff_skipped',
        entity: 'completion',
        entity_id: (data as any).id,
        payload: { reason: 'no_trainer_set' },
      });
      return new Response('No trainer set', { status: 200, headers: corsHeaders });
    }

    const { data: trainerRow } = await supabase
      .from('users')
      .select('first_name,last_name,email')
      .eq('id', trainerUserId)
      .single();
    const trainerEmail = trainerRow?.email as string | undefined;
    const trainerName = trainerRow ? `${trainerRow.first_name || ''} ${trainerRow.last_name || ''}`.trim() : undefined;
    if (!trainerEmail) {
      await supabase.from('audit_log').insert({
        actor_user_id: null,
        action: 'email_trainer_signoff_skipped',
        entity: 'completion',
        entity_id: (data as any).id,
        payload: { reason: 'trainer_email_missing', trainer_user_id: trainerUserId },
      });
      return new Response('No trainer email', { status: 200, headers: corsHeaders });
    }

    // For demo, log an audit entry. Replace with real email integration.
    const subject = 'Trainer Sign-Off Required';
    const body = `Please sign off training for ${data.assignment?.user?.first_name} ${data.assignment?.user?.last_name} on ${data.assignment?.module?.title}.`;

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('NOTIFY_FROM_EMAIL') || 'no-reply@example.com';

    if (resendKey) {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: trainerEmail,
            subject,
            text: body,
          }),
        });
        const ok = resp.ok;
        await supabase.from('audit_log').insert({
          actor_user_id: null,
          action: ok ? 'email_trainer_signoff_sent' : 'email_trainer_signoff_failed',
          entity: 'completion',
          entity_id: (data as any).id,
          payload: { to: trainerEmail, subject, ok, status: resp.status },
        });
      } catch (e) {
        await supabase.from('audit_log').insert({
          actor_user_id: null,
          action: 'email_trainer_signoff_failed',
          entity: 'completion',
          entity_id: (data as any).id,
          payload: { to: trainerEmail, subject, error: String(e) },
        });
      }
    } else {
      const { error: logErr } = await supabase.from('audit_log').insert({
        actor_user_id: null,
        action: 'email_trainer_signoff',
        entity: 'completion',
        entity_id: (data as any).id,
        payload: { to: trainerEmail, subject, body },
      });
      if (logErr) throw logErr;
    }

    return new Response(JSON.stringify({ sent: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    return new Response(`Error: ${e}`, { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
  }
}

Deno.serve(handler);


