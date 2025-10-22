import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDateForDisplay } from '@/utils/dateFormat';
import { Search, FileText, User, Calendar, Filter, Download } from 'lucide-react';

export default function AdminAuditLogs() {
  const [name, setName] = useState<string>('Admin');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [isPayloadOpen, setIsPayloadOpen] = useState(false);

  React.useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (u) {
        const { data: userData } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', u.id)
          .single();
        
        if (userData && userData.first_name && userData.last_name) {
          setName(`${userData.first_name} ${userData.last_name}`);
        } else {
          const display = (u?.user_metadata as any)?.full_name || u?.email || 'Admin';
          setName(display);
        }
      }
    });
  }, []);

  const { data: auditLogs = [], isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', actionFilter, entityFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select(`
          id,
          action,
          entity,
          entity_id,
          payload,
          created_at,
          actor_user:actor_user_id (
            id,
            first_name,
            last_name,
            email,
            role
          )
        `)
        .order('created_at', { ascending: false })
        .limit(1000);

      // Apply filters
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }
      if (entityFilter !== 'all') {
        query = query.eq('entity', entityFilter);
      }
      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        // Add one day to include the entire end date
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt('created_at', endDate.toISOString());
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching audit logs:', error);
        throw error;
      }
      
      return data || [];
    }
  });

  // Filter by search term (client-side for user names/emails)
  const filteredLogs = auditLogs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const actorName = log.actor_user 
      ? `${log.actor_user.first_name} ${log.actor_user.last_name}`.toLowerCase()
      : 'system';
    const actorEmail = log.actor_user?.email?.toLowerCase() || '';
    const entity = log.entity.toLowerCase();
    const action = log.action.toLowerCase();
    
    return actorName.includes(search) || 
           actorEmail.includes(search) || 
           entity.includes(search) ||
           action.includes(search) ||
           log.entity_id?.includes(search);
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'bg-green-100 text-green-800 border-green-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEntityColor = (entity: string) => {
    switch (entity) {
      case 'modules': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'assignments': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'users': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completions': return 'bg-green-100 text-green-800 border-green-200';
      case 'trainer_signoffs': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Email', 'Role', 'Action', 'Entity', 'Entity ID'];
    const rows = filteredLogs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.actor_user ? `${log.actor_user.first_name} ${log.actor_user.last_name}` : 'System',
      log.actor_user?.email || 'N/A',
      log.actor_user?.role || 'system',
      log.action,
      log.entity,
      log.entity_id || 'N/A'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('all');
    setEntityFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header userType="admin" userName={name} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Audit Logs</h2>
            <p className="text-muted-foreground">Track all system activities and changes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Logs</p>
                  <p className="text-2xl font-bold">{filteredLogs.length}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Inserts</p>
                  <p className="text-2xl font-bold text-green-600">
                    {filteredLogs.filter(l => l.action === 'INSERT').length}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600 font-bold">+</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Updates</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {filteredLogs.filter(l => l.action === 'UPDATE').length}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-bold">↻</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Deletes</p>
                  <p className="text-2xl font-bold text-red-600">
                    {filteredLogs.filter(l => l.action === 'DELETE').length}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-red-600 font-bold">×</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-1 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search user, email, entity..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Action Filter */}
              <div>
                <label className="text-sm font-medium mb-1 block">Action</label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="INSERT">Insert</SelectItem>
                    <SelectItem value="UPDATE">Update</SelectItem>
                    <SelectItem value="DELETE">Delete</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Entity Filter */}
              <div>
                <label className="text-sm font-medium mb-1 block">Entity</label>
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    <SelectItem value="modules">Modules</SelectItem>
                    <SelectItem value="assignments">Assignments</SelectItem>
                    <SelectItem value="users">Users</SelectItem>
                    <SelectItem value="completions">Completions</SelectItem>
                    <SelectItem value="trainer_signoffs">Sign-offs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="md:col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">From Date</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">To Date</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              {/* Clear Filters */}
              <div className="md:col-span-3 flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Log ({filteredLogs.length} entries)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading audit logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No audit logs found matching your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-semibold">Timestamp</th>
                      <th className="text-left p-3 text-sm font-semibold">User</th>
                      <th className="text-left p-3 text-sm font-semibold">Action</th>
                      <th className="text-left p-3 text-sm font-semibold">Entity</th>
                      <th className="text-left p-3 text-sm font-semibold">Entity ID</th>
                      <th className="text-left p-3 text-sm font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{formatDateForDisplay(log.created_at)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              {log.actor_user ? (
                                <>
                                  <div className="font-medium">
                                    {log.actor_user.first_name} {log.actor_user.last_name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {log.actor_user.email}
                                  </div>
                                  <Badge variant="outline" className="text-xs mt-1">
                                    {log.actor_user.role}
                                  </Badge>
                                </>
                              ) : (
                                <span className="text-muted-foreground italic">System</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge className={`${getActionColor(log.action)} border`}>
                            {log.action}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge className={`${getEntityColor(log.entity)} border`}>
                            {log.entity}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm">
                          <code className="bg-muted px-2 py-1 rounded text-xs">
                            {log.entity_id ? log.entity_id.substring(0, 8) + '...' : 'N/A'}
                          </code>
                        </td>
                        <td className="p-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedLog(log);
                              setIsPayloadOpen(true);
                            }}
                          >
                            View Payload
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payload Modal */}
        <Dialog open={isPayloadOpen} onOpenChange={setIsPayloadOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Audit Log Details</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold">Timestamp</label>
                    <p className="text-sm">{new Date(selectedLog.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">User</label>
                    <p className="text-sm">
                      {selectedLog.actor_user 
                        ? `${selectedLog.actor_user.first_name} ${selectedLog.actor_user.last_name} (${selectedLog.actor_user.email})`
                        : 'System'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Action</label>
                    <p className="text-sm">
                      <Badge className={getActionColor(selectedLog.action)}>
                        {selectedLog.action}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Entity</label>
                    <p className="text-sm">
                      <Badge className={getEntityColor(selectedLog.entity)}>
                        {selectedLog.entity}
                      </Badge>
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-semibold">Entity ID</label>
                    <p className="text-sm font-mono bg-muted p-2 rounded">
                      {selectedLog.entity_id || 'N/A'}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold">Payload (JSON)</label>
                  <pre className="mt-2 bg-muted p-4 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

