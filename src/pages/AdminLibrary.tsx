import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';

export default function AdminLibrary() {
  const [name, setName] = React.useState<string>('Admin');

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const display = (u?.user_metadata as any)?.full_name || u?.email || 'Admin';
      setName(display);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Fetch lines, categories, modules
  const { data: lines } = useQuery({
    queryKey: ['lines'],
    queryFn: async () => (await supabase.from('lines').select('*').order('name')).data || []
  });

  const [selectedLine, setSelectedLine] = React.useState<string | null>(null);
  const { data: categories } = useQuery({
    queryKey: ['categories', selectedLine],
    queryFn: async () => {
      if (!selectedLine) return [] as any[];
      const { data } = await supabase.from('categories').select('*').eq('line_id', selectedLine).order('name');
      return data || [];
    },
    enabled: !!selectedLine
  });

  const [filters, setFilters] = React.useState<{ category_id?: string }>({});
  const { data: modules, refetch } = useQuery({
    queryKey: ['modules', selectedLine, filters.category_id],
    queryFn: async () => {
      if (!selectedLine) return [] as any[];
      let q = supabase.from('modules').select('*').eq('line_id', selectedLine).order('created_at', { ascending: false });
      if (filters.category_id) q = q.eq('category_id', filters.category_id);
      const { data } = await q;
      return data || [];
    },
    enabled: !!selectedLine
  });

  const [title, setTitle] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<string | undefined>(undefined);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const handleUpload = async () => {
    if (!selectedLine || !file || !title) return;
    setUploading(true);
    setMessage(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `${crypto.randomUUID()}/${file.name}`;
      const { error: upErr } = await supabase.storage.from('training-materials').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const type = ['pdf','doc','docx'].includes(ext) ? 'doc' : ['ppt','pptx'].includes(ext) ? 'ppt' : ['mp4','mov','webm'].includes(ext) ? 'video' : 'doc';
      const { error: insErr } = await supabase.from('modules').insert({
        title,
        line_id: selectedLine,
        category_id: categoryId || null,
        type,
        storage_path: path
      });
      if (insErr) throw insErr;
      setTitle(''); setCategoryId(undefined); setFile(null);
      await refetch();
      setMessage('Uploaded successfully');
    } catch (e: any) {
      setMessage(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Library</h2>
          <p className="text-muted-foreground">Upload and organize training materials by Line and Category.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Select onValueChange={(v) => { setSelectedLine(v); setFilters({}); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select Line" />
              </SelectTrigger>
              <SelectContent>
                {lines?.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.category_id} onValueChange={(v) => setFilters({ category_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload New Module</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Category (optional)" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button onClick={handleUpload} disabled={!file || !title || !selectedLine || uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            {message && <div className="md:col-span-4 text-sm text-muted-foreground">{message}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules?.map((m: any) => (
              <div key={m.id} className="border rounded-lg p-4">
                <div className="font-semibold mb-1">{m.title}</div>
                <div className="text-xs text-muted-foreground mb-2">Type: {m.type} • v{m.version}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={async () => {
                    const { data } = await supabase.storage.from('training-materials').createSignedUrl(m.storage_path, 60);
                    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                  }}>Preview</Button>
                  <Button variant="destructive" size="sm" onClick={async () => {
                    await supabase.from('modules').delete().eq('id', m.id);
                    await refetch();
                  }}>Delete</Button>
                </div>
              </div>
            ))}
            {modules?.length === 0 && (
              <div className="text-sm text-muted-foreground">No modules found for the selected filters.</div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


