import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// Minimal branded PDF using pdf-lib (pure TS, no headless browser)
// Input body: { type: 'employee_log' | 'module_compliance', filters?: {...} }

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const { createClient } = await import('npm:@supabase/supabase-js');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const input = await req.json().catch(() => ({}));
    const type = input?.type || 'employee_log';
    const now = new Date();

    // Query data
    let rows: any[] = [];
    if (type === 'employee_log') {
      const { data, error } = await supabase
        .from('completions')
        .select(`
          id, completed_at,
          assignment:assignments(id, due_date, module:modules(title,version), user:users(first_name,last_name,email)),
          signature:signatures(signed_name_snapshot,signed_email_snapshot,signed_at)
        `)
        .order('completed_at', { ascending: false });
      if (error) throw error;
      rows = (data || []).map((r: any) => ({
        employee: `${r.assignment?.user?.first_name || ''} ${r.assignment?.user?.last_name || ''}`.trim(),
        email: r.assignment?.user?.email,
        module: r.assignment?.module?.title,
        version: r.assignment?.module?.version,
        due: r.assignment?.due_date,
        completed: r.completed_at,
        signed_name: r.signature?.signed_name_snapshot,
        signed_email: r.signature?.signed_email_snapshot,
        signed_at: r.signature?.signed_at,
      }));
    } else {
      const { data, error } = await supabase.from('v_module_coverage').select('*');
      if (error) throw error;
      rows = data || [];
    }

    // Build PDF
    const { PDFDocument, StandardFonts, rgb } = await import('npm:pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const drawText = (text: string, x: number, y: number, size = 12) => {
      page.drawText(text, { x, y, size, font, color: rgb(0,0,0) });
    };

    // Header / branding
    drawText('TrainSmart', 50, 800, 20);
    drawText(type === 'employee_log' ? 'Employee Training Log' : 'Module Compliance Report', 50, 780, 14);
    drawText(`Generated: ${now.toISOString()}`, 50, 765, 10);

    // Simple table render (first ~25 rows)
    let y = 740;
    const limit = Math.min(rows.length, 25);
    for (let i = 0; i < limit; i++) {
      const r = rows[i];
      const line = type === 'employee_log'
        ? `${r.employee || ''} | ${r.email || ''} | ${r.module || ''} v${r.version || ''} | completed ${r.completed || ''}`
        : `module_id ${r.module_id} | assigned ${r.assigned_count} | completed ${r.completed_count} | overdue ${r.overdue_count}`;
      drawText(line.slice(0, 110), 50, y, 10);
      y -= 14;
      if (y < 60) break;
    }

    // Footer
    drawText('IDL Beverages • Confidential', 50, 40, 9);

    const bytes = await pdfDoc.save();
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${type}_report.pdf"`
      }
    });
  } catch (e) {
    return new Response(`Error: ${e}`, { status: 500 });
  }
}

Deno.serve(handler);


