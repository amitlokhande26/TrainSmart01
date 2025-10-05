import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, FileText, Calendar } from 'lucide-react';
import { TrainingModule } from './EmployeeDashboard';
import { getCurrentDateDDMMYYYY } from '@/utils/dateFormat';

interface TrainingModuleViewProps {
  module: TrainingModule;
  userName: string;
  onBack: () => void;
  onComplete: (completedBy: string, completedAt: string) => void;
}

export function TrainingModuleView({ module, userName, onBack, onComplete }: TrainingModuleViewProps) {
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signature, setSignature] = useState('');
  const [completionDate, setCompletionDate] = useState('');

  const handleCompleteTraining = () => {
    if (module.status !== 'completed') {
      // Set default values
      setSignature(userName);
      setCompletionDate(getCurrentDateDDMMYYYY());
      setShowSignatureDialog(true);
    }
  };

  const handleSignatureSubmit = () => {
    if (signature && completionDate) {
      onComplete(signature, completionDate);
      setShowSignatureDialog(false);
    }
  };

  // Mock training content based on module
  const getTrainingContent = () => {
    if (module.id === 'hot-water-test') {
      return (
        <div className="space-y-6">
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
            <h3 className="font-semibold text-warning mb-2">Important Safety Notice</h3>
            <p className="text-sm">
              Cans might explode due to high pressure testing. While testing if the water is still hot, 
              don't put your hands inside - wait until the temperature has reduced.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Purpose</h3>
            <p className="text-muted-foreground">
              We must do a can pressure test with hot water to ensure there are no leaks with the seam 
              after the can has been pressurized. This test must be done within every 1 hour and/or with every seam check.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Required Equipment</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Red Bucket</li>
              <li>Hot water – temperature must be above 50 degrees Celsius</li>
              <li>PPE must be worn</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Testing Procedure</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium">Prepare Hot Water</p>
                  <p className="text-sm text-muted-foreground">
                    Grab a bucket with a handle. Fill a bucket up to halfway with hot water using the tap 
                    next to the hand washing basin behind CL1. The water collected should be approximately 50-55°C.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium">Collect Test Cans</p>
                  <p className="text-sm text-muted-foreground">
                    For CL2 grab four cans, one from each seam head off the line and number each can to the head. 
                    Can 1 should be from seam head 1, can 2 from seam head 2 and so on. For CL1 grab 2 consecutive cans.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium">Immerse Cans</p>
                  <p className="text-sm text-muted-foreground">
                    Place the bucket in a safe location where it will be untouched and carefully place cans 
                    upside down into bucket of hot water.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                  4
                </div>
                <div>
                  <p className="font-medium">Wait and Remove</p>
                  <p className="text-sm text-muted-foreground">
                    After ten (10) minutes remove the cans from the bucket. Be careful as the water will still be warm.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                  5
                </div>
                <div>
                  <p className="font-medium">Inspect for Damage</p>
                  <p className="text-sm text-muted-foreground">
                    Thoroughly check cans to ensure they are not damaged or leaking. Look for any bubble 
                    forming around the edge of the seams.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                  6
                </div>
                <div>
                  <p className="font-medium">Final Pressure Test</p>
                  <p className="text-sm text-muted-foreground">
                    Hold one of the cans so that the lid is just under the warm water. Squeeze the can and 
                    watch for any bubbles coming from the seams. Repeat for the other 3 cans.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Default content for other modules
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">Module Overview</h3>
          <p className="text-muted-foreground">{module.description}</p>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-6 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">Content Loading</h3>
          <p className="text-sm text-muted-foreground">
            Training content for this module is being prepared and will be available soon.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-primary hover:text-primary-hover font-medium text-sm mb-2"
          >
            ← Back to Modules
          </button>
          <h1 className="text-3xl font-bold text-foreground">{module.title}</h1>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{module.duration}</span>
            </div>
            <Badge variant={
              module.status === 'completed' ? 'default' :
              module.status === 'in-progress' ? 'secondary' : 'outline'
            }>
              {module.status === 'completed' ? (
                <><CheckCircle className="h-3 w-3 mr-1" /> Completed</>
              ) : module.status === 'in-progress' ? (
                'In Progress'
              ) : (
                'Not Started'
              )}
            </Badge>
          </div>
        </div>
      </div>

      {/* Training Content */}
      <Card>
        <CardHeader>
          <CardTitle>Training Material</CardTitle>
        </CardHeader>
        <CardContent>
          {getTrainingContent()}
        </CardContent>
      </Card>

      {/* Completion Section */}
      {module.status === 'completed' ? (
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-success" />
              <h3 className="text-lg font-semibold text-success">Training Completed</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Completed by:</span>
                <p className="font-medium">{module.completedBy}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Completed on:</span>
                <p className="font-medium">{module.completedAt}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold">Ready to Complete Training?</h3>
              <p className="text-muted-foreground">
                Once you've reviewed all the training material above, click below to mark this module as completed.
              </p>
              <Button onClick={handleCompleteTraining} size="lg" className="px-8">
                Complete Training Module
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signature Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Training Completion Acknowledgment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please confirm your completion of the training module by providing your signature and completion date.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="signature">Full Name (Digital Signature)</Label>
              <Input
                id="signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="completionDate">Completion Date (DDMMYYYY)</Label>
              <Input
                id="completionDate"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                placeholder="17012024"
                maxLength={8}
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowSignatureDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSignatureSubmit}
                disabled={!signature || !completionDate}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Confirm Completion
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}