import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';

function toCsv(rows: any[]): string {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')));
  return csv.join('\n');
}

export default function AdminReports() {
  const [name, setName] = React.useState<string>('Admin');
  const [search, setSearch] = React.useState<string>('');
  const [fromDate, setFromDate] = React.useState<string>('');
  const [toDate, setToDate] = React.useState<string>('');
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const display = (u?.user_metadata as any)?.full_name || u?.email || 'Admin';
      setName(display);
    });
  }, []);

  const { data: employeeLogs, refetch } = useQuery({
    queryKey: ['employee-logs', search, fromDate, toDate],
    queryFn: async () => {
      // Drive from assignments to avoid edge cases when selecting directly from completions
      let query = supabase
        .from('assignments')
        .select(`
          id, due_date,
          module:modules(title,version),
          user:users(first_name,last_name,email),
          trainer:users!assignments_trainer_user_id_fkey(first_name,last_name,email,role),
          completion:completions(id, completed_at, signature:signatures(signed_name_snapshot,signed_email_snapshot,signed_at))
        `)
        .order('id', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      let rows = (data || [])
        .filter((row: any) => !!row.completion?.id)
        .map((row: any) => ({
          completion_id: row.completion?.id,
          employee: `${row.user?.first_name || ''} ${row.user?.last_name || ''}`.trim(),
          employee_email: row.user?.email,
          module_title: row.module?.title,
          module_version: row.module?.version,
          due_date: row.due_date,
          completed_at: row.completion?.completed_at,
          signed_name: row.completion?.signature?.signed_name_snapshot,
          signed_email: row.completion?.signature?.signed_email_snapshot,
          signed_at: row.completion?.signature?.signed_at,
          trainer_name: row.trainer ? `${row.trainer.first_name} ${row.trainer.last_name}` : undefined,
          trainer_email: row.trainer?.email,
        }));
      // Apply filters
      if (fromDate) rows = rows.filter((r: any) => r.completed_at && new Date(r.completed_at) >= new Date(`${fromDate}T00:00:00Z`));
      if (toDate) rows = rows.filter((r: any) => r.completed_at && new Date(r.completed_at) <= new Date(`${toDate}T23:59:59Z`));
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter((r: any) =>
          (r.employee || '').toLowerCase().includes(s) ||
          (r.employee_email || '').toLowerCase().includes(s) ||
          (r.module_title || '').toLowerCase().includes(s)
        );
      }
      // Sort by completed_at desc
      rows.sort((a: any, b: any) => (new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()));
      return rows;
    }
  });

  React.useEffect(() => {
    const channel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signatures' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trainer_signoffs' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

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
            <div className="grid gap-3 md:grid-cols-4">
              <Input placeholder="Search by employee or module" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="flex items-center gap-2">
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Button onClick={() => downloadCsv(employeeLogs || [], 'employee_training_log')}>Download CSV</Button>
                <Button variant="outline" onClick={() => {
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
                    <th>Employee</th><th>Email</th><th>Module</th><th>Version</th><th>Due</th><th>Completed</th><th>Signed Name</th><th>Signed Email</th><th>Signed At</th><th>Trainer</th><th>Trainer Email</th>
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
                      <td>${r.trainer_name||''}</td>
                      <td>${r.trainer_email||''}</td>
                    </tr>`).join('')}
                    </tbody></table>
                    <script>window.onload=()=>window.print()</script>
                  </body></html>`;
                  w.document.write(html);
                  w.document.close();
                }}>Open Print View</Button>
                <Button variant="outline" onClick={async () => {
                  const { data, error } = await supabase.functions.invoke('generate_report', {
                    body: { type: 'employee_log', search, fromDate, toDate }
                  });
                  if (error) return;
                  const res = await fetch('/functions/v1/generate_report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'employee_log', search, fromDate, toDate })
                  });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'employee_log.pdf'; a.click();
                  URL.revokeObjectURL(url);
                }}>Download Branded PDF</Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Rows: {(employeeLogs || []).length}</div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


