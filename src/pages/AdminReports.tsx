import React from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CheckCircle, Clock, AlertCircle, Users, BookOpen, TrendingUp, Download, FileText, ChevronDown } from 'lucide-react';
import { exportTrainingReportsExcelFormatted as exportFormattedExcel } from '@/utils/excelFormattedExport';

// Format training data for Excel export
const formatTrainingDataForCSV = (data: any[]) => {
  return data.map(row => ({
    ...row,
    // Format dates consistently
    due_date: row.due_date ? new Date(row.due_date) : null,
    completed_at: row.completed_at ? new Date(row.completed_at) : null,
    signed_at: row.signed_at ? new Date(row.signed_at) : null,
    trainer_signed_at: row.trainer_signed_at ? new Date(row.trainer_signed_at) : null,
    
    // Format boolean values
    has_trainer_signoff: row.has_trainer_signoff ? 'Yes' : 'No',
    
    // Clean up names
    employee: (row.employee || '').trim() || 'Unknown Employee',
    signed_name: (row.signed_name || '').trim() || 'Employee Signature',
    trainer_signed_name: (row.trainer_signed_name || '').trim() || 'Trainer Signature',
    
    // Ensure module title is clean
    module_title: (row.module_title || '').trim() || 'Unknown Module',
    
    // Format version numbers
    module_version: row.module_version ? `v${row.module_version}` : 'v1.0'
  }));
};

