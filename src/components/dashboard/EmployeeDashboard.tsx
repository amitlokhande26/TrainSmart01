import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, BookOpen, Award, Clock, CheckCircle } from 'lucide-react';
import { TrainingLineSelector } from './TrainingLineSelector';
import { TrainingModuleView } from './TrainingModuleView';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EmployeeDashboardProps {
  userName: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  status: 'not-started' | 'in-progress' | 'completed';
  completedAt?: string;
  completedBy?: string;
}

export interface TrainingCategory {
  id: string;
  name: string;
  modules: TrainingModule[];
}

export interface ProductionLine {
  id: string;
  name: string;
  categories: TrainingCategory[];
}

const mockData: ProductionLine[] = [
  {
    id: 'canning-1',
    name: 'Canning Line 1',
    categories: [
      {
        id: 'qa',
        name: 'QA Training',
        modules: [
          {
            id: 'qa-basics',
            title: 'Quality Assurance Fundamentals',
            description: 'Learn the basics of quality control and inspection procedures',
            duration: '45 min',
            status: 'completed',
            completedAt: '15/01/2024',
            completedBy: 'John Doe'
          },
          {
            id: 'inspection',
            title: 'Visual Inspection Standards',
            description: 'Master visual inspection techniques for canning operations',
            duration: '30 min',
            status: 'in-progress'
          }
        ]
      },
      {
        id: 'plw',
        name: 'PLW Training',
        modules: [
          {
            id: 'plw-safety',
            title: 'Production Line Worker Safety',
            description: 'Essential safety protocols for production line operations',
            duration: '60 min',
            status: 'not-started'
          }
        ]
      },
      {
        id: 'supervisor',
        name: 'Supervisor Training',
        modules: [
          {
            id: 'leadership',
            title: 'Team Leadership Essentials',
            description: 'Develop leadership skills for effective team management',
            duration: '90 min',
            status: 'not-started'
          }
        ]
      }
    ]
  },
  {
    id: 'canning-2',
    name: 'Canning Line 2',
    categories: [
      {
        id: 'qa',
        name: 'QA Training',
        modules: [
          {
            id: 'hot-water-test',
            title: 'Hot Water Pressure Test',
            description: 'Learn proper procedures for conducting hot water can pressure tests',
            duration: '35 min',
            status: 'not-started'
          }
        ]
      },
      {
        id: 'plw',
        name: 'PLW Training',
        modules: []
      },
      {
        id: 'supervisor',
        name: 'Supervisor Training',
        modules: []
      }
    ]
  },
  {
    id: 'kegging',
    name: 'Kegging Line',
    categories: [
      {
        id: 'qa',
        name: 'QA Training',
        modules: []
      },
      {
        id: 'plw',
        name: 'PLW Training',
        modules: []
      },
      {
        id: 'supervisor',
        name: 'Supervisor Training',
        modules: []
      }
    ]
  },
  {
    id: 'bottling-1',
    name: 'Bottling Line 1',
    categories: [
      {
        id: 'qa',
        name: 'QA Training',
        modules: []
      },
      {
        id: 'plw',
        name: 'PLW Training',
        modules: []
      },
      {
        id: 'supervisor',
        name: 'Supervisor Training',
        modules: []
      }
    ]
  },
  {
    id: 'bottling-2',
    name: 'Bottling Line 2',
    categories: [
      {
        id: 'qa',
        name: 'QA Training',
        modules: []
      },
      {
        id: 'plw',
        name: 'PLW Training',
        modules: []
      },
      {
        id: 'supervisor',
        name: 'Supervisor Training',
        modules: []
      }
    ]
  },
  {
    id: 'general',
    name: 'General Training',
    categories: [
      {
        id: 'safety',
        name: 'Safety Training',
        modules: [
          {
            id: 'general-safety',
            title: 'Workplace Safety Fundamentals',
            description: 'Essential safety protocols for all employees',
            duration: '60 min',
            status: 'completed',
            completedAt: '10/01/2024',
            completedBy: 'John Doe'
          }
        ]
      },
      {
        id: 'compliance',
        name: 'Compliance Training',
        modules: []
      },
      {
        id: 'orientation',
        name: 'New Employee Orientation',
        modules: []
      }
    ]
  }
];

