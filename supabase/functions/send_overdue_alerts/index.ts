import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { formatDateForDisplay } from '../../utils/dateFormat.ts';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OverdueAssignment {
  assignmentId: string;
  traineeName: string;
  traineeEmail: string;
  trainerName: string;
  trainerEmail: string;
  moduleTitle: string;
  moduleVersion: string;
  dueDate: string;
  daysOverdue: number;
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

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    // Query overdue assignments (due date is before today)
    const { data: overdueAssignments, error: assignmentsError } = await supabase
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
      .in('status', ['assigned', 'in_progress'])
      .lt('due_date', today.toISOString());

    if (assignmentsError) {
      console.error('Error fetching overdue assignments:', assignmentsError);
      throw assignmentsError;
    }

    if (!overdueAssignments || overdueAssignments.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No overdue assignments found',
          emailsSent: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get all manager users
    const { data: managers, error: managersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .in('role', ['manager', 'admin']);

    if (managersError) {
      console.error('Error fetching managers:', managersError);
      throw managersError;
    }

    if (!managers || managers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No managers found to notify',
          emailsSent: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user details for overdue assignments
    const userIds = [
      ...new Set(overdueAssignments.map(a => a.assigned_to)),
      ...new Set(overdueAssignments.map(a => a.trainer_user_id).filter(Boolean))
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

    // Prepare overdue assignments data
    const overdueData: OverdueAssignment[] = overdueAssignments.map(assignment => {
      const trainee = usersMap.get(assignment.assigned_to);
      const trainer = usersMap.get(assignment.trainer_user_id);
      
      const dueDate = new Date(assignment.due_date);
      const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        assignmentId: assignment.id,
        traineeName: trainee ? `${trainee.first_name} ${trainee.last_name}` : 'Unknown Trainee',
        traineeEmail: trainee?.email || 'unknown@example.com',
        trainerName: trainer ? `${trainer.first_name} ${trainer.last_name}` : 'No Trainer Assigned',
        trainerEmail: trainer?.email || 'notrainer@example.com',
        moduleTitle: assignment.modules.title,
        moduleVersion: assignment.modules.version,
        dueDate: formatDateForDisplay(dueDate),
        daysOverdue,
        lineName: assignment.modules.lines.name,
        currentStatus: assignment.status === 'in_progress' ? 'In Progress' : 'Not Started'
      };
    });

    let emailsSent = 0;
    const emailResults = [];

    // Send overdue alert to each manager
    for (const manager of managers) {
      try {
        // Create HTML list of overdue assignments
        const overdueListHtml = overdueData.map(assignment => `
          <div class="overdue-item">
            <h4>${assignment.moduleTitle} (v${assignment.moduleVersion})</h4>
            <p><strong>Trainee:</strong> ${assignment.traineeName} (${assignment.traineeEmail})</p>
            <p><strong>Trainer:</strong> ${assignment.trainerName} (${assignment.trainerEmail})</p>
            <p><strong>Due Date:</strong> ${assignment.dueDate}</p>
            <p><strong>Days Overdue:</strong> ${assignment.daysOverdue} day${assignment.daysOverdue !== 1 ? 's' : ''}</p>
            <p><strong>Production Line:</strong> ${assignment.lineName}</p>
            <p><strong>Current Status:</strong> ${assignment.currentStatus}</p>
          </div>
        `).join('');

        const emailResult = await sendEmail('overdue-alert-manager', {
          to: manager.email,
          subject: `URGENT: ${overdueData.length} Overdue Training Assignment${overdueData.length !== 1 ? 's' : ''} Require Attention`,
          variables: {
            manager_name: `${manager.first_name} ${manager.last_name}`,
            overdue_count: overdueData.length.toString(),
            overdue_list: overdueListHtml,
            admin_url: `${Deno.env.get('SITE_URL')}/admin/assignments`
          }
        });

        if (emailResult.success) {
          emailsSent++;
          emailResults.push({
            manager: { email: manager.email, success: true }
          });
        } else {
          emailResults.push({
            manager: { email: manager.email, success: false, error: emailResult.error }
          });
        }

      } catch (error) {
        console.error(`Error sending email to manager ${manager.email}:`, error);
        emailResults.push({
          manager: { email: manager.email, success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Overdue alerts processed`,
        emailsSent,
        totalManagers: managers.length,
        totalOverdueAssignments: overdueData.length,
        results: emailResults
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Overdue alerts error:', error);
    
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
