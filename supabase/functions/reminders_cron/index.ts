import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// Reminder policy (3 days before, 1 day before, every 2 days overdue up to 3 times)
// This function scans assignments and sends email reminders via the built-in email or logs actions.

export default async function handler(_req: Request): Promise<Response> {
  try {
    const { createClient } = await import('npm:@supabase/supabase-js');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0,10);
    const addDays = (d: Date, n: number) => new Date(d.getTime() + n*24*60*60*1000);

    // Fetch assignments with due dates
    const { data: assigns, error } = await supabase
      .from('assignments')
      .select('id, due_date, status, assigned_to, module:modules(title), user:users(email,first_name,last_name)')
      .neq('status','completed');
    if (error) throw error;

    const toNotify: any[] = [];
    for (const a of assigns || []) {
      if (!a.due_date) continue;
      const due = new Date(a.due_date as string);
      const daysUntil = Math.ceil((due.getTime() - today.getTime())/(24*60*60*1000));
      const daysOver = Math.ceil((today.getTime() - due.getTime())/(24*60*60*1000));
      // 3 days before or 1 day before
      if (daysUntil === 3 || daysUntil === 1) toNotify.push({ a, reason: `${daysUntil} days before due` });
      // Overdue: day 2, 4, 6 (up to 3 times)
      if (daysOver > 0 && [2,4,6].includes(daysOver)) toNotify.push({ a, reason: `overdue +${daysOver} days` });
    }

    // For demo, just log notifications into audit_log. Replace with email API later.
    if (toNotify.length > 0) {
      const rows = toNotify.map(({ a, reason }) => ({
        actor_user_id: null,
        action: 'reminder',
        entity: 'assignment',
        entity_id: a.id,
        payload: { reason, email: a.user?.email, module: a.module?.title, due_date: a.due_date },
      }));
      const { error: logErr } = await supabase.from('audit_log').insert(rows);
      if (logErr) throw logErr;
    }

    return new Response(JSON.stringify({ processed: toNotify.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(`Error: ${e}`, { status: 500 });
  }
}

Deno.serve(handler);