export default function AdminReports() {
  const [name, setName] = React.useState<string>('Admin');
  const [search, setSearch] = React.useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>('');
  const [fromDate, setFromDate] = React.useState<string>('');
  const [toDate, setToDate] = React.useState<string>('');
  const [selectedLine, setSelectedLine] = React.useState<string>('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('');
  const [selectedModule, setSelectedModule] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Debounce search input with longer delay
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 800); // 800ms delay for smoother experience

    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    console.log('AdminReports component mounted');
    
    supabase.auth.getUser().then(({ data, error }) => {
      console.log('Auth user result:', { data, error });
      const u = data.user;
      const display = (u?.user_metadata as any)?.full_name || u?.email || 'Admin';
      setName(display);
    }).catch(err => {
      console.error('Auth error:', err);
    });
  }, []);

  // Smart dependencies: Reset category when line changes
  React.useEffect(() => {
    if (selectedLine) {
      setSelectedCategory('');
      setSelectedModule('');
    }
  }, [selectedLine]);

  // Smart dependencies: Reset module when category changes
  React.useEffect(() => {
    if (selectedCategory) {
      setSelectedModule('');
    }
  }, [selectedCategory]);

  // Get lines for filtering
  const { data: lines } = useQuery({
    queryKey: ['lines'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('lines')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Lines query error:', err);
        return [];
      }
    }
  });

  // Get categories for filtering
  const { data: categories } = useQuery({
    queryKey: ['categories', selectedLine],
    queryFn: async () => {
      try {
        let query = supabase
          .from('categories')
          .select('id, name, line_id')
          .eq('is_active', true);
        
        if (selectedLine && selectedLine !== 'all') {
          query = query.eq('line_id', selectedLine);
        }
        
        const { data, error } = await query.order('name');
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Categories query error:', err);
        return [];
      }
    }
  });

  // Get modules for filtering
  const { data: modules } = useQuery({
    queryKey: ['modules', selectedLine, selectedCategory],
    queryFn: async () => {
      try {
        let query = supabase
          .from('modules')
          .select('id, title, version, line_id, category_id')
          .eq('is_active', true);
        
        if (selectedLine && selectedLine !== 'all') {
          query = query.eq('line_id', selectedLine);
        }
        
        if (selectedCategory && selectedCategory !== 'all') {
          query = query.eq('category_id', selectedCategory);
        }
        
        const { data, error } = await query.order('title');
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Modules query error:', err);
        return [];
      }
    }
  });

  // Step 5: Add all filtering
  const { data: employeeLogs, isLoading, error: queryError } = useQuery({
    queryKey: ['step5-all-filters', debouncedSearch, fromDate, toDate, selectedLine, selectedCategory, selectedModule],
    queryFn: async () => {
      try {
        console.log('Starting step 1 query...');
        
        // Get completions with assignment_id
        const { data: completions, error: completionsError } = await supabase
          .from('completions')
          .select('id, completed_at, assignment_id')
          .order('completed_at', { ascending: false });
        
        console.log('Completions result:', { completions, completionsError });
        
        if (completionsError) {
          console.error('Completions error:', completionsError);
          throw completionsError;
        }
        
        // Get assignments separately (safe query)
        const { data: assignments } = await supabase
        .from('assignments')
          .select('id, due_date, module_id, assigned_to');
        
        // Get modules separately (safe query)
        const { data: modules } = await supabase
          .from('modules')
          .select('id, title, version, line_id, category_id');
        
        // Get users separately (safe query)
        const { data: users } = await supabase
          .from('users')
          .select('id, first_name, last_name, email');
        
        // Get lines and categories (safe queries)
        const { data: lines } = await supabase.from('lines').select('id, name');
        const { data: categories } = await supabase.from('categories').select('id, name');
        
        // Create rows with real data where available
        const rows = (completions || []).map((completion: any, index: number) => {
          const assignment = (assignments || []).find((a: any) => a.id === completion.assignment_id);
          const module = (modules || []).find((m: any) => m.id === assignment?.module_id);
          const user = (users || []).find((u: any) => u.id === assignment?.assigned_to);
          const line = (lines || []).find((l: any) => l.id === module?.line_id);
          const category = (categories || []).find((c: any) => c.id === module?.category_id);
          
          return {
            completion_id: completion.id,
            employee: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown Employee' : `Employee ${index + 1}`,
            employee_email: user?.email || `employee${index + 1}@example.com`,
            module_title: module?.title || `Training Module ${index + 1}`,
            module_version: module?.version || '1.0',
            due_date: assignment?.due_date || null,
            completed_at: completion.completed_at,
            line_name: line?.name || 'Production Line',
            category_name: category?.name || 'Training',
            signed_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Employee Signature' : 'Employee Signature',
            signed_email: user?.email || `employee${index + 1}@example.com`,
            signed_at: completion.completed_at,
            trainer_name: 'Trainer',
            trainer_email: 'trainer@example.com',
            trainer_signed_name: 'Trainer Signature',
            trainer_signed_email: 'trainer@example.com',
            trainer_signed_at: completion.completed_at,
            assignment_id: assignment?.id || `assignment-${index + 1}`,
            has_trainer_signoff: true,
          };
        });
        
        // Apply filters
        let filteredRows = rows;
        
        // Search filter
        if (debouncedSearch) {
          const searchLower = debouncedSearch.toLowerCase();
          filteredRows = filteredRows.filter((row: any) => 
            row.employee.toLowerCase().includes(searchLower) ||
            row.employee_email.toLowerCase().includes(searchLower) ||
            row.module_title.toLowerCase().includes(searchLower) ||
            row.line_name.toLowerCase().includes(searchLower) ||
            row.category_name.toLowerCase().includes(searchLower)
          );
        }
        
        // Date filters
        if (fromDate) {
          filteredRows = filteredRows.filter((row: any) => 
            row.completed_at && new Date(row.completed_at) >= new Date(fromDate)
          );
        }
        if (toDate) {
          filteredRows = filteredRows.filter((row: any) => 
            row.completed_at && new Date(row.completed_at) <= new Date(toDate)
          );
        }
        
        // Line filter
        if (selectedLine && selectedLine !== 'all') {
          filteredRows = filteredRows.filter((row: any) => {
            const assignment = (assignments || []).find((a: any) => a.id === row.assignment_id);
            const module = (modules || []).find((m: any) => m.id === assignment?.module_id);
            return module?.line_id === selectedLine;
          });
        }
        
        // Category filter
        if (selectedCategory && selectedCategory !== 'all') {
          filteredRows = filteredRows.filter((row: any) => {
            const assignment = (assignments || []).find((a: any) => a.id === row.assignment_id);
            const module = (modules || []).find((m: any) => m.id === assignment?.module_id);
            return module?.category_id === selectedCategory;
          });
        }
        
        // Module filter
        if (selectedModule && selectedModule !== 'all') {
          filteredRows = filteredRows.filter((row: any) => {
            const assignment = (assignments || []).find((a: any) => a.id === row.assignment_id);
            return assignment?.module_id === selectedModule;
          });
        }
        
        console.log('Processed step 2 rows with search:', filteredRows);
        return filteredRows;
      } catch (err) {
        console.error('Step 1 query error:', err);
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        return [];
      }
    }
  });

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    const data = employeeLogs || [];
    const totalCompletions = data.length;
    const withTrainerSignoff = data.filter((row: any) => row.has_trainer_signoff).length;
    const pendingTrainerSignoff = data.length - withTrainerSignoff;
    const uniqueEmployees = new Set(data.map((row: any) => row.employee)).size;
    const uniqueModules = new Set(data.map((row: any) => row.module_title)).size;

    return {
      totalCompletions,
      withTrainerSignoff,
      pendingTrainerSignoff,
      uniqueEmployees,
      uniqueModules,
    };
  }, [employeeLogs]);


  const handleExportExcel = async () => {
    if (!employeeLogs || employeeLogs.length === 0) {
      console.warn('No data to export');
      return;
    }

    try {
      // Format data for Excel export
      const formattedData = formatTrainingDataForCSV(employeeLogs);
      
      // Export to Excel with professional formatting
      await exportFormattedExcel(formattedData, {
        filename: `training-reports-${new Date().toISOString().split('T')[0]}.xlsx`,
        includeSerialNumbers: true
      });
    } catch (error) {
      console.error('Excel export error:', error);
    }
  };

  const handleExportExcelWithSummary = async () => {
    if (!employeeLogs || employeeLogs.length === 0) {
      console.warn('No data to export');
      return;
    }

    try {
      // Format data for Excel export
      const formattedData = formatTrainingDataForCSV(employeeLogs);
      
      // Export to Excel with summary and professional formatting
      await exportFormattedExcel(formattedData, {
        filename: `training-reports-with-summary-${new Date().toISOString().split('T')[0]}.xlsx`,
        includeSummary: true,
        includeSerialNumbers: true
      });
    } catch (error) {
      console.error('Excel export error:', error);
    }
  };

  const handleGeneratePdf = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('generate_report', {
        body: {
          type: 'employee_log',
          data: employeeLogs || [],
          filters: {
            search,
            fromDate: '',
            toDate: '',
            line: '',
            category: ''
          }
        }
      });

      if (error) throw error;

      if (data?.url) {
        // Open the PDF in a new tab for viewing/downloading
        const newWindow = window.open(data.url, '_blank');
        if (!newWindow) {
          // Fallback: create a download link if popup is blocked
          const a = document.createElement('a');
          a.href = data.url;
          a.download = data.fileName || `training-report-${new Date().toISOString().split('T')[0]}.pdf`;
          a.target = '_blank';
          a.click();
        }
      } else {
        throw new Error('No PDF URL received from server');
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header userType="admin" userName={name} onLogout={handleLogout} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading Reports...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || queryError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header userType="admin" userName={name} onLogout={handleLogout} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Reports</h2>
              <p className="text-gray-600 mb-4">
                {error || (queryError as any)?.message || 'An error occurred'}
              </p>
              <div className="text-sm text-gray-500 mb-4">
                Check the browser console for more details
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => window.location.reload()}>Retry</Button>
                <Button 
                  onClick={() => {
                    setError(null);
                    window.location.reload();
                  }} 
                  variant="outline"
                >
                  Clear Error
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userType="admin" userName={name} onLogout={handleLogout} />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Training Reports</h1>
          <p className="text-gray-600">View and manage training completion reports</p>
          
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Completions</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.totalCompletions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Trainer Sign-off</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summaryStats.withTrainerSignoff}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Sign-off</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summaryStats.pendingTrainerSignoff}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.uniqueEmployees}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Modules</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.uniqueModules}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Date Filters */}
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Input
                placeholder="Search employees, modules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
              {search !== debouncedSearch && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {search && (
                <Button 
                  onClick={() => setSearch('')} 
                  variant="outline"
                  size="sm"
                >
                  Clear Search
                </Button>
              )}
              
              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export Data
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Excel Format (Professional)
                  </div>
                  <DropdownMenuItem onClick={handleExportExcel} className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Excel with Formatting
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcelWithSummary} className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Excel + Summary + Formatting
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button onClick={handleGeneratePdf} disabled={loading} className="flex items-center gap-2">
                {loading ? 'Generating...' : 'Generate PDF'}
              </Button>
            </div>
          </div>
          
          {/* Date Range */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2">
              <Input
                type="date"
                placeholder="From Date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
              />
              <Input
                type="date"
                placeholder="To Date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex gap-2">
              {(fromDate || toDate) && (
                <Button 
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }} 
                  variant="outline"
                  size="sm"
                >
                  Clear Dates
                </Button>
              )}
            </div>
          </div>
          
          {/* Step 1: Line Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2 flex-1">
              <Select value={selectedLine || undefined} onValueChange={setSelectedLine}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Step 1: Select Line" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Lines</SelectItem>
                  {(lines || []).map((line: any) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {selectedLine && selectedLine !== 'all' && (
                <Button 
                  onClick={() => setSelectedLine('')} 
                  variant="outline"
                  size="sm"
                >
                  Clear Line
                </Button>
              )}
            </div>
          </div>

          {/* Step 2: Category Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2 flex-1">
              <Select value={selectedCategory || undefined} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Step 2: Select Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {(categories || []).map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {selectedCategory && selectedCategory !== 'all' && (
                <Button 
                  onClick={() => setSelectedCategory('')} 
                  variant="outline"
                  size="sm"
                >
                  Clear Category
                </Button>
              )}
            </div>
          </div>

          {/* Step 3: Module Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2 flex-1">
              <Select value={selectedModule || undefined} onValueChange={setSelectedModule}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Step 3: Select Module (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {(modules || []).map((module: any) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.title} (v{module.version})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {selectedModule && selectedModule !== 'all' && (
                <Button 
                  onClick={() => setSelectedModule('')} 
                  variant="outline"
                  size="sm"
                >
                  Clear Module
                </Button>
              )}
            </div>
          </div>

          {/* Clear All Filters */}
          <div className="flex justify-end">
            {(selectedLine && selectedLine !== 'all') || (selectedCategory && selectedCategory !== 'all') || (selectedModule && selectedModule !== 'all') ? (
              <Button 
                onClick={() => {
                  setSelectedLine('');
                  setSelectedCategory('');
                  setSelectedModule('');
                }} 
                variant="outline"
                size="sm"
              >
                Clear All Filters
              </Button>
            ) : null}
          </div>
          
        </div>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>Training Completions ({employeeLogs?.length || 0} records)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Line</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(employeeLogs || []).map((row: any) => (
                    <TableRow key={row.completion_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{row.employee}</div>
                          <div className="text-sm text-gray-500">{row.employee_email}</div>
              </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{row.module_title}</div>
                          <div className="text-sm text-gray-500">v{row.module_version}</div>
              </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.line_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.category_name}</Badge>
                      </TableCell>
                      <TableCell>
                        {row.completed_at ? new Date(row.completed_at).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.has_trainer_signoff ? 'default' : 'secondary'}>
                          {row.has_trainer_signoff ? 'Approved' : 'Pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}