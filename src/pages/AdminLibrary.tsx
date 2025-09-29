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
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (u) {
        // Try to get first_name and last_name from the users table
        const { data: userData } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', u.id)
          .single();
        
        if (userData && userData.first_name && userData.last_name) {
          setName(`${userData.first_name} ${userData.last_name}`);
        } else {
          // Fallback to user metadata or email
          const display = (u?.user_metadata as any)?.full_name || u?.email || 'Admin';
          setName(display);
        }
      }
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
  const [uploadLineId, setUploadLineId] = React.useState<string | null>(null);
  const [uploadCategoryId, setUploadCategoryId] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  // Separate categories query for upload section
  const { data: uploadCategories } = useQuery({
    queryKey: ['upload-categories', uploadLineId],
    queryFn: async () => {
      if (!uploadLineId) return [] as any[];
      const { data } = await supabase.from('categories').select('*').eq('line_id', uploadLineId).order('name');
      return data || [];
    },
    enabled: !!uploadLineId
  });

  const handleUpload = async () => {
    if (!uploadLineId || !uploadCategoryId || !file || !title) return;
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
        line_id: uploadLineId,
        category_id: uploadCategoryId,
        type,
        storage_path: path
      });
      if (insErr) throw insErr;
      setTitle(''); setUploadLineId(null); setUploadCategoryId(null); setFile(null);
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
          <CardContent className="grid gap-4 md:grid-cols-5">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Select value={uploadLineId || ""} onValueChange={(v) => { setUploadLineId(v); setUploadCategoryId(null); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select Line" />
              </SelectTrigger>
              <SelectContent>
                {lines?.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={uploadCategoryId || ""} onValueChange={(v) => setUploadCategoryId(v)} disabled={!uploadLineId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {uploadCategories?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button onClick={handleUpload} disabled={!file || !title || !uploadLineId || !uploadCategoryId || uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            {message && <div className="md:col-span-5 text-sm text-muted-foreground">{message}</div>}
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
                    // Confirmation dialog
                    const confirmed = window.confirm(`Are you sure you want to delete "${m.title}"? This action cannot be undone.`);
                    if (!confirmed) return;
                    
                    try {
                      // Delete file from storage bucket first
                      const { error: storageError } = await supabase.storage
                        .from('training-materials')
                        .remove([m.storage_path]);
                      
                      if (storageError) {
                        console.error('Error deleting file from storage:', storageError);
                        // Continue with database deletion even if storage deletion fails
                      }
                      
                      // Delete record from modules table
                      const { error: dbError } = await supabase
                        .from('modules')
                        .delete()
                        .eq('id', m.id);
                      
                      if (dbError) {
                        console.error('Error deleting module from database:', dbError);
                        return;
                      }
                      
                      // Refresh the UI
                      await refetch();
                    } catch (error) {
                      console.error('Error deleting module:', error);
                    }
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


