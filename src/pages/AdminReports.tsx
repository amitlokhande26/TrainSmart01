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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CheckCircle, Clock, AlertCircle, Users, BookOpen, TrendingUp, Download, FileText, ChevronDown, Calendar as CalendarIcon, RefreshCw, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportTrainingReportsExcelFormatted as exportFormattedExcel } from '@/utils/excelFormattedExport';
import { formatDateForDisplay, formatDateForInput } from '@/utils/dateFormat';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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
  const [isFiltersExpanded, setIsFiltersExpanded] = React.useState<boolean>(false);
  const [fromDateOpen, setFromDateOpen] = React.useState<boolean>(false);
  const [toDateOpen, setToDateOpen] = React.useState<boolean>(false);
  const [isCompletionsExpanded, setIsCompletionsExpanded] = React.useState<boolean>(false);
  const [completionsPage, setCompletionsPage] = React.useState<number>(1);
  const [completionsPerPage] = React.useState<number>(50);

  // Helper functions for date handling
  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const parseDate = (dateString: string) => {
    if (!dateString) return undefined;
    return new Date(dateString);
  };

  // Debounce search input with longer delay
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 800); // 800ms delay for smoother experience

    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    console.log('AdminReports component mounted');
    
    supabase.auth.getUser().then(async ({ data, error }) => {
      console.log('Auth user result:', { data, error });
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

  // Get all assignments for module coverage calculation
  const { data: allAssignments } = useQuery({
    queryKey: ['all-assignments-for-coverage'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('assignments')
          .select('id, status, module_id, assigned_to, modules!inner(id, title)');
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching assignments:', error);
        return [];
      }
    }
  });

  // Step 5: Add all filtering
  const { data: employeeLogs, isLoading, error: queryError, refetch } = useQuery({
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
          .select('id, status, due_date, module_id, assigned_to, trainer_user_id');
        
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
        
        // Get trainer signoffs (real data)
        const { data: trainerSignoffs } = await supabase
          .from('trainer_signoffs')
          .select('id, completion_id, signed_name_snapshot, signed_email_snapshot, signed_at');
        
        // Create rows with real data where available
        const rows = (completions || []).map((completion: any, index: number) => {
          const assignment = (assignments || []).find((a: any) => a.id === completion.assignment_id);
          const module = (modules || []).find((m: any) => m.id === assignment?.module_id);
          const user = (users || []).find((u: any) => u.id === assignment?.assigned_to);
          const trainer = (users || []).find((u: any) => u.id === assignment?.trainer_user_id);
          const line = (lines || []).find((l: any) => l.id === module?.line_id);
          const category = (categories || []).find((c: any) => c.id === module?.category_id);
          const trainerSignoff = (trainerSignoffs || []).find((ts: any) => ts.completion_id === completion.id);
          
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
            trainer_name: trainer ? `${trainer.first_name || ''} ${trainer.last_name || ''}`.trim() || 'Unknown Trainer' : 'No Trainer Assigned',
            trainer_email: trainer?.email || 'No Trainer Assigned',
            trainer_signed_name: trainerSignoff?.signed_name_snapshot || 'Not Signed Off',
            trainer_signed_email: trainerSignoff?.signed_email_snapshot || 'Not Signed Off',
            trainer_signed_at: trainerSignoff?.signed_at || null,
            assignment_id: assignment?.id || `assignment-${index + 1}`,
            has_trainer_signoff: !!trainerSignoff,
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
    },
    staleTime: 0, // Always consider data stale for real-time updates
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  // Calculate summary statistics with reimagined KPIs
  const summaryStats = React.useMemo(() => {
    const data = employeeLogs || [];
    const totalCompletions = data.length;
    const withTrainerSignoff = data.filter((row: any) => row.has_trainer_signoff).length;
    const pendingTrainerSignoff = data.length - withTrainerSignoff;
    
    // For unique employees and modules, count from assignments (not just completions)
    const uniqueEmployees = allAssignments ? new Set(allAssignments.map((a: any) => a.assigned_to)).size : 0;
    const uniqueModules = allAssignments ? new Set(allAssignments.map((a: any) => a.module_id)).size : 0;
    
    // Calculate new KPI metrics
    const totalAssignments = allAssignments?.length || 0;
    const completionRate = totalAssignments > 0 ? Math.round((totalCompletions / totalAssignments) * 100) : 0;
    const signoffRate = totalCompletions > 0 ? Math.round((withTrainerSignoff / totalCompletions) * 100) : 0;

    return {
      totalCompletions,
      withTrainerSignoff,
      pendingTrainerSignoff,
      uniqueEmployees,
      uniqueModules,
      completionRate,
      signoffRate,
      totalAssignments,
    };
  }, [employeeLogs, allAssignments]);

  // Pagination logic for completions
  const paginatedCompletions = React.useMemo(() => {
    if (!employeeLogs) return [];
    const startIndex = (completionsPage - 1) * completionsPerPage;
    const endIndex = startIndex + completionsPerPage;
    return employeeLogs.slice(startIndex, endIndex);
  }, [employeeLogs, completionsPage, completionsPerPage]);

  const totalPages = Math.ceil((employeeLogs?.length || 0) / completionsPerPage);

  // Reset page when data changes
  React.useEffect(() => {
    setCompletionsPage(1);
  }, [employeeLogs]);

  // NEW: Monthly trend data for bar chart
  const monthlyTrendData = React.useMemo(() => {
    if (!employeeLogs || employeeLogs.length === 0) return [];
    
    // Group data by month
    const monthlyData: { [key: string]: { completions: number; signoffs: number } } = {};
    
    employeeLogs.forEach((row: any) => {
      if (row.completed_at) {
        const date = new Date(row.completed_at);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { completions: 0, signoffs: 0 };
        }
        
        monthlyData[monthKey].completions += 1;
        
        if (row.has_trainer_signoff) {
          monthlyData[monthKey].signoffs += 1;
        }
      }
    });
    
    // If no date filters are applied, show only current month and 4 months before
    if (!fromDate && !toDate) {
      const currentDate = new Date();
      const monthsToShow = [];
      
      // Generate current month and 4 months before
      for (let i = 0; i < 5; i++) {
        const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthKey = targetDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthsToShow.push(monthKey);
      }
      
      // Filter to only show the last 5 months
      const filteredData = monthsToShow.map(month => ({
        month,
        completions: monthlyData[month]?.completions || 0,
        signoffs: monthlyData[month]?.signoffs || 0
      }));
      
      // Return in chronological order (oldest to newest)
      return filteredData.reverse();
    }
    
    // If date filters are applied, show all data within the filtered range
    return Object.entries(monthlyData)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }, [employeeLogs, fromDate, toDate]);

  // Get all active users for pie chart
  const { data: allActiveUsers } = useQuery({
    queryKey: ['all-active-users-simple'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, role')
          .eq('is_active', true);
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching active users:', error);
        return [];
      }
    }
  });

  // NEW: Module coverage data for pie chart - assignment-based counting with proper status logic
  const moduleCoverageData = React.useMemo(() => {
    // If no assignments available, return empty data to prevent errors
    if (!allAssignments || allAssignments.length === 0) {
      return [
        { name: "Approved", value: 0, percentage: 0 },
        { name: "Awaiting Sign-Off", value: 0, percentage: 0 },
        { name: "In Progress", value: 0, percentage: 0 },
        { name: "Not Started", value: 0, percentage: 0 }
      ];
    }
    
    // Get completions and signoffs data for status determination
    const completionsMap = new Map();
    const signoffsMap = new Map();
    
    if (employeeLogs && employeeLogs.length > 0) {
      employeeLogs.forEach((row: any) => {
        completionsMap.set(row.assignment_id, row);
        if (row.has_trainer_signoff) {
          signoffsMap.set(row.assignment_id, true);
        }
      });
    }
    
    // Process each assignment to determine its status
    let approved = 0;
    let awaitingSignoff = 0;
    let inProgress = 0;
    let notStarted = 0;
    
    allAssignments.forEach((assignment: any) => {
      const hasCompletion = completionsMap.has(assignment.id);
      const hasSignoff = signoffsMap.has(assignment.id);
      
      // Determine status based on assignment status, completion, and signoff
      if (hasCompletion && hasSignoff) {
        approved++;
      } else if (hasCompletion && !hasSignoff) {
        awaitingSignoff++;
      } else if (assignment.status === 'in_progress') {
        inProgress++;
      } else if (assignment.status === 'assigned') {
        notStarted++;
      }
    });
    
    const totalAssignments = allAssignments.length;
    
    // Debug logging
    console.log('📊 Module Coverage Debug:', {
      totalAssignments,
      allAssignments: allAssignments?.length,
      employeeLogs: employeeLogs?.length,
      approved,
      awaitingSignoff,
      inProgress,
      notStarted
    });
    
    return [
      { name: "Approved", value: approved, percentage: Math.round((approved / totalAssignments) * 100) },
      { name: "Awaiting Sign-Off", value: awaitingSignoff, percentage: Math.round((awaitingSignoff / totalAssignments) * 100) },
      { name: "In Progress", value: inProgress, percentage: Math.round((inProgress / totalAssignments) * 100) },
      { name: "Not Started", value: notStarted, percentage: Math.round((notStarted / totalAssignments) * 100) }
    ];
  }, [employeeLogs, allAssignments]);

  // NEW: Chart colors using professional color scheme
  const chartColors = {
    completions: 'hsl(217 91% 60%)', // Secondary blue
    signoffs: 'hsl(142 76% 36%)',    // Success green
    signedOff: '#22C55E',            // Green - Signed-off/Approved
    awaitingSignoff: '#F59E0B',      // Amber/Orange - Awaiting Sign-Off
    inProgress: '#3B82F6',           // Blue - In Progress
    notStarted: '#9CA3AF'            // Cool Gray - Not Started
  };

  // NEW: Employee coverage calculations
  const employeeCoverageStats = React.useMemo(() => {
    const totalEmployees = allActiveUsers?.length || 0;
    const employeesWithTraining = allAssignments ? new Set(allAssignments.map((a: any) => a.assigned_to)).size : 0;
    const coveragePercentage = totalEmployees > 0 ? Math.round((employeesWithTraining / totalEmployees) * 100) : 0;
    
    return {
      totalEmployees,
      employeesWithTraining,
      coveragePercentage
    };
  }, [allActiveUsers, allAssignments]);


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

        {/* Reimagined KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          {/* Training Completion Rate */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-lg transition-all duration-300 border-0 shadow-md relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-600">📊 Training Completion Rate</CardTitle>
              <CheckCircle className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-800">{summaryStats.completionRate}%</div>
              <div className="text-xs text-gray-500 mt-1">{summaryStats.totalCompletions} of {summaryStats.totalAssignments} completed</div>
            </CardContent>
            <div className="absolute bottom-2 right-2">
              <div className="group relative">
                <svg className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <div className="absolute bottom-6 right-0 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="font-semibold mb-1">Training Completion Rate</div>
                  <div className="mb-2">Percentage of all assigned trainings that are completed (with or without sign-off).</div>
                  <div className="mb-1"><strong>Formula:</strong></div>
                  <div className="mb-2">(Total Completions / Total Assignments) × 100</div>
                  <div className="mb-1"><strong>Purpose:</strong></div>
                  <div>Shows overall training progress efficiency — instantly tells how far the team has progressed.</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Sign-off Rate */}
          <Card className="bg-gradient-to-br from-green-50 to-green-100 hover:shadow-lg transition-all duration-300 border-0 shadow-md relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-600">✅ Sign-off Rate</CardTitle>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-800">{summaryStats.signoffRate}%</div>
              <div className="text-xs text-gray-500 mt-1">{summaryStats.withTrainerSignoff} of {summaryStats.totalCompletions} signed off</div>
            </CardContent>
            <div className="absolute bottom-2 right-2">
              <div className="group relative">
                <svg className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <div className="absolute bottom-6 right-0 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="font-semibold mb-1">Sign-off Rate</div>
                  <div className="mb-2">How many completed trainings have been approved by trainers.</div>
                  <div className="mb-1"><strong>Formula:</strong></div>
                  <div className="mb-2">(With Sign-Offs / Total Completions) × 100</div>
                  <div className="mb-1"><strong>Purpose:</strong></div>
                  <div>Shows how quickly trainers are verifying completed trainings (trainer responsiveness).</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Pending Approvals */}
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 hover:shadow-lg transition-all duration-300 border-0 shadow-md relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-600">⏳ Pending Approvals</CardTitle>
              <Clock className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-800">{summaryStats.pendingTrainerSignoff}</div>
              <div className="text-xs text-gray-500 mt-1">Awaiting Trainer Review</div>
            </CardContent>
            <div className="absolute bottom-2 right-2">
              <div className="group relative">
                <svg className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <div className="absolute bottom-6 right-0 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="font-semibold mb-1">Pending Approvals</div>
                  <div className="mb-2">Total completions awaiting trainer sign-off.</div>
                  <div className="mb-1"><strong>Purpose:</strong></div>
                  <div>Alerts trainers and managers to completions that need their immediate attention for approval.</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Unique Employees */}
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-lg transition-all duration-300 border-0 shadow-md relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-600">👥 Unique Employees</CardTitle>
              <Users className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-800">{summaryStats.uniqueEmployees}</div>
              <div className="text-xs text-gray-500 mt-1">- In Training System</div>
            </CardContent>
            <div className="absolute bottom-2 right-2">
              <div className="group relative">
                <svg className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <div className="absolute bottom-6 right-0 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="font-semibold mb-1">Unique Employees</div>
                  <div className="mb-2">Total number of different employees who have been assigned training.</div>
                  <div className="mb-1"><strong>Purpose:</strong></div>
                  <div>Shows training program reach — how many people are involved in the training system.</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Unique Modules */}
          <Card className="bg-gradient-to-br from-pink-50 to-pink-100 hover:shadow-lg transition-all duration-300 border-0 shadow-md relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-600">📚 Unique Modules</CardTitle>
              <BookOpen className="h-5 w-5 text-pink-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-pink-800">{summaryStats.uniqueModules}</div>
              <div className="text-xs text-gray-500 mt-1">Training Topics</div>
            </CardContent>
            <div className="absolute bottom-2 right-2">
              <div className="group relative">
                <svg className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <div className="absolute bottom-6 right-0 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="font-semibold mb-1">Unique Modules</div>
                  <div className="mb-2">Total number of different training modules that have been assigned.</div>
                  <div className="mb-1"><strong>Purpose:</strong></div>
                  <div>Shows training program breadth — how many different topics are covered in the training system.</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Chart Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Completion vs Sign-off Trends */}
          <Card className="shadow-md border-0">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Completion vs Sign-off Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                {monthlyTrendData.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm font-medium">No training data yet</p>
                      <p className="text-xs text-gray-400 mt-1">Complete some training to see trends</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrendData}>
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="completions" fill={chartColors.completions} name="Completions" />
                      <Bar dataKey="signoffs" fill={chartColors.signoffs} name="Sign-offs" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
        <div className="px-6 pb-4">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{backgroundColor: '#334155'}}></span>
              <span className="font-medium">🧾 Assigned Trainees:</span>
              <span className="font-bold" style={{color: '#334155'}}>{allAssignments?.length || 0}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{backgroundColor: '#9CA3AF'}}></span>
              <span className="font-medium">Not Started:</span>
              <span className="font-bold" style={{color: '#9CA3AF'}}>{moduleCoverageData.find(d => d.name === "Not Started")?.value || 0}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{backgroundColor: '#3B82F6'}}></span>
              <span className="font-medium">In Progress:</span>
              <span className="font-bold" style={{color: '#3B82F6'}}>{moduleCoverageData.find(d => d.name === "In Progress")?.value || 0}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{backgroundColor: '#F59E0B'}}></span>
              <span className="font-medium">Awaiting Sign-Off:</span>
              <span className="font-bold" style={{color: '#F59E0B'}}>{moduleCoverageData.find(d => d.name === "Awaiting Sign-Off")?.value || 0}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{backgroundColor: '#22C55E'}}></span>
              <span className="font-medium">Signed-off:</span>
              <span className="font-bold" style={{color: '#22C55E'}}>{moduleCoverageData.find(d => d.name === "Approved")?.value || 0}</span>
            </span>
          </div>
        </div>
          </Card>

          {/* Module Coverage */}
          <Card className="shadow-md border-0">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-green-600" />
                Module Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={moduleCoverageData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={65}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {moduleCoverageData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            entry.name === "Approved" ? chartColors.signedOff :
                            entry.name === "Awaiting Sign-Off" ? chartColors.awaitingSignoff :
                            entry.name === "In Progress" ? chartColors.inProgress :
                            chartColors.notStarted
                          } 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
            <div className="px-6 pb-4 text-center">
              <p className="text-sm text-gray-600 font-medium">
                💪 Training in progress — keep up the momentum!
              </p>
            </div>
          </Card>
        </div>

        {/* Employee Coverage Charts - Smaller rectangles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Total Employees */}
          <Card className="shadow-md border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Total Employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="mt-8 text-6xl font-bold text-blue-800 mb-10">
                  {employeeCoverageStats.totalEmployees}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  Active employees in system
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  👥 Based on active user accounts
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee Coverage */}
          <Card className="shadow-md border-0 relative">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Employee Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="mt-8 text-6xl font-bold text-green-800 mb-10">
                  {employeeCoverageStats.coveragePercentage}%
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {employeeCoverageStats.employeesWithTraining} of {employeeCoverageStats.totalEmployees} employees
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  👥 Employees with assigned training
                </div>
              </div>
            </CardContent>
            <div className="absolute bottom-2 right-2">
              <div className="group relative">
                <svg className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <div className="absolute bottom-6 right-0 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="font-semibold mb-1">Employee Coverage</div>
                  <div className="mb-2">Percentage of employees who have been assigned training.</div>
                  <div className="mb-1"><strong>Formula:</strong></div>
                  <div className="mb-2">Assignment Coverage = (Employees with Training ÷ Total Employees) × 100</div>
                  <div className="mb-1"><strong>Purpose:</strong></div>
                  <div className="mb-2">Measures training program reach across workforce.</div>
                  <div><strong>Benefit:</strong> Helps identify gaps in training distribution.</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Export Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Input
                  placeholder="Search employees, modules, lines, or categories..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-4 pr-10"
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
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Excel Format
                    </div>
                    <DropdownMenuItem onClick={handleExportExcel} className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Excel with Formatting
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportExcelWithSummary} className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Excel + Summary
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button 
                  onClick={() => refetch()} 
                  disabled={isLoading}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                
                {/* Removed Generate PDF button per request */}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collapsible Filter Panel */}
        <div className="mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader 
              className="pb-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Report Filters
                  <Badge variant="secondary" className="ml-2">
                    {[fromDate, toDate, selectedLine, selectedCategory, selectedModule].filter(f => f && f !== 'all').length} active
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation(); // Prevent triggering the header click
                      setFromDate('');
                      setToDate('');
                      setSelectedLine('');
                      setSelectedCategory('');
                      setSelectedModule('');
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Clear All
                  </Button>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    {isFiltersExpanded ? 'Collapse' : 'Expand'}
                    <ChevronDown className={`h-4 w-4 transition-transform ${isFiltersExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </div>
            </CardHeader>
            {!isFiltersExpanded && (
              <CardContent className="pt-0">
                <div className="text-sm text-gray-600">
                  {(() => {
                    const activeFilters = [];
                    if (fromDate || toDate) {
                      const dateRange = `${fromDate || 'Start'} to ${toDate || 'End'}`;
                      activeFilters.push(`Date: ${dateRange}`);
                    }
                    if (selectedLine && selectedLine !== 'all') {
                      const lineName = lines?.find(l => l.id === selectedLine)?.name || 'Selected Line';
                      activeFilters.push(`Line: ${lineName}`);
                    }
                    if (selectedCategory && selectedCategory !== 'all') {
                      const categoryName = categories?.find(c => c.id === selectedCategory)?.name || 'Selected Category';
                      activeFilters.push(`Category: ${categoryName}`);
                    }
                    if (selectedModule && selectedModule !== 'all') {
                      const moduleName = modules?.find(m => m.id === selectedModule)?.title || 'Selected Module';
                      activeFilters.push(`Module: ${moduleName}`);
                    }
                    return activeFilters.length > 0 ? `Active filters: ${activeFilters.join(', ')}` : 'No filters applied - click Expand to configure filters';
                  })()}
                </div>
              </CardContent>
            )}
            {isFiltersExpanded && (
              <CardContent className="space-y-6">
              {/* Date Range Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    Date Range
                  </h4>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFromDate('');
                        setToDate('');
                      }}
                      className={!fromDate && !toDate ? "bg-blue-100 border-blue-300 text-blue-800 shadow-md ring-2 ring-blue-200" : ""}
                    >
                      All Time
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const today = new Date();
                        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
                        setFromDate(lastMonth.toISOString().split('T')[0]);
                        setToDate(today.toISOString().split('T')[0]);
                      }}
                      className={(() => {
                        if (!fromDate || !toDate) return "";
                        const today = new Date();
                        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
                        const isLast30Days = fromDate === lastMonth.toISOString().split('T')[0] && toDate === today.toISOString().split('T')[0];
                        return isLast30Days ? "bg-blue-100 border-blue-300 text-blue-800 shadow-md ring-2 ring-blue-200" : "";
                      })()}
                    >
                      Last 30 Days
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const today = new Date();
                        const last3Months = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
                        setFromDate(last3Months.toISOString().split('T')[0]);
                        setToDate(today.toISOString().split('T')[0]);
                      }}
                      className={(() => {
                        if (!fromDate || !toDate) return "";
                        const today = new Date();
                        const last3Months = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
                        const isLast3Months = fromDate === last3Months.toISOString().split('T')[0] && toDate === today.toISOString().split('T')[0];
                        return isLast3Months ? "bg-blue-100 border-blue-300 text-blue-800 shadow-md ring-2 ring-blue-200" : "";
                      })()}
                    >
                      Last 3 Months
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const today = new Date();
                        const thisYear = new Date(today.getFullYear(), 0, 1);
                        setFromDate(thisYear.toISOString().split('T')[0]);
                        setToDate(today.toISOString().split('T')[0]);
                      }}
                      className={(() => {
                        if (!fromDate || !toDate) return "";
                        const today = new Date();
                        const thisYear = new Date(today.getFullYear(), 0, 1);
                        const isThisYear = fromDate === thisYear.toISOString().split('T')[0] && toDate === today.toISOString().split('T')[0];
                        return isThisYear ? "bg-blue-100 border-blue-300 text-blue-800 shadow-md ring-2 ring-blue-200" : "";
                      })()}
                    >
                      This Year
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Custom Dates</h4>
                  <div className="flex gap-2">
                    <Popover open={fromDateOpen} onOpenChange={setFromDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`w-full justify-start text-left font-normal ${!fromDate ? 'text-muted-foreground' : ''}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {fromDate ? formatDate(parseDate(fromDate)) : "From Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={parseDate(fromDate)}
                          onSelect={(date) => {
                            setFromDate(formatDate(date));
                            setFromDateOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <Popover open={toDateOpen} onOpenChange={setToDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`w-full justify-start text-left font-normal ${!toDate ? 'text-muted-foreground' : ''}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {toDate ? formatDate(parseDate(toDate)) : "To Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={parseDate(toDate)}
                          onSelect={(date) => {
                            setToDate(formatDate(date));
                            setToDateOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    
                    {(fromDate || toDate) && (
                      <Button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFromDate('');
                          setToDate('');
                        }} 
                        variant="outline"
                        size="sm"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Report Scope Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Production Line
                  </label>
                  <Select value={selectedLine || undefined} onValueChange={setSelectedLine}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Lines" />
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

                <div>
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Category
                  </label>
                  <Select value={selectedCategory || undefined} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Categories" />
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

                <div>
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    Module
                  </label>
                  <Select value={selectedModule || undefined} onValueChange={setSelectedModule}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Modules" />
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
              </div>

              {/* Active Filters Summary */}
              <div className="pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  {(() => {
                    const activeFilters = [];
                    if (search) activeFilters.push(`Search: "${search}"`);
                    if (fromDate || toDate) {
                      const dateRange = `${fromDate || 'Start'} to ${toDate || 'End'}`;
                      activeFilters.push(`Date: ${dateRange}`);
                    }
                    if (selectedLine && selectedLine !== 'all') {
                      const lineName = lines?.find(l => l.id === selectedLine)?.name || 'Selected Line';
                      activeFilters.push(`Line: ${lineName}`);
                    }
                    if (selectedCategory && selectedCategory !== 'all') {
                      const categoryName = categories?.find(c => c.id === selectedCategory)?.name || 'Selected Category';
                      activeFilters.push(`Category: ${categoryName}`);
                    }
                    if (selectedModule && selectedModule !== 'all') {
                      const moduleName = modules?.find(m => m.id === selectedModule)?.title || 'Selected Module';
                      activeFilters.push(`Module: ${moduleName}`);
                    }
                    return activeFilters.length > 0 ? `Active filters: ${activeFilters.join(', ')}` : 'No filters applied - showing all data';
                  })()}
                </div>
              </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Reports Table */}
        <Card>
          <CardHeader 
            className="pb-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setIsCompletionsExpanded(!isCompletionsExpanded)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                Training Completions
                <Badge variant="secondary" className="ml-2">
                  {employeeLogs?.length || 0} records
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                {employeeLogs && employeeLogs.length > completionsPerPage && (
                  <div className="text-sm text-gray-500">
                    Page {completionsPage} of {totalPages}
                  </div>
                )}
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  {isCompletionsExpanded ? 'Collapse' : 'Expand'}
                  {isCompletionsExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          {isCompletionsExpanded && (
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
                    {paginatedCompletions.map((row: any) => (
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
                          {formatDateForDisplay(row.completed_at)}
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
              
              {/* Pagination Controls */}
              {employeeLogs && employeeLogs.length > completionsPerPage && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    Showing {((completionsPage - 1) * completionsPerPage) + 1} to {Math.min(completionsPage * completionsPerPage, employeeLogs.length)} of {employeeLogs.length} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCompletionsPage(1);
                      }}
                      disabled={completionsPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCompletionsPage(prev => Math.max(1, prev - 1));
                      }}
                      disabled={completionsPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(totalPages - 4, completionsPage - 2)) + i;
                        if (pageNum > totalPages) return null;
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === completionsPage ? "default" : "outline"}
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCompletionsPage(pageNum);
                            }}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCompletionsPage(prev => Math.min(totalPages, prev + 1));
                      }}
                      disabled={completionsPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCompletionsPage(totalPages);
                      }}
                      disabled={completionsPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}