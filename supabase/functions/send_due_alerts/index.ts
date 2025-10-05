import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { formatDateForDisplay } from '../../utils/dateFormat.ts';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DueAlertData {
  assignmentId: string;
  traineeName: string;
  traineeEmail: string;
  trainerName: string;
  trainerEmail: string;
  moduleTitle: string;
  moduleVersion: string;
  dueDate: string;
  daysRemaining: number;
  lineName: string;
  currentStatus: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get assignments that are due in 4 days or 1 day
    const today = new Date();
    const fourDaysFromNow = new Date(today);
    fourDaysFromNow.setDate(today.getDate() + 4);
    
    const oneDayFromNow = new Date(today);
    oneDayFromNow.setDate(today.getDate() + 1);

    // Query assignments with due dates
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select(`
        id,
        due_date,
        status,
        assigned_to,
        trainer_user_id,
        module_id,
        modules!inner(
          title,
          version,
          line_id,
          lines!inner(name)
        )
      `)
      .not('due_date', 'is', null)
      .in('status', ['assigned', 'in_progress']);

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      throw assignmentsError;
    }

    if (!assignments || assignments.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No assignments found for due alerts',
          emailsSent: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Filter assignments that are due in 4 days or 1 day
    const alertAssignments = assignments.filter(assignment => {
      if (!assignment.due_date) return false;
      
      const dueDate = new Date(assignment.due_date);
      const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return daysDiff === 4 || daysDiff === 1;
    });

    if (alertAssignments.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No assignments due for alerts today',
          emailsSent: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user details for all assignments
    const userIds = [
      ...new Set(alertAssignments.map(a => a.assigned_to)),
      ...new Set(alertAssignments.map(a => a.trainer_user_id).filter(Boolean))
    ];

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', userIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    const usersMap = new Map(users?.map(u => [u.id, u]) || []);

    let emailsSent = 0;
    const emailResults = [];

    // Process each assignment
    for (const assignment of alertAssignments) {
      try {
        const trainee = usersMap.get(assignment.assigned_to);
        const trainer = usersMap.get(assignment.trainer_user_id);

        if (!trainee || !trainer) {
          console.warn(`Missing user data for assignment ${assignment.id}`);
          continue;
        }

        const dueDate = new Date(assignment.due_date);
        const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        const alertType = daysDiff === 4 ? '4 Days Remaining' : '1 Day Remaining';
        
        // Prepare data for email templates
        const emailData: DueAlertData = {
          assignmentId: assignment.id,
          traineeName: `${trainee.first_name} ${trainee.last_name}`,
          traineeEmail: trainee.email,
          trainerName: `${trainer.first_name} ${trainer.last_name}`,
          trainerEmail: trainer.email,
          moduleTitle: assignment.modules.title,
          moduleVersion: assignment.modules.version,
          dueDate: formatDateForDisplay(dueDate),
          daysRemaining: daysDiff.toString(),
          lineName: assignment.modules.lines.name,
          currentStatus: assignment.status === 'in_progress' ? 'In Progress' : 'Not Started'
        };

        // Send email to trainee
        const traineeEmailResult = await sendEmail('due-alert-trainee', {
          to: trainee.email,
          subject: `Training Due Alert: ${assignment.modules.title} - ${alertType}`,
          variables: {
            trainee_name: emailData.traineeName,
            trainer_name: emailData.trainerName,
            module_title: emailData.moduleTitle,
            module_version: emailData.moduleVersion,
            due_date: emailData.dueDate,
            days_remaining: emailData.daysRemaining,
            line_name: emailData.lineName,
            current_status: emailData.currentStatus,
            alert_type: alertType,
            login_url: `${Deno.env.get('SITE_URL')}/employee`
          }
        });

        // Send email to trainer
        const trainerEmailResult = await sendEmail('due-alert-trainer', {
          to: trainer.email,
          subject: `Trainer Alert: ${assignment.modules.title} - ${alertType}`,
          variables: {
            trainer_name: emailData.trainerName,
            trainee_name: emailData.traineeName,
            module_title: emailData.moduleTitle,
            module_version: emailData.moduleVersion,
            due_date: emailData.dueDate,
            days_remaining: emailData.daysRemaining,
            line_name: emailData.lineName,
            current_status: emailData.currentStatus,
            alert_type: alertType,
            login_url: `${Deno.env.get('SITE_URL')}/supervisor`
          }
        });

        if (traineeEmailResult.success && trainerEmailResult.success) {
          emailsSent += 2;
          emailResults.push({
            assignmentId: assignment.id,
            trainee: { email: trainee.email, success: true },
            trainer: { email: trainer.email, success: true }
          });
        } else {
          emailResults.push({
            assignmentId: assignment.id,
            trainee: { email: trainee.email, success: traineeEmailResult.success, error: traineeEmailResult.error },
            trainer: { email: trainer.email, success: trainerEmailResult.success, error: trainerEmailResult.error }
          });
        }

      } catch (error) {
        console.error(`Error processing assignment ${assignment.id}:`, error);
        emailResults.push({
          assignmentId: assignment.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Due alerts processed`,
        emailsSent,
        totalAssignments: alertAssignments.length,
        results: emailResults
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Due alerts error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to send email via the send_email function
async function sendEmail(template: string, emailData: any) {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send_email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template,
        ...emailData
      }),
    });

    const result = await response.json();
    return { success: response.ok, ...result };
  } catch (error) {
    console.error('Error sending email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
