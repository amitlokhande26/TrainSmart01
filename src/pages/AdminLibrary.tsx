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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Library</h2>
            <p className="text-muted-foreground">Upload and organize training materials by Line and Category.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            className="hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>

        <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-white to-gray-50">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-2xl">
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Select Line</label>
                <Select onValueChange={(v) => { setSelectedLine(v); setFilters({}); }}>
                  <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Choose a line to filter modules" />
                  </SelectTrigger>
                  <SelectContent>
                    {lines?.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Select Category</label>
                <Select value={filters.category_id} onValueChange={(v) => setFilters({ category_id: v })}>
                  <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500" disabled={!selectedLine}>
                    <SelectValue placeholder={selectedLine ? "Choose a category" : "Select a line first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-white to-gray-50">
          <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 rounded-t-2xl">
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload New Module
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Module Title</label>
                <Input 
                  placeholder="Enter module title" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Line</label>
                <Select value={uploadLineId || ""} onValueChange={(v) => { setUploadLineId(v); setUploadCategoryId(null); }}>
                  <SelectTrigger className="border-gray-300 focus:border-green-500 focus:ring-green-500">
                    <SelectValue placeholder="Select Line" />
                  </SelectTrigger>
                  <SelectContent>
                    {lines?.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Category</label>
                <Select value={uploadCategoryId || ""} onValueChange={(v) => setUploadCategoryId(v)} disabled={!uploadLineId}>
                  <SelectTrigger className="border-gray-300 focus:border-green-500 focus:ring-green-500">
                    <SelectValue placeholder={uploadLineId ? "Select Category" : "Select Line first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {uploadCategories?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">File</label>
                <Input 
                  type="file" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 invisible">Upload</label>
                <Button 
                  onClick={handleUpload} 
                  disabled={!file || !title || !uploadLineId || !uploadCategoryId || uploading}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>
            {message && (
              <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-800">{message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-white to-gray-50">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-t-2xl">
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Training Modules
              {modules && modules.length > 0 && (
                <span className="ml-2 px-2 py-1 bg-purple-200 text-purple-800 rounded-full text-sm font-medium">
                  {modules.length} modules
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {modules?.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No modules found</h3>
                <p className="text-gray-500">No modules found for the selected filters. Try selecting a different line or category.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {modules?.map((m: any) => (
                  <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-300 group">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          m.type === 'video' ? 'bg-red-100' :
                          m.type === 'ppt' ? 'bg-orange-100' :
                          'bg-blue-100'
                        }`}>
                          <svg className={`h-6 w-6 ${
                            m.type === 'video' ? 'text-red-600' :
                            m.type === 'ppt' ? 'text-orange-600' :
                            'text-blue-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {m.type === 'video' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            ) : m.type === 'ppt' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            )}
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-lg mb-2 group-hover:text-purple-600 transition-colors">{m.title}</h3>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            m.type === 'video' ? 'bg-red-100 text-red-800' :
                            m.type === 'ppt' ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {m.type.toUpperCase()}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                            v{m.version}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={async () => {
                              const { data } = await supabase.storage.from('training-materials').createSignedUrl(m.storage_path, 60);
                              if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                            }}
                            className="flex-1 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-blue-200 text-blue-700 hover:text-blue-800 transition-all duration-200"
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Preview
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={async () => {
                              const confirmed = window.confirm(`Are you sure you want to delete "${m.title}"? This action cannot be undone.`);
                              if (!confirmed) return;
                              
                              try {
                                const { error: storageError } = await supabase.storage
                                  .from('training-materials')
                                  .remove([m.storage_path]);
                                
                                if (storageError) {
                                  console.error('Error deleting file from storage:', storageError);
                                }
                                
                                const { error: dbError } = await supabase
                                  .from('modules')
                                  .delete()
                                  .eq('id', m.id);
                                
                                if (dbError) {
                                  console.error('Error deleting module from database:', dbError);
                                  return;
                                }
                                
                                await refetch();
                              } catch (error) {
                                console.error('Error deleting module:', error);
                              }
                            }}
                            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white transition-all duration-200 shadow-md hover:shadow-lg"
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