export function EmployeeDashboard({ userName }: EmployeeDashboardProps) {
  const [selectedLine, setSelectedLine] = useState<ProductionLine | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TrainingCategory | null>(null);
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);

  // Load assigned modules for the current user
  const { data: sessionData } = useQuery({
    queryKey: ['session'],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });

  const userId = sessionData?.user?.id;

  const { data: assignments, refetch: refetchAssignments } = useQuery({
    queryKey: ['my-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('id,status,due_date,module:modules(id,title,storage_path,type,version)')
        .eq('assigned_to', userId as any)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const totalAssigned = assignments?.length || 0;
  const completedAssigned = assignments?.filter((a: any) => a.status === 'completed').length || 0;
  const progressAssigned = totalAssigned > 0 ? (completedAssigned / totalAssigned) * 100 : 0;

  const markComplete = async (assignment: any) => {
    try {
      const signedName = userName;
      const signedEmail = sessionData?.user?.email || '';
      // Insert completion
      const { data: c, error: cErr } = await supabase
        .from('completions')
        .insert({ assignment_id: assignment.id })
        .select('id')
        .single();
      if (cErr) throw cErr;
      // Insert signature snapshot
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
      const { error: sErr } = await supabase.from('signatures').insert({
        completion_id: c.id,
        signer_user_id: userId,
        signed_name_snapshot: signedName,
        signed_email_snapshot: signedEmail,
        user_agent: ua,
      });
      if (sErr) throw sErr;
      // Update assignment status
      await supabase.from('assignments').update({ status: 'completed' }).eq('id', assignment.id);
      await refetchAssignments();
    } catch (e) {
      // no-op minimal handling
    }
  };

  // Calculate overall progress (prefer live assignments if present, else mock)
  const usingLive = totalAssigned > 0;
  const totalModules = usingLive
    ? totalAssigned
    : mockData.reduce((acc, line) => acc + line.categories.reduce((catAcc, cat) => catAcc + cat.modules.length, 0), 0);
  const completedModules = usingLive
    ? completedAssigned
    : mockData.reduce((acc, line) => acc + line.categories.reduce((catAcc, cat) => catAcc + cat.modules.filter(module => module.status === 'completed').length, 0), 0);
  const progressPercentage = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

  if (selectedModule) {
    return (
      <TrainingModuleView
        module={selectedModule}
        userName={userName}
        onBack={() => setSelectedModule(null)}
        onComplete={(completedBy, completedAt) => {
          // Update module status
          setSelectedModule(null);
        }}
      />
    );
  }

  if (selectedCategory) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-primary hover:text-primary-hover font-medium text-sm mb-2"
            >
              ← Back to {selectedLine?.name}
            </button>
            <h1 className="text-3xl font-bold text-foreground">{selectedCategory.name}</h1>
            <p className="text-muted-foreground mt-1">
              {selectedLine?.name} • {selectedCategory.modules.length} modules available
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {selectedCategory.modules.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Modules Available</h3>
                <p className="text-sm text-muted-foreground">
                  Training modules for this category are being prepared. Check back soon!
                </p>
              </CardContent>
            </Card>
          ) : (
            selectedCategory.modules.map((module) => (
              <Card key={module.id} className="hover:shadow-card transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{module.title}</h3>
                        <Badge variant={
                          module.status === 'completed' ? 'default' :
                          module.status === 'in-progress' ? 'secondary' : 'outline'
                        }>
                          {module.status === 'completed' ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Completed</>
                          ) : module.status === 'in-progress' ? (
                            <><Clock className="h-3 w-3 mr-1" /> In Progress</>
                          ) : (
                            'Not Started'
                          )}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm mb-3">{module.description}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Duration: {module.duration}</span>
                        {module.completedAt && (
                          <span>Completed: {module.completedAt}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => setSelectedModule(module)}
                      variant={module.status === 'completed' ? 'outline' : 'default'}
                    >
                      {module.status === 'completed' ? 'Review' : 'Start'}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  if (selectedLine) {
    return (
      <TrainingLineSelector
        line={selectedLine}
        onBack={() => setSelectedLine(null)}
        onSelectCategory={setSelectedCategory}
      />
    );
  }

  // If live assignments are available, show a simple assigned list UI first
  if (usingLive) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-card rounded-lg p-6 shadow-card">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, {userName}!</h1>
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">{completedAssigned}/{totalAssigned} modules completed</span>
            </div>
            <Progress value={progressAssigned} className="h-2" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My Assigned Modules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(assignments || []).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <div className="font-semibold">{a.module?.title}</div>
                  <div className="text-xs text-muted-foreground">v{a.module?.version}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.status === 'completed' ? 'default' : a.status === 'in_progress' ? 'secondary' : 'outline'}>
                    {a.status}
                  </Badge>
                  <Button variant="outline" onClick={async () => {
                    const path = a.module?.storage_path as string;
                    if (!path) return;
                    // Signed URL via storage API
                    const { data, error } = await supabase.storage.from('training-materials').createSignedUrl(path, 300);
                    if (error) return;
                    if (data?.signedUrl) {
                      // Use fetch then blob to avoid popup blockers and referrer issues
                      const res = await fetch(data.signedUrl);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                      setTimeout(() => URL.revokeObjectURL(url), 30000);
                    }
                  }}>Open</Button>
                  {a.status !== 'completed' && (
                    <Button onClick={() => markComplete(a)}>Mark Complete</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-card rounded-lg p-6 shadow-card">
        <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, {userName}!</h1>
        <p className="text-muted-foreground text-lg">Continue your training journey and enhance your skills.</p>
        
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">{completedModules}/{totalModules} modules completed</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <Award className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-success">{completedModules}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-warning">
                  {mockData.reduce((acc, line) => 
                    acc + line.categories.reduce((catAcc, cat) => 
                      catAcc + cat.modules.filter(module => module.status === 'in-progress').length, 0
                    ), 0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-2xl font-bold text-primary">{totalModules}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Production Lines */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Training Areas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockData.map((line) => {
            const lineModules = line.categories.reduce((acc, cat) => acc + cat.modules.length, 0);
            const completedInLine = line.categories.reduce((acc, cat) => 
              acc + cat.modules.filter(module => module.status === 'completed').length, 0
            );
            const lineProgress = lineModules > 0 ? (completedInLine / lineModules) * 100 : 0;

            return (
              <Card key={line.id} className="hover:shadow-card transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{line.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{Math.round(lineProgress)}%</span>
                    </div>
                    <Progress value={lineProgress} className="h-2" />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{lineModules} modules</span>
                      <span>{line.categories.length} categories</span>
                    </div>
                    <Button 
                      className="w-full mt-3" 
                      variant="outline"
                      onClick={() => setSelectedLine(line)}
                    >
                      View Training
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}