import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, BookOpen, Users, Award } from 'lucide-react';
import { ProductionLine, TrainingCategory } from './EmployeeDashboard';

interface TrainingLineSelectorProps {
  line: ProductionLine;
  onBack: () => void;
  onSelectCategory: (category: TrainingCategory) => void;
}

export function TrainingLineSelector({ line, onBack, onSelectCategory }: TrainingLineSelectorProps) {
  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'qa':
        return <Award className="h-5 w-5" />;
      case 'plw':
        return <Users className="h-5 w-5" />;
      case 'supervisor':
        return <BookOpen className="h-5 w-5" />;
      default:
        return <BookOpen className="h-5 w-5" />;
    }
  };

  const getCategoryColor = (categoryId: string) => {
    switch (categoryId) {
      case 'qa':
        return 'text-accent';
      case 'plw':
        return 'text-secondary';
      case 'supervisor':
        return 'text-primary';
      default:
        return 'text-primary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-primary hover:text-primary-hover font-medium text-sm mb-2"
          >
            ← Back to Training Areas
          </button>
          <h1 className="text-3xl font-bold text-foreground">{line.name}</h1>
          <p className="text-muted-foreground mt-1">Select a training category to begin</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {line.categories.map((category) => {
          const totalModules = category.modules.length;
          const completedModules = category.modules.filter(module => module.status === 'completed').length;
          const inProgressModules = category.modules.filter(module => module.status === 'in-progress').length;
          const progress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

          return (
            <Card key={category.id} className="hover:shadow-card transition-shadow cursor-pointer">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 bg-current/10 rounded-lg ${getCategoryColor(category.id)}`}>
                    {getCategoryIcon(category.id)}
                  </div>
                  <CardTitle className="text-xl">{category.name}</CardTitle>
                </div>
                
                {totalModules > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Module Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-semibold text-success">{completedModules}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-warning">{inProgressModules}</p>
                      <p className="text-xs text-muted-foreground">In Progress</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-primary">{totalModules}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex justify-center">
                    {totalModules === 0 ? (
                      <Badge variant="outline" className="text-xs">
                        Coming Soon
                      </Badge>
                    ) : completedModules === totalModules ? (
                      <Badge variant="default" className="text-xs bg-success">
                        All Complete
                      </Badge>
                    ) : inProgressModules > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        In Progress
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Ready to Start
                      </Badge>
                    )}
                  </div>

                  {/* Action Button */}
                  <Button 
                    className="w-full" 
                    variant={totalModules === 0 ? 'outline' : 'default'}
                    disabled={totalModules === 0}
                    onClick={() => onSelectCategory(category)}
                  >
                    {totalModules === 0 ? 'Coming Soon' : 'View Modules'}
                    {totalModules > 0 && <ChevronRight className="h-4 w-4 ml-1" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Line Overview */}
      <Card className="bg-gradient-card">
        <CardHeader>
          <CardTitle>Training Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">
                {line.categories.length}
              </p>
              <p className="text-sm text-muted-foreground">Categories</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                {line.categories.reduce((acc, cat) => acc + cat.modules.length, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Modules</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success">
                {line.categories.reduce((acc, cat) => 
                  acc + cat.modules.filter(module => module.status === 'completed').length, 0
                )}
              </p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">
                {line.categories.reduce((acc, cat) => 
                  acc + cat.modules.filter(module => module.status === 'in-progress').length, 0
                )}
              </p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}