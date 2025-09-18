import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';

function toCsv(rows: any[]): string {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')));
  return csv.join('\n');
}

export default function AdminReports() {
  const [name, setName] = React.useState<string>('Admin');
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const display = (u?.user_metadata as any)?.full_name || u?.email || 'Admin';
      setName(display);
    });
  }, []);

  const { data: employeeLogs } = useQuery({
    queryKey: ['employee-logs'],
    queryFn: async () => {
      // join assignments, completions, signatures, users, modules
      const { data, error } = await supabase
        .from('completions')
        .select(`
          id, completed_at,
          assignment:assignments(id, due_date, module:modules(title,version), user:users(first_name,last_name,email)),
          signature:signatures(signed_name_snapshot,signed_email_snapshot,signed_at)
        `)
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        completion_id: row.id,
        employee: `${row.assignment?.user?.first_name || ''} ${row.assignment?.user?.last_name || ''}`.trim(),
        employee_email: row.assignment?.user?.email,
        module_title: row.assignment?.module?.title,
        module_version: row.assignment?.module?.version,
        due_date: row.assignment?.due_date,
        completed_at: row.completed_at,
        signed_name: row.signature?.signed_name_snapshot,
        signed_email: row.signature?.signed_email_snapshot,
        signed_at: row.signature?.signed_at,
      }));
    }
  });

  const downloadCsv = (rows: any[], name: string) => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={async () => supabase.auth.signOut()} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Reports</h2>
          <p className="text-muted-foreground">Export training records for audits.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Employee Training Log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => downloadCsv(employeeLogs || [], 'employee_training_log')}>Download CSV</Button>
            <div className="text-sm text-muted-foreground">Rows: {(employeeLogs || []).length}</div>
            <Button variant="outline" onClick={() => {
              // Open print-friendly window
              const rows = employeeLogs || [];
              const w = window.open('', '_blank');
              if (!w) return;
              const html = `<!doctype html><html><head><title>Employee Training Log</title>
                <style>
                  body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px}
                  table{border-collapse:collapse;width:100%}
                  th,td{border:1px solid #ddd;padding:8px;font-size:12px}
                  th{background:#f7f7f7;text-align:left}
                  h1{font-size:18px;margin-bottom:12px}
                </style>
              </head><body>
                <h1>Employee Training Log</h1>
                <table><thead><tr>
                <th>Employee</th><th>Email</th><th>Module</th><th>Version</th><th>Due</th><th>Completed</th><th>Signed Name</th><th>Signed Email</th><th>Signed At</th>
                </tr></thead><tbody>
                ${rows.map((r:any)=>`<tr>
                  <td>${r.employee||''}</td>
                  <td>${r.employee_email||''}</td>
                  <td>${r.module_title||''}</td>
                  <td>${r.module_version||''}</td>
                  <td>${r.due_date||''}</td>
                  <td>${r.completed_at||''}</td>
                  <td>${r.signed_name||''}</td>
                  <td>${r.signed_email||''}</td>
                  <td>${r.signed_at||''}</td>
                </tr>`).join('')}
                </tbody></table>
                <script>window.onload=()=>window.print()</script>
              </body></html>`;
              w.document.write(html);
              w.document.close();
            }}>Open Print View</Button>
            <Button variant="outline" onClick={async () => {
              const { data, error } = await supabase.functions.invoke('generate_report', {
                body: { type: 'employee_log' }
              });
              if (error) return;
              // supabase-js returns { data } when content-type is json; for binary, use fetch fallback
              const res = await fetch('/functions/v1/generate_report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'employee_log' })
              });
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'employee_log.pdf'; a.click();
              URL.revokeObjectURL(url);
            }}>Download Branded PDF</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


