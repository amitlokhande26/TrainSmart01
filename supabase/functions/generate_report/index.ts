import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// Minimal branded PDF using pdf-lib (pure TS, no headless browser)
// Input body: { type: 'employee_log' | 'module_compliance', filters?: {...} }

export default async function handler(req: Request): Promise<Response> {
  try {
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    const { createClient } = await import('npm:@supabase/supabase-js');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const input = await req.json().catch(() => ({}));
    const type = input?.type || 'employee_log';
    const now = new Date();
    
    console.log('Starting PDF generation for type:', type);

    // Query data
    let rows: any[] = [];
    if (type === 'employee_log') {
      console.log('Querying employee log data...');
      const { data, error } = await supabase
        .from('completions')
        .select(`
          id, completed_at,
          assignment:assignments(
            id, due_date,
            module:modules(title, version, line:lines(name), category:categories(name)),
            user:users(first_name, last_name, email),
            trainer:users!assignments_trainer_user_id_fkey(first_name, last_name, email, role)
          ),
          signature:signatures(signed_name_snapshot, signed_email_snapshot, signed_at),
          trainer_signoff:trainer_signoffs(signed_name_snapshot, signed_email_snapshot, signed_at)
        `)
        .order('completed_at', { ascending: false });
      if (error) {
        console.error('Database query error:', error);
        throw error;
      }
      console.log('Database query successful, found', data?.length || 0, 'records');
      rows = (data || []).map((r: any) => ({
        employee: `${r.assignment?.user?.first_name || ''} ${r.assignment?.user?.last_name || ''}`.trim(),
        email: r.assignment?.user?.email,
        line: r.assignment?.module?.line?.name || '',
        category: r.assignment?.module?.category?.name || '',
        module: r.assignment?.module?.title,
        version: r.assignment?.module?.version,
        due: r.assignment?.due_date,
        completed: r.completed_at,
        signed_name: r.signature?.signed_name_snapshot,
        signed_email: r.signature?.signed_email_snapshot,
        signed_at: r.signature?.signed_at,
        trainer: r.assignment?.trainer ? `${r.assignment.trainer.first_name} ${r.assignment.trainer.last_name}` : '',
        trainer_email: r.assignment?.trainer?.email || '',
        trainer_approved: r.trainer_signoff?.signed_at ? 'Yes' : 'No',
      }));
    } else {
      console.log('Querying module coverage data...');
      const { data, error } = await supabase.from('v_module_coverage').select('*');
      if (error) {
        console.error('Module coverage query error:', error);
        throw error;
      }
      console.log('Module coverage query successful, found', data?.length || 0, 'records');
      rows = data || [];
    }

    console.log('Starting PDF generation...');
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

    // Simple table render (first ~20 rows)
    let y = 740;
    const limit = Math.min(rows.length, 20);
    for (let i = 0; i < limit; i++) {
      const r = rows[i];
      if (type === 'employee_log') {
        const line1 = `${r.employee || ''} | ${r.email || ''} | ${r.line || ''} | ${r.category || ''}`;
        const line2 = `${r.module || ''} v${r.version || ''} | completed ${r.completed || ''} | trainer: ${r.trainer || 'N/A'} | approved: ${r.trainer_approved || 'No'}`;
        drawText(line1.slice(0, 110), 50, y, 10);
        y -= 12;
        drawText(line2.slice(0, 110), 50, y, 9);
        y -= 14;
      } else {
        const line = `module_id ${r.module_id} | assigned ${r.assigned_count} | completed ${r.completed_count} | overdue ${r.overdue_count}`;
        drawText(line.slice(0, 110), 50, y, 10);
        y -= 14;
      }
      if (y < 60) break;
    }

    // Footer
    drawText('IDL Beverages • Confidential', 50, 40, 9);

    const bytes = await pdfDoc.save();
    console.log('PDF generated successfully, size:', bytes.length, 'bytes');
    
    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${timestamp}-${type}-report.pdf`;
    console.log('Generated filename:', fileName);
    
    // Upload PDF to Supabase Storage
    console.log('Uploading PDF to storage...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reports')
      .upload(fileName, bytes, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }
    console.log('PDF uploaded successfully to storage');
    
    // Generate signed URL (valid for 1 hour)
    console.log('Generating signed URL...');
    const { data: urlData, error: urlError } = await supabase.storage
      .from('reports')
      .createSignedUrl(fileName, 3600);
    
    if (urlError) {
      console.error('Signed URL generation error:', urlError);
      throw new Error(`Failed to generate download URL: ${urlError.message}`);
    }
    console.log('Signed URL generated successfully');
    
    return new Response(JSON.stringify({ 
      url: urlData.signedUrl,
      fileName: fileName,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    console.error('Generate report error:', e);
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: e instanceof Error ? e.stack : undefined 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
}

Deno.serve(handler);


